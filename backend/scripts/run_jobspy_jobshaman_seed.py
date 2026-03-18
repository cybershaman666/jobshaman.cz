from __future__ import annotations

import argparse
import json
import os
import sys
import time
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

from app.services.jobspy_jobs import backfill_jobspy_geocoding, import_jobspy_jobs

DEFAULT_SITES = ["indeed", "linkedin", "google"]

# JobSpy needs a search term, so we use a broad multi-sector seed set
# instead of trying to scrape "all jobs" with an empty query.
DEFAULT_QUERIES = [
    "software engineer",
    "project manager",
    "data analyst",
    "sales",
    "marketing",
    "customer support",
    "operations",
    "finance",
    "hr",
    "designer",
    "warehouse",
    "account manager",
]

COUNTRY_PRESETS: dict[str, dict[str, object]] = {
    "DE": {
        "country_indeed": "Germany",
        "locations": ["Berlin", "Munich", "Hamburg", "Germany"],
    },
    "AT": {
        "country_indeed": "Austria",
        "locations": ["Vienna", "Linz", "Graz", "Austria"],
    },
    "CZ": {
        "country_indeed": "Czech Republic",
        "locations": ["Prague", "Brno", "Ostrava", "Czech Republic"],
    },
    "SK": {
        "country_indeed": "Slovakia",
        "locations": ["Bratislava", "Kosice", "Zilina", "Slovakia"],
    },
    "PL": {
        "country_indeed": "Poland",
        "locations": ["Warsaw", "Krakow", "Wroclaw", "Poland"],
    },
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="One-command JobShaman JobSpy seed for DE, AT, CZ, SK and PL into MongoDB."
    )
    parser.add_argument("--countries", default="DE,AT,CZ,SK,PL")
    parser.add_argument("--sites", default="indeed,linkedin,google")
    parser.add_argument("--queries", default=",".join(DEFAULT_QUERIES))
    parser.add_argument("--results-wanted", type=int, default=30)
    parser.add_argument("--hours-old", type=int, default=168)
    parser.add_argument("--linkedin-fetch-description", action="store_true")
    parser.add_argument("--sleep-seconds", type=float, default=1.0)
    parser.add_argument("--limit-locations-per-country", type=int, default=4)
    parser.add_argument("--skip-geocoding-backfill", action="store_true")
    parser.add_argument("--geocoding-limit", type=int, default=1200)
    return parser


def _parse_csv(value: str) -> list[str]:
    return [part.strip() for part in str(value or "").split(",") if part and part.strip()]


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    countries = [code.upper() for code in _parse_csv(args.countries)]
    sites = _parse_csv(args.sites) or DEFAULT_SITES[:]
    queries = _parse_csv(args.queries) or DEFAULT_QUERIES[:]
    results_wanted = max(1, min(100, int(args.results_wanted or 30)))
    hours_old = max(1, min(24 * 30, int(args.hours_old or 168)))
    sleep_seconds = max(0.0, float(args.sleep_seconds or 0.0))
    limit_locations = max(1, min(10, int(args.limit_locations_per_country or 4)))
    geocoding_limit = max(1, min(5000, int(args.geocoding_limit or 1200)))

    summary: dict[str, object] = {
        "status": "success",
        "provider": "jobspy",
        "countries": countries,
        "sites": sites,
        "queries": queries,
        "results_wanted": results_wanted,
        "hours_old": hours_old,
        "runs": [],
        "totals": {
            "runs": 0,
            "imported_count": 0,
            "upserted_count": 0,
            "matched_count": 0,
        },
    }

    for country_code in countries:
        preset = COUNTRY_PRESETS.get(country_code)
        if not preset:
            continue
        country_indeed = str(preset["country_indeed"])
        locations = [str(item) for item in list(preset["locations"])[:limit_locations]]
        for location in locations:
            for query in queries:
                result = import_jobspy_jobs(
                    site_name=sites,
                    search_term=query,
                    google_search_term=f"{query} jobs in {location} since last week",
                    location=location,
                    results_wanted=results_wanted,
                    hours_old=hours_old,
                    country_indeed=country_indeed,
                    linkedin_fetch_description=bool(args.linkedin_fetch_description),
                )
                run_summary = {
                    "country_code": country_code,
                    "country_indeed": country_indeed,
                    "location": location,
                    "query": query,
                    "collection": result.collection,
                    "imported_count": result.imported_count,
                    "upserted_count": result.upserted_count,
                    "matched_count": result.matched_count,
                    "query_hash": result.query_hash,
                }
                print(json.dumps(run_summary, ensure_ascii=False), flush=True)
                summary["runs"].append(run_summary)
                totals = summary["totals"]
                totals["runs"] = int(totals["runs"]) + 1
                totals["imported_count"] = int(totals["imported_count"]) + int(result.imported_count)
                totals["upserted_count"] = int(totals["upserted_count"]) + int(result.upserted_count)
                totals["matched_count"] = int(totals["matched_count"]) + int(result.matched_count)
                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)

    if not args.skip_geocoding_backfill:
        geocoding_result = backfill_jobspy_geocoding(limit=geocoding_limit, only_missing=True)
        summary["geocoding"] = geocoding_result
        print(json.dumps({"jobspy_geocoding": geocoding_result}, ensure_ascii=False), flush=True)

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
