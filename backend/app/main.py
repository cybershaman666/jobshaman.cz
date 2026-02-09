import os
from fastapi import FastAPI, Request
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from starlette.responses import JSONResponse

from .core.limiter import limiter
from .routers import jobs, billing, stripe, assessments, scraper, auth, admin
from .core.security import add_security_headers

SENTRY_DSN = os.getenv("SENTRY_DSN")
SENTRY_ENV = os.getenv("SENTRY_ENV", os.getenv("ENVIRONMENT", "production"))
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
ALLOWED_ORIGINS = [o.strip() for o in raw_origins.split(",") if o.strip()] if raw_origins else []
for origin in base_origins:
    if origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(www\\.)?jobshaman\\.(cz|com)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Scheduler
from .core.security import cleanup_csrf_sessions
scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_csrf_sessions, 'interval', hours=6)
scheduler.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
