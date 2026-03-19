#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path


def _maybe_reexec_backend_venv() -> None:
    if os.environ.get("JOBSHAMAN_SKIP_VENV_REEXEC") == "1":
        return

    script_path = Path(__file__).resolve()
    backend_dir = script_path.parent.parent if script_path.parent.name == "scripts" else script_path.parents[2] / "backend"
    venv_python = backend_dir / "venv" / "bin" / "python"
    if not venv_python.exists():
        return

    current_python = Path(sys.executable).resolve()
    if current_python == venv_python.resolve():
        return

    os.environ["JOBSHAMAN_SKIP_VENV_REEXEC"] = "1"
    os.execv(str(venv_python), [str(venv_python), str(script_path), *sys.argv[1:]])


_maybe_reexec_backend_venv()

from dotenv import load_dotenv

SCRIPT_PATH = Path(__file__).resolve()
if SCRIPT_PATH.parent.name == "scripts" and (SCRIPT_PATH.parent.parent / "app").exists():
    ROOT = SCRIPT_PATH.parent.parent
    BACKEND_DIR = ROOT
else:
    ROOT = SCRIPT_PATH.parents[2]
    BACKEND_DIR = ROOT / "backend"
SCRAPER_DIR = BACKEND_DIR / "scraper"

for path in (BACKEND_DIR, SCRAPER_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

load_dotenv(dotenv_path=ROOT / ".env", override=False)
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

os.environ.setdefault("JWT_SECRET", "jobshaman-unified-ingest-local-dev")
os.environ.setdefault("SECRET_KEY", os.environ["JWT_SECRET"])

try:
    from scraper.scraper_multi import run_all_scrapers  # type: ignore
except Exception:
    from scraper_multi import run_all_scrapers  # type: ignore
from app.services.jobspy_jobs import backfill_jobspy_geocoding, import_jobspy_jobs


DEFAULT_SITES = ["indeed", "linkedin", "google"]
DEFAULT_COUNTRIES = ["CZ", "AT", "DE", "SK", "PL"]
DEFAULT_QUERIES = [
    "software engineer",
    "project manager",
    "data analyst",
    "sales",
    "marketing",
    "customer support",
    "operations",
]
COUNTRY_PRESETS: dict[str, dict[str, object]] = {
    "DE": {"country_indeed": "Germany", "locations": ["Berlin", "Munich", "Hamburg", "Germany"]},
    "AT": {"country_indeed": "Austria", "locations": ["Vienna", "Linz", "Graz", "Austria"]},
    "CZ": {"country_indeed": "Czech Republic", "locations": ["Prague", "Brno", "Ostrava", "Czech Republic"]},
    "SK": {"country_indeed": "Slovakia", "locations": ["Bratislava", "Kosice", "Zilina", "Slovakia"]},
    "PL": {"country_indeed": "Poland", "locations": ["Warsaw", "Krakow", "Wroclaw", "Poland"]},
}


def _parse_csv(raw: str) -> list[str]:
    return [part.strip() for part in str(raw or "").split(",") if part and part.strip()]


def _build_site_batches(
    sites: list[str],
    *,
    linkedin_fetch_description: bool,
) -> list[list[str]]:
    normalized = [site.strip() for site in sites if site and site.strip()]
    if not normalized:
        return []
    if not linkedin_fetch_description:
        return [normalized]

    linkedin_sites = [site for site in normalized if site.lower() == "linkedin"]
    other_sites = [site for site in normalized if site.lower() != "linkedin"]
    batches: list[list[str]] = []
    if other_sites:
        batches.append(other_sites)
    if linkedin_sites:
        batches.append(linkedin_sites)
    return batches or [normalized]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run scraper_multi and JobSpy seed in one command, with unified writes into Jobs Postgres."
    )
    parser.add_argument("--skip-scraper-multi", action="store_true")
    parser.add_argument("--skip-jobspy", action="store_true")
    parser.add_argument("--disable-remote-normalization", action="store_true")
    parser.add_argument("--countries", default=",".join(DEFAULT_COUNTRIES))
    parser.add_argument("--sites", default=",".join(DEFAULT_SITES))
    parser.add_argument("--queries", default=",".join(DEFAULT_QUERIES))
    parser.add_argument("--results-wanted", type=int, default=30)
    parser.add_argument("--hours-old", type=int, default=168)
    parser.add_argument("--linkedin-fetch-description", action="store_true")
    parser.add_argument("--jobspy-sleep-seconds", type=float, default=1.0)
    parser.add_argument("--linkedin-results-wanted-cap", type=int, default=12)
    parser.add_argument("--limit-locations-per-country", type=int, default=4)
    parser.add_argument("--skip-jobspy-geocoding-backfill", action="store_true")
    parser.add_argument("--jobspy-geocoding-limit", type=int, default=1200)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    summary: dict[str, object] = {
        "status": "success",
        "scraper_multi": None,
        "jobspy": {
            "runs": [],
            "totals": {"runs": 0, "imported_count": 0, "upserted_count": 0, "matched_count": 0},
        },
    }

    if args.disable_remote_normalization:
        os.environ["SCRAPER_REMOTE_METADATA_BACKFILL"] = "false"

    if not args.skip_scraper_multi:
        scraper_total = run_all_scrapers()
        summary["scraper_multi"] = {"saved_total": int(scraper_total or 0)}

    if not args.skip_jobspy:
        countries = [value.upper() for value in _parse_csv(args.countries)] or DEFAULT_COUNTRIES[:]
        sites = _parse_csv(args.sites) or DEFAULT_SITES[:]
        queries = _parse_csv(args.queries) or DEFAULT_QUERIES[:]
        results_wanted = max(1, min(100, int(args.results_wanted or 30)))
        hours_old = max(1, min(24 * 30, int(args.hours_old or 168)))
        limit_locations = max(1, min(10, int(args.limit_locations_per_country or 4)))
        sleep_seconds = max(0.0, float(args.jobspy_sleep_seconds or 0.0))
        linkedin_results_cap = max(1, min(100, int(args.linkedin_results_wanted_cap or 12)))
        site_batches = _build_site_batches(
            sites,
            linkedin_fetch_description=bool(args.linkedin_fetch_description),
        )

        for country_code in countries:
            preset = COUNTRY_PRESETS.get(country_code)
            if not preset:
                continue
            country_indeed = str(preset["country_indeed"])
            locations = [str(item) for item in list(preset["locations"])[:limit_locations]]
            for location in locations:
                for query in queries:
                    for site_batch in site_batches:
                        linkedin_only_batch = all(site.lower() == "linkedin" for site in site_batch)
                        batch_results_wanted = min(results_wanted, linkedin_results_cap) if linkedin_only_batch else results_wanted
                        result = import_jobspy_jobs(
                            site_name=site_batch,
                            search_term=query,
                            google_search_term=f"{query} jobs in {location} since last week",
                            location=location,
                            results_wanted=batch_results_wanted,
                            hours_old=hours_old,
                            country_indeed=country_indeed,
                            linkedin_fetch_description=bool(args.linkedin_fetch_description and linkedin_only_batch),
                        )
                        run_summary = {
                            "country_code": country_code,
                            "country_indeed": country_indeed,
                            "location": location,
                            "query": query,
                            "sites": site_batch,
                            "results_wanted": batch_results_wanted,
                            "imported_count": result.imported_count,
                            "upserted_count": result.upserted_count,
                            "matched_count": result.matched_count,
                            "query_hash": result.query_hash,
                        }
                        print(json.dumps(run_summary, ensure_ascii=False), flush=True)
                        cast_runs = summary["jobspy"]["runs"]  # type: ignore[index]
                        cast_runs.append(run_summary)  # type: ignore[union-attr]
                        totals = summary["jobspy"]["totals"]  # type: ignore[index]
                        totals["runs"] = int(totals["runs"]) + 1  # type: ignore[index]
                        totals["imported_count"] = int(totals["imported_count"]) + int(result.imported_count)  # type: ignore[index]
                        totals["upserted_count"] = int(totals["upserted_count"]) + int(result.upserted_count)  # type: ignore[index]
                        totals["matched_count"] = int(totals["matched_count"]) + int(result.matched_count)  # type: ignore[index]
                        if sleep_seconds > 0:
                            time.sleep(sleep_seconds)

        if not args.skip_jobspy_geocoding_backfill:
            geocoding_result = backfill_jobspy_geocoding(
                limit=max(1, min(5000, int(args.jobspy_geocoding_limit or 1200))),
                only_missing=True,
            )
            summary["jobspy"]["geocoding"] = geocoding_result  # type: ignore[index]

    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
