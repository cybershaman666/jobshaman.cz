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
    "learning_resources",
    "profile",
    "push",
    "scraper",
    "stripe",
    "tests",
]
