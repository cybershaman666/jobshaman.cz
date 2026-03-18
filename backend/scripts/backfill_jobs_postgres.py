#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from argparse import ArgumentParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("JWT_SECRET", "local-dev")
os.environ.setdefault("SECRET_KEY", os.environ["JWT_SECRET"])


def main() -> int:
    parser = ArgumentParser(description="Backfill Supabase jobs into Northflank Jobs Postgres.")
    parser.add_argument("--limit", type=int, default=5000)
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--include-inactive", action="store_true")
    args = parser.parse_args()

    from app.services.jobs_migration import backfill_jobs_postgres_from_supabase

    result = backfill_jobs_postgres_from_supabase(
        limit=max(1, int(args.limit or 5000)),
        batch_size=max(1, int(args.batch_size or 500)),
        only_active=not bool(args.include_inactive),
    )
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
