from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from starlette.responses import JSONResponse

from .core.limiter import limiter
from .routers import jobs, billing, stripe, assessments, scraper
from .core.security import add_security_headers

app = FastAPI(title="JobShaman Backend Services")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Should be restricted in production
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
app.include_router(scraper.router, tags=["Scraper"])

# Scheduler
from .core.security import cleanup_csrf_sessions
scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_csrf_sessions, 'interval', hours=6)
scheduler.start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
