from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _bootstrap_env() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    os.environ.setdefault("JWT_SECRET", "local-dev-jobspy-postgres-backfill")
    os.environ.setdefault("SECRET_KEY", os.environ["JWT_SECRET"])


def main() -> int:
    _bootstrap_env()

    from app.services.jobspy_jobs import backfill_jobspy_postgres_from_mongo

    parser = argparse.ArgumentParser(description="Backfill JobSpy Mongo documents into Jobs Postgres serving table.")
    parser.add_argument("--limit", type=int, default=2000, help="Maximum number of docs to copy.")
    parser.add_argument(
        "--include-stale",
        action="store_true",
        help="Include stale/expired docs too.",
    )
    args = parser.parse_args()

    result = backfill_jobspy_postgres_from_mongo(
        limit=max(1, int(args.limit or 2000)),
        only_fresh=not bool(args.include_stale),
    )
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
