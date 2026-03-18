from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(dotenv_path=ROOT / ".env", override=False)
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

if not os.getenv("JWT_SECRET") and not os.getenv("SECRET_KEY"):
    os.environ["JWT_SECRET"] = "jobspy-cli-local-dev-secret"

from app.services.jobspy_jobs import import_jobspy_jobs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run JobSpy import and persist results to MongoDB.")
    parser.add_argument("--search-term", required=True)
    parser.add_argument("--location", default="")
    parser.add_argument("--google-search-term", default="")
    parser.add_argument("--site-name", default="indeed,linkedin,google")
    parser.add_argument("--results-wanted", type=int, default=20)
    parser.add_argument("--hours-old", type=int, default=None)
    parser.add_argument("--country-indeed", default="Austria")
    parser.add_argument("--job-type", default="")
    parser.add_argument("--is-remote", action="store_true")
    parser.add_argument("--linkedin-fetch-description", action="store_true")
    parser.add_argument("--offset", type=int, default=0)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    sites = [part.strip() for part in str(args.site_name or "").split(",") if part and part.strip()]
    result = import_jobspy_jobs(
        site_name=sites or None,
        search_term=args.search_term,
        google_search_term=args.google_search_term,
        location=args.location,
        results_wanted=args.results_wanted,
        hours_old=args.hours_old,
        country_indeed=args.country_indeed,
        job_type=args.job_type,
        is_remote=bool(args.is_remote),
        linkedin_fetch_description=bool(args.linkedin_fetch_description),
        offset=args.offset,
    )
    print(
        json.dumps(
            {
                "status": "success",
                "collection": result.collection,
                "imported_count": result.imported_count,
                "upserted_count": result.upserted_count,
                "matched_count": result.matched_count,
                "query_hash": result.query_hash,
                "sampled_jobs": result.sampled_jobs,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
