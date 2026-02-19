import os
import traceback
from fastapi import FastAPI, Request, HTTPException
import re
from urllib.parse import urlsplit
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from starlette.responses import JSONResponse

from .core.limiter import limiter
from .routers import jobs, billing, stripe, assessments, scraper, auth, admin, ai, email, push
from .core.security import add_security_headers
from .matching_engine import run_hourly_batch_jobs, run_daily_batch_jobs
from .services.daily_digest import run_daily_job_digest
from .governance import run_retention_cleanup

SENTRY_DSN = os.getenv("SENTRY_DSN")
SENTRY_ENV = os.getenv("SENTRY_ENV", os.getenv("ENVIRONMENT", "production"))
EXPOSE_DEBUG_ERRORS = os.getenv("EXPOSE_DEBUG_ERRORS", "false").strip().lower() in {"1", "true", "yes", "on"}
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENV,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )

app = FastAPI(title="JobShaman Backend Services")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middlewares
raw_origins = os.getenv("ALLOWED_ORIGINS")
base_origins = [
    "https://jobshaman.cz",
    "https://jobshaman.com",
    "https://www.jobshaman.cz",
    "https://www.jobshaman.com",
    "https://jobshaman-api.onrender.com",
    "https://jobshaman-cz.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
]
_ALLOWED_ORIGIN_REGEX = r"^https?://([a-z0-9-]+\.)?jobshaman\.(cz|com)(:\d+)?$"


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


ALLOWED_ORIGINS = [_normalize_origin(o.strip()) for o in raw_origins.split(",") if o.strip()] if raw_origins else []
for origin in base_origins:
    normalized_origin = _normalize_origin(origin)
    if normalized_origin and normalized_origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(normalized_origin)


def _is_allowed_origin(origin: str | None) -> bool:
    normalized_origin = _normalize_origin(origin)
    if not normalized_origin:
        return False
    return normalized_origin in ALLOWED_ORIGINS or bool(_origin_regex.match(normalized_origin))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_origin_regex = re.compile(_ALLOWED_ORIGIN_REGEX, re.IGNORECASE)

@app.middleware("http")
async def add_cors_on_error(request: Request, call_next):
    try:
        return await call_next(request)
    except HTTPException as exc:
        origin = request.headers.get("origin")
        response = JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = _normalize_origin(origin)
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
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
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = _normalize_origin(origin)
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

@app.middleware("http")
async def add_custom_headers(request: Request, call_next):
    return await add_security_headers(request, call_next)

# Include Routers
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

from .core.security import cleanup_csrf_sessions

scheduler: BackgroundScheduler | None = None
_scheduler_enabled = os.getenv("ENABLE_BACKGROUND_SCHEDULER", "false").strip().lower() in {"1", "true", "yes", "on"}
_daily_digest_enabled = os.getenv("ENABLE_DAILY_DIGESTS", "false").strip().lower() in {"1", "true", "yes", "on"}


def _start_scheduler() -> None:
    global scheduler
    if not _scheduler_enabled:
        print("ℹ️ Background scheduler disabled (ENABLE_BACKGROUND_SCHEDULER=false).")
        return
    try:
        scheduler = BackgroundScheduler(timezone="Europe/Prague")
        scheduler.add_job(cleanup_csrf_sessions, 'interval', hours=6)
        scheduler.add_job(run_hourly_batch_jobs, 'interval', hours=1, id="matching_hourly", max_instances=1, coalesce=True)
        scheduler.add_job(run_daily_batch_jobs, 'cron', hour=2, minute=15, id="matching_daily", max_instances=1, coalesce=True)
        scheduler.add_job(run_retention_cleanup, 'cron', hour=3, minute=10, id="retention_cleanup", max_instances=1, coalesce=True)
        if _daily_digest_enabled:
            scheduler.add_job(run_daily_job_digest, 'interval', minutes=15, id="daily_digest", max_instances=1, coalesce=True)
        scheduler.start()
        print("✅ Background scheduler started.")
    except Exception as exc:
        scheduler = None
        print(f"⚠️ Background scheduler failed to start: {exc}")


@app.on_event("startup")
async def _on_startup():
    _start_scheduler()


@app.on_event("shutdown")
async def _on_shutdown():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        print("ℹ️ Background scheduler stopped.")
    scheduler = None


@app.get("/healthz")
async def healthz():
    print("✅ /healthz ping")
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
