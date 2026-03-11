import os

from apscheduler.schedulers.background import BackgroundScheduler

from ..core.security import cleanup_csrf_sessions
from ..governance import run_retention_cleanup
from ..matching_engine import run_daily_batch_jobs, run_hourly_batch_jobs
from ..services.benchmarks_public import run_salary_public_reference_refresh
from ..services.daily_digest import run_daily_job_digest
from ..services.external_feed_warmup import run_external_feed_warmup

_scheduler: BackgroundScheduler | None = None
_scheduler_enabled = os.getenv("ENABLE_BACKGROUND_SCHEDULER", "false").strip().lower() in {"1", "true", "yes", "on"}
_matching_batch_enabled = os.getenv("ENABLE_MATCHING_BATCH_JOBS", "false").strip().lower() in {"1", "true", "yes", "on"}
_daily_digest_enabled = os.getenv("ENABLE_DAILY_DIGESTS", "false").strip().lower() in {"1", "true", "yes", "on"}
_public_benchmarks_enabled = os.getenv("ENABLE_PUBLIC_BENCHMARK_REFRESH", "false").strip().lower() in {"1", "true", "yes", "on"}
_external_feed_warmup_enabled = os.getenv("ENABLE_EXTERNAL_FEED_WARMUP", "false").strip().lower() in {"1", "true", "yes", "on"}
_external_feed_warmup_interval_minutes = max(15, int(os.getenv("EXTERNAL_FEED_WARMUP_INTERVAL_MINUTES", "60") or "60"))


def start_background_scheduler() -> None:
    global _scheduler
    if not _scheduler_enabled:
        print("ℹ️ Background scheduler disabled (ENABLE_BACKGROUND_SCHEDULER=false).")
        return
    try:
        _scheduler = BackgroundScheduler(timezone="Europe/Prague")
        _scheduler.add_job(cleanup_csrf_sessions, 'interval', hours=6)
        if _matching_batch_enabled:
            _scheduler.add_job(run_hourly_batch_jobs, 'interval', hours=1, id="matching_hourly", max_instances=1, coalesce=True)
            _scheduler.add_job(run_daily_batch_jobs, 'cron', hour=2, minute=15, id="matching_daily", max_instances=1, coalesce=True)
        _scheduler.add_job(run_retention_cleanup, 'cron', hour=3, minute=10, id="retention_cleanup", max_instances=1, coalesce=True)
        if _daily_digest_enabled:
            _scheduler.add_job(run_daily_job_digest, 'interval', minutes=15, id="daily_digest", max_instances=1, coalesce=True)
        if _public_benchmarks_enabled:
            _scheduler.add_job(
                run_salary_public_reference_refresh,
                'cron',
                hour=4,
                minute=5,
                id="public_salary_benchmark_refresh",
                max_instances=1,
                coalesce=True,
            )
        if _external_feed_warmup_enabled:
            _scheduler.add_job(
                run_external_feed_warmup,
                'interval',
                minutes=_external_feed_warmup_interval_minutes,
                id="external_feed_warmup",
                max_instances=1,
                coalesce=True,
            )
        _scheduler.start()
        print("✅ Background scheduler started.")
        if not _matching_batch_enabled:
            print("ℹ️ Matching batch scheduler disabled (ENABLE_MATCHING_BATCH_JOBS=false).")
    except Exception as exc:
        _scheduler = None
        print(f"⚠️ Background scheduler failed to start: {exc}")


def stop_background_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("ℹ️ Background scheduler stopped.")
    _scheduler = None
