import sys
from datetime import datetime, timezone

from app.services.daily_digest import run_daily_job_digest


def main() -> int:
    started = datetime.now(timezone.utc).isoformat()
    print(f"🚀 Starting daily digest run at {started}")
    try:
        run_daily_job_digest()
        finished = datetime.now(timezone.utc).isoformat()
        print(f"✅ Daily digest run finished at {finished}")
        return 0
    except Exception as exc:
        finished = datetime.now(timezone.utc).isoformat()
        print(f"❌ Daily digest run failed at {finished}: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
