import argparse
import os
import sys
import time
from typing import Iterable, Optional

# Allow importing from backend root and scraper helpers when run as a script.
if __name__ == "__main__":
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    scraper_dir = os.path.join(backend_dir, "scraper")
    if scraper_dir not in sys.path:
        sys.path.insert(0, scraper_dir)

# Imports that work whether run as script or imported as module
try:
    from scraper.scraper_base import get_supabase_client, norm_text, normalize_jobs_country_code # type: ignore
    from scraper.scraper_api_sources import _infer_country_code # type: ignore
except (ImportError, ModuleNotFoundError):
    from scraper_base import get_supabase_client, norm_text, normalize_jobs_country_code # type: ignore
    from scraper_api_sources import _infer_country_code # type: ignore


DEFAULT_BATCH_SIZE = int(os.getenv("BACKFILL_REMOTE_BATCH_SIZE", "200"))
DEFAULT_SLEEP_SECONDS = float(os.getenv("BACKFILL_REMOTE_SLEEP_SECONDS", "0.1"))
REMOTE_SOURCES = {"weworkremotely.com", "arbeitnow.com", "www.arbeitnow.com"}


def infer_work_model(location: Optional[str], description: Optional[str], signals: Iterable[str], title: Optional[str]) -> str:
    haystack = f"{location or ''} {description or ''} {' '.join(signals)} {title or ''}".lower()
    if "hybrid" in haystack:
        return "Hybrid"
    if any(token in haystack for token in ["remote", "remote first", "anywhere", "work from home", "distributed", "home office", "worldwide"]):
        return "Remote"
    return "On-site"


def infer_country_code(location: Optional[str], source: Optional[str], work_model: str, description: Optional[str], title: Optional[str], signals: Iterable[str]) -> Optional[str]:
    inferred = _infer_country_code(
        location or "",
        [str(tag) for tag in signals],
        f"{source or ''} {work_model or ''} {description or ''} {title or ''}",
    )
    return normalize_jobs_country_code(inferred)


def backfill(
    dry_run: bool,
    batch_size: int,
    sleep_seconds: float,
    start_id: int,
    max_rows: int
) -> dict[str, int]:
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Supabase klient není dostupný.")
        return {"scanned": 0, "updated": 0, "skipped": 0}

    last_id = start_id
    scanned = 0
    updated = 0
    skipped = 0

    print(f"🚀 Remote import metadata backfill start [{'DRY-RUN' if dry_run else 'APPLY'}]")

    while scanned < max_rows:
        limit = min(batch_size, max_rows - scanned)
        res = (
            supabase.table("jobs")
            .select("id,source,title,location,description,benefits,work_model,work_type,country_code,lat,lng")
            .gt("id", last_id)
            .order("id", desc=False)
            .limit(limit)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break

        for row in rows:
            scanned += 1
            last_id = row.get("id") or last_id

            source = norm_text(str(row.get("source") or "")).lower()
            if source not in REMOTE_SOURCES:
                skipped += 1
                continue

            signals = row.get("benefits") or []
            if not isinstance(signals, list):
                signals = []
            normalized_signals = [str(tag) for tag in signals]
            next_work_model = infer_work_model(row.get("location"), row.get("description"), normalized_signals, row.get("title"))
            next_country_code = infer_country_code(
                row.get("location"),
                source,
                next_work_model,
                row.get("description"),
                row.get("title"),
                normalized_signals,
            )

            patch = {}
            if row.get("work_model") != next_work_model:
                patch["work_model"] = next_work_model
            if row.get("work_type") != next_work_model:
                patch["work_type"] = next_work_model
            raw_country_code = norm_text(str(row.get("country_code") or "")) or None
            current_country_code = normalize_jobs_country_code(raw_country_code)
            if next_country_code and (current_country_code != next_country_code or raw_country_code != next_country_code):
                patch["country_code"] = next_country_code
            elif raw_country_code and current_country_code != raw_country_code:
                patch["country_code"] = current_country_code
            elif source == "weworkremotely.com" and raw_country_code and not next_country_code:
                patch["country_code"] = None
            if next_work_model == "Remote" and (row.get("lat") is not None or row.get("lng") is not None):
                patch["lat"] = None
                patch["lng"] = None

            if not patch:
                skipped += 1
                continue

            if dry_run:
                print(f"🧪 {row['id']}: would update {patch}")
            else:
                try:
                    supabase.table("jobs").update(patch).eq("id", row["id"]).execute()
                    print(f"✅ {row['id']}: updated {patch}")
                    updated += 1
                except Exception as exc:
                    print(f"❌ {row['id']}: update failed: {exc}")

            if sleep_seconds > 0:
                time.sleep(sleep_seconds)

        print(f"📦 Batch done. scanned={scanned} updated={updated} skipped={skipped}")

    print(f"🏁 Remote import metadata backfill done. scanned={scanned} updated={updated} skipped={skipped}")
    return {"scanned": scanned, "updated": updated, "skipped": skipped}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill remote import metadata for API/RSS job sources.")
    parser.add_argument("--apply", action="store_true", help="Persist changes. Default is dry-run.")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--sleep-seconds", type=float, default=DEFAULT_SLEEP_SECONDS)
    parser.add_argument("--start-id", type=int, default=0)
    parser.add_argument("--max-rows", type=int, default=100000)
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    backfill(
        dry_run=not args.apply,
        batch_size=args.batch_size,
        sleep_seconds=args.sleep_seconds,
        start_id=args.start_id,
        max_rows=args.max_rows,
    )
