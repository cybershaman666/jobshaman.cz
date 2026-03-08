import argparse
import os
import sys
import time
from typing import Iterable, Optional

# Allow importing from backend root and scraper helpers.
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, "scraper"))

from scraper_base import get_supabase_client, norm_text  # type: ignore


DEFAULT_BATCH_SIZE = int(os.getenv("BACKFILL_REMOTE_BATCH_SIZE", "200"))
DEFAULT_SLEEP_SECONDS = float(os.getenv("BACKFILL_REMOTE_SLEEP_SECONDS", "0.1"))
REMOTE_SOURCES = {"weworkremotely.com", "arbeitnow.com", "www.arbeitnow.com"}


def infer_work_model(location: Optional[str], description: Optional[str], tags: Iterable[str], title: Optional[str]) -> str:
    haystack = f"{location or ''} {description or ''} {' '.join(tags)} {title or ''}".lower()
    if "hybrid" in haystack:
        return "Hybrid"
    if any(token in haystack for token in ["remote", "remote first", "anywhere", "work from home", "distributed", "home office", "worldwide"]):
        return "Remote"
    return "On-site"


def infer_country_code(location: Optional[str], source: Optional[str], work_model: str) -> Optional[str]:
    haystack = f"{location or ''} {source or ''} {work_model}".lower()
    if any(token in haystack for token in ["austria", "österreich", "vienna", "wien"]):
        return "at"
    if any(token in haystack for token in ["germany", "deutschland", "berlin", "munich", "münchen"]):
        return "de"
    if any(token in haystack for token in ["poland", "polska", "warsaw", "krakow"]):
        return "pl"
    if any(token in haystack for token in ["slovakia", "slovensko", "bratislava"]):
        return "sk"
    if any(token in haystack for token in ["czech", "česko", "cesko", "prague", "praha"]):
        return "cs"
    if work_model == "Remote" and any(token in haystack for token in ["weworkremotely", "arbeitnow", "europe", "emea", "worldwide", "anywhere"]):
        return "de"
    return None


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
            .select("id,source,title,location,description,tags,work_model,work_type,country_code,lat,lng")
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

            tags = row.get("tags") or []
            if not isinstance(tags, list):
                tags = []
            next_work_model = infer_work_model(row.get("location"), row.get("description"), [str(tag) for tag in tags], row.get("title"))
            next_country_code = infer_country_code(row.get("location"), source, next_work_model) or row.get("country_code")

            patch = {}
            if row.get("work_model") != next_work_model:
                patch["work_model"] = next_work_model
            if row.get("work_type") != next_work_model:
                patch["work_type"] = next_work_model
            if next_country_code and row.get("country_code") != next_country_code:
                patch["country_code"] = next_country_code
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
