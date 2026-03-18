from __future__ import annotations

from typing import Any

from ..core.database import supabase
from .jobs_postgres_store import backfill_jobs_from_documents, jobs_postgres_enabled


def backfill_jobs_postgres_from_supabase(
    *,
    limit: int = 5000,
    batch_size: int = 500,
    only_active: bool = True,
) -> dict[str, Any]:
    if not jobs_postgres_enabled():
        return {
            "jobs_postgres_enabled": False,
            "scanned": 0,
            "imported": 0,
            "upserted": 0,
            "matched": 0,
        }
    if not supabase:
        return {
            "jobs_postgres_enabled": True,
            "supabase_available": False,
            "scanned": 0,
            "imported": 0,
            "upserted": 0,
            "matched": 0,
        }

    safe_limit = max(1, int(limit or 5000))
    safe_batch_size = max(1, min(1000, int(batch_size or 500)))
    scanned = 0
    imported = 0
    upserted = 0
    matched = 0
    offset = 0

    while scanned < safe_limit:
        batch_limit = min(safe_batch_size, safe_limit - scanned)
        query = (
            supabase.table("jobs")
            .select("*")
            .order("scraped_at", desc=True)
            .range(offset, offset + batch_limit - 1)
        )
        if only_active:
            query = query.eq("status", "active")
        response = query.execute()
        rows = response.data or []
        if not rows:
            break

        scanned += len(rows)
        result = backfill_jobs_from_documents([dict(row) for row in rows if isinstance(row, dict)])
        imported += int(result.get("imported_count") or 0)
        upserted += int(result.get("upserted_count") or 0)
        matched += int(result.get("matched_count") or 0)

        if len(rows) < batch_limit:
            break
        offset += len(rows)

    return {
        "jobs_postgres_enabled": True,
        "supabase_available": True,
        "scanned": scanned,
        "imported": imported,
        "upserted": upserted,
        "matched": matched,
        "limit": safe_limit,
        "batch_size": safe_batch_size,
        "only_active": bool(only_active),
        "source_table": "jobs",
    }
