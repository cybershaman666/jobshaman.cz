import os
import asyncio
import urllib.request
import re
import traceback
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import JSONResponse

from .core.limiter import limiter
from .core.security import add_security_headers
from .routers import search_runtime

app = FastAPI(title="JobShaman Search API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

raw_origins = os.getenv("ALLOWED_ORIGINS")
base_origins = [
    "https://jobshaman.cz",
    "https://jobshaman.com",
    "https://www.jobshaman.cz",
    "https://www.jobshaman.com",
    "https://jobshaman-cz.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
]
_ALLOWED_ORIGIN_REGEX = r"^https?://([a-z0-9-]+\.)?jobshaman\.(cz|com)(:\d+)?$"
EXPOSE_DEBUG_ERRORS = os.getenv("EXPOSE_DEBUG_ERRORS", "false").strip().lower() in {"1", "true", "yes", "on"}
BACKEND_WAKE_URL = os.getenv("BACKEND_WAKE_URL", "https://jobshaman-cz.onrender.com/healthz").strip()
BACKEND_WAKE_INTERVAL_SECONDS = int(os.getenv("BACKEND_WAKE_INTERVAL_SECONDS", "300"))
ENABLE_BACKEND_WAKE = os.getenv("ENABLE_BACKEND_WAKE", "true").strip().lower() in {"1", "true", "yes", "on"}


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


_origin_regex = re.compile(_ALLOWED_ORIGIN_REGEX, re.IGNORECASE)


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
        response = JSONResponse({"detail": detail, "path": str(request.url.path)}, status_code=500)
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = _normalize_origin(origin)
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


@app.middleware("http")
async def add_custom_headers(request: Request, call_next):
    return await add_security_headers(request, call_next)


app.include_router(search_runtime.router, tags=["Search"])


def _ping_backend_once(url: str) -> None:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "jobshaman-search-api/wake"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read(1)


async def _backend_wake_loop() -> None:
    if not ENABLE_BACKEND_WAKE or not BACKEND_WAKE_URL:
        return
    while True:
        try:
            await asyncio.to_thread(_ping_backend_once, BACKEND_WAKE_URL)
        except Exception as exc:
            print(f"⚠️ Backend wake failed: {exc}")
        await asyncio.sleep(max(BACKEND_WAKE_INTERVAL_SECONDS, 60))


@app.on_event("startup")
async def start_backend_wake_task() -> None:
    if ENABLE_BACKEND_WAKE and BACKEND_WAKE_URL:
        app.state.backend_wake_task = asyncio.create_task(_backend_wake_loop())


@app.on_event("shutdown")
async def stop_backend_wake_task() -> None:
    task = getattr(app.state, "backend_wake_task", None)
    if task:
        task.cancel()


@app.get("/")
async def root():
    return {"status": "JobShaman Search API is running"}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
