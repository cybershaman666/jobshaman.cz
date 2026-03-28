"""
FastAPI routers package.

Keep this package import-light: importing `backend.app.routers` should not eagerly
import every router module (some have heavy side-effects during import).
"""

__all__ = [
    "admin",
    "ai",
    "analytics",
    "assets",
    "assessments",
    "auth",
    "benchmarks",
    "billing",
    "career_map",
    "email",
    "jobs",
    "jobs_catalog",
    "jobs_company_native",
    "jobs_external",
    "jobs_interactions",
    "jobs_ai",
    "jobs_recommendations",
    "jobs_search",
    "learning_resources",
    "profile",
    "push",
    "scraper",
    "stripe",
    "tests",
]
