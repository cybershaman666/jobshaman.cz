import os
import sys
import time
from typing import Optional

# Allow importing from backend/scraper
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scraper_dir = os.path.join(backend_dir, "scraper")
sys.path.insert(0, backend_dir)
sys.path.insert(0, scraper_dir)

from scraper_base import get_supabase_client, detect_language_code  # type: ignore


BATCH_SIZE = int(os.getenv("BACKFILL_BATCH_SIZE", "200"))
SLEEP_SECONDS = float(os.getenv("BACKFILL_SLEEP_SECONDS", "0.2"))


def detect_for_job(title: Optional[str], description: Optional[str]) -> Optional[str]:
    text = f"{title or ''} {description or ''}".strip()
    return detect_language_code(text)


def backfill() -> None:
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Supabase klient není dostupný.")
        return

    last_id = 0
    total_scanned = 0
    total_updated = 0
    total_skipped = 0

    print("🚀 Backfill language_code: start")

    while True:
        # Fetch next batch of jobs without language_code
        res = (
            supabase
            .table("jobs")
            .select("id,title,description")
            .is_("language_code", "null")
            .gt("id", last_id)
            .order("id", desc=False)
            .limit(BATCH_SIZE)
            .execute()
        )

        rows = res.data or []
        if not rows:
            break

        for row in rows:
            total_scanned += 1
            job_id = row.get("id")
            lang = detect_for_job(row.get("title"), row.get("description"))

            if not lang:
                total_skipped += 1
                last_id = job_id
                continue

            try:
                supabase.table("jobs").update({"language_code": lang}).eq("id", job_id).execute()
                total_updated += 1
                print(f"✅ {job_id} -> {lang}")
            except Exception as e:
                print(f"❌ Update failed for {job_id}: {e}")

            last_id = job_id
            if SLEEP_SECONDS > 0:
                time.sleep(SLEEP_SECONDS)

        print(f"📦 Batch done. scanned={total_scanned} updated={total_updated} skipped={total_skipped}")

    print(f"🏁 Backfill done. scanned={total_scanned} updated={total_updated} skipped={total_skipped}")


if __name__ == "__main__":
    backfill()
