from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _bootstrap_env() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    os.environ.setdefault("JWT_SECRET", "local-dev-jobspy-geocoding")
    os.environ.setdefault("SECRET_KEY", os.environ["JWT_SECRET"])


def main() -> int:
    _bootstrap_env()

    from app.services.jobspy_jobs import backfill_jobspy_geocoding

    parser = argparse.ArgumentParser(description="Backfill lat/lng geocoding for JobSpy Mongo jobs.")
    parser.add_argument("--limit", type=int, default=300, help="Maximum number of docs to inspect.")
    parser.add_argument(
        "--include-existing",
        action="store_true",
        help="Re-geocode even docs that already have coordinates.",
    )
    args = parser.parse_args()

    result = backfill_jobspy_geocoding(
        limit=max(1, int(args.limit or 300)),
        only_missing=not bool(args.include_existing),
    )
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
