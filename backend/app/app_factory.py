import os
import re
import traceback
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse, Response

try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
except Exception:
    sentry_sdk = None
    FastApiIntegration = None

from .core.limiter import limiter
from .core.security import add_security_headers
from .routers import admin, ai, analytics, assets, assessments, auth, benchmarks, billing, career_map, email, jobs, learning_resources, profile, push, scraper, stripe, tests
from .runtime import start_background_scheduler, stop_background_scheduler

SENTRY_DSN = os.getenv("SENTRY_DSN")
SENTRY_ENV = os.getenv("SENTRY_ENV", os.getenv("ENVIRONMENT", "production"))
EXPOSE_DEBUG_ERRORS = os.getenv("EXPOSE_DEBUG_ERRORS", "false").strip().lower() in {"1", "true", "yes", "on"}

_ALLOWED_ORIGIN_REGEX = (
    r"^https?://([a-z0-9-]+\.)?jobshaman\.(cz|com)(:\d+)?$"
    r"|^https?://jobshaman(-[a-z0-9-]+)?\.vercel\.app(:\d+)?$"
    r"|^https?://[a-z0-9-]+\.northflank\.app(:\d+)?$"
    r"|^https?://[a-z0-9-]+--[a-z0-9-]+(?:--[a-z0-9-]+)?\.code\.run(:\d+)?$"
    r"|^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
)
_origin_regex = re.compile(_ALLOWED_ORIGIN_REGEX, re.IGNORECASE)


def _configure_sentry() -> None:
    if SENTRY_DSN and sentry_sdk and FastApiIntegration:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENV,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
        )
    elif SENTRY_DSN:
        print("⚠️ SENTRY_DSN is set but sentry-sdk is unavailable; continuing without Sentry.")


def _normalize_origin(origin: str | None) -> str:
    if not origin:
        return ""
    value = origin.strip().rstrip("/")
    try:
        parsed = urlsplit(value)
    except Exception:
        return value
    if not parsed.scheme or not parsed.hostname:
        return value
    port = parsed.port
    if (parsed.scheme == "https" and port == 443) or (parsed.scheme == "http" and port == 80):
        port = None
    if port is None:
        return f"{parsed.scheme}://{parsed.hostname}"
    return f"{parsed.scheme}://{parsed.hostname}:{port}"


def _build_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS")
    base_origins = [
        "https://jobshaman.cz",
        "https://jobshaman.com",
        "https://www.jobshaman.cz",
        "https://www.jobshaman.com",
        "https://jobshaman.vercel.app",
        "https://jobshaman-search-api.northflank.app",
        "https://site--jobshaman--rb4dlj74d5kc.code.run",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    allowed_origins = [_normalize_origin(o.strip()) for o in raw_origins.split(",") if o.strip()] if raw_origins else []
    for origin in base_origins:
        normalized_origin = _normalize_origin(origin)
        if normalized_origin and normalized_origin not in allowed_origins:
            allowed_origins.append(normalized_origin)
    return allowed_origins


def _is_allowed_origin(origin: str | None, allowed_origins: list[str]) -> bool:
    normalized_origin = _normalize_origin(origin)
    if not normalized_origin:
        return False
    return normalized_origin in allowed_origins or bool(_origin_regex.match(normalized_origin))


def _apply_cors_headers(
    response: Response,
    origin: str | None,
    allowed_origins: list[str],
    *,
    preflight: bool = False,
    request_headers: str | None = None,
) -> Response:
    if not _is_allowed_origin(origin, allowed_origins):
        return response

    normalized_origin = _normalize_origin(origin)
    response.headers["Access-Control-Allow-Origin"] = normalized_origin
    response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Credentials"] = "true"

    if preflight:
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = request_headers or "*"
        response.headers["Access-Control-Max-Age"] = "600"

    return response


def _register_middlewares(app: FastAPI, allowed_origins: list[str]) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=_ALLOWED_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def ensure_preflight_cors(request: Request, call_next):
        origin = request.headers.get("origin")
        access_control_request_method = request.headers.get("access-control-request-method")

        if request.method.upper() == "OPTIONS" and access_control_request_method:
            if _is_allowed_origin(origin, allowed_origins):
                return _apply_cors_headers(
                    Response(status_code=204),
                    origin,
                    allowed_origins,
                    preflight=True,
                    request_headers=request.headers.get("access-control-request-headers"),
                )
            return Response(status_code=204)

        response = await call_next(request)
        return _apply_cors_headers(response, origin, allowed_origins)

    @app.middleware("http")
    async def add_cors_on_error(request: Request, call_next):
        try:
            return await call_next(request)
        except HTTPException as exc:
            origin = request.headers.get("origin")
            detail = exc.detail
            if exc.status_code >= 500 and not EXPOSE_DEBUG_ERRORS:
                detail = "Internal Server Error"
            response = JSONResponse({"detail": detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))
            return _apply_cors_headers(response, origin, allowed_origins)
        except Exception as exc:
            print(f"🔥 Unhandled error: {exc}")
            print(traceback.format_exc())
            origin = request.headers.get("origin")
            detail = "Internal Server Error"
            if EXPOSE_DEBUG_ERRORS:
                detail = f"{type(exc).__name__}: {str(exc)}"
            response = JSONResponse(
                {"detail": detail, "path": str(request.url.path)},
                status_code=500
            )
            return _apply_cors_headers(response, origin, allowed_origins)

    @app.middleware("http")
    async def add_custom_headers(request: Request, call_next):
        return await add_security_headers(request, call_next)


def _register_routers(app: FastAPI) -> None:
    app.include_router(jobs.router, tags=["Jobs"])
    app.include_router(billing.router, tags=["Billing"])
    app.include_router(stripe.router, tags=["Stripe"])
    app.include_router(assessments.router, prefix="/assessments", tags=["Assessments"])
    app.include_router(auth.router, tags=["Auth"])
    app.include_router(scraper.router, tags=["Scraper"])
    app.include_router(admin.router, tags=["Admin"])
    app.include_router(ai.router, tags=["AI"])
    app.include_router(email.router, tags=["Email"])
    app.include_router(push.router, tags=["Push"])
    app.include_router(profile.router, tags=["Profile"])
    app.include_router(learning_resources.router, tags=["LearningResources"])
    app.include_router(analytics.router, tags=["Analytics"])
    app.include_router(benchmarks.router, tags=["Benchmarks"])
    app.include_router(tests.router, tags=["Tests"])
    app.include_router(assets.router, tags=["Assets"])
    app.include_router(career_map.router, tags=["CareerMap"])


def _register_runtime(app: FastAPI) -> None:
    @app.on_event("startup")
    async def _on_startup():
        start_background_scheduler()

    @app.on_event("shutdown")
    async def _on_shutdown():
        stop_background_scheduler()


def create_app() -> FastAPI:
    _configure_sentry()
    allowed_origins = _build_allowed_origins()

    app = FastAPI(title="JobShaman Backend Services")
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    _register_middlewares(app, allowed_origins)
    _register_routers(app)
    _register_runtime(app)

    @app.get("/healthz")
    async def healthz():
        print("✅ /healthz ping")
        return {"status": "ok"}

    return app
