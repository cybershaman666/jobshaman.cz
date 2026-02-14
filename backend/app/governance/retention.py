from datetime import datetime, timedelta, timezone
from typing import Dict

from ..core.database import supabase


_SUPPORTED_TABLES = {
    "ai_generation_logs": "created_at",
    "ai_generation_diffs": "created_at",
    "recommendation_cache": "computed_at",
    "ai_conversion_metrics": "created_at",
}


def run_retention_cleanup() -> Dict[str, int]:
    if not supabase:
        return {}

    try:
        policies = (
            supabase.table("data_retention_policies")
            .select("table_name, retain_days, is_enabled")
            .eq("is_enabled", True)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        print(f"⚠️ [Retention] policy fetch failed: {exc}")
        return {}

    result: Dict[str, int] = {}
    now = datetime.now(timezone.utc)

    for policy in policies:
        table = policy.get("table_name")
        col = _SUPPORTED_TABLES.get(table)
        if not table or not col:
            continue

        days = int(policy.get("retain_days") or 0)
        if days <= 0:
            continue

        cutoff = (now - timedelta(days=days)).isoformat()
        try:
            delete_resp = supabase.table(table).delete().lt(col, cutoff).execute()
            deleted = len(delete_resp.data or []) if hasattr(delete_resp, "data") else 0
            result[table] = deleted
        except Exception as exc:
            print(f"⚠️ [Retention] cleanup failed for {table}: {exc}")
            result[table] = 0

    return result
