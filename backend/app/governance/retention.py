from datetime import datetime, timedelta, timezone
from typing import Dict, List

from ..core.database import supabase


_SUPPORTED_TABLES = {
    "ai_generation_logs": "created_at",
    "ai_generation_diffs": "created_at",
    "recommendation_cache": "computed_at",
    "ai_conversion_metrics": "created_at",
    "recommendation_exposures": "shown_at",
    "recommendation_feedback_events": "created_at",
    "model_offline_evaluations": "created_at",
    "search_exposures": "shown_at",
}
_ROW_CAP_SUPPORTED_TABLES = {"search_exposures"}
_ROW_CAP_BATCH_SIZE = 5000


def _fetch_policies() -> List[dict]:
    try:
        return (
            supabase.table("data_retention_policies")
            .select("table_name, retain_days, retain_rows, is_enabled")
            .eq("is_enabled", True)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        # Backward compatibility when retain_rows column is not present yet.
        if "retain_rows" in str(exc).lower():
            return (
                supabase.table("data_retention_policies")
                .select("table_name, retain_days, is_enabled")
                .eq("is_enabled", True)
                .execute()
                .data
                or []
            )
        raise


def _cleanup_table_by_row_cap(table: str, order_col: str, retain_rows: int) -> int:
    if retain_rows <= 0 or table not in _ROW_CAP_SUPPORTED_TABLES:
        return 0

    deleted_total = 0
    while True:
        rows = (
            supabase.table(table)
            .select("id")
            .order(order_col, desc=True)
            .order("id", desc=True)
            .range(retain_rows, retain_rows + _ROW_CAP_BATCH_SIZE - 1)
            .execute()
            .data
            or []
        )
        if not rows:
            break
        ids = [r.get("id") for r in rows if r.get("id") is not None]
        if not ids:
            break
        resp = supabase.table(table).delete().in_("id", ids).execute()
        deleted_total += len(resp.data or [])
        if len(rows) < _ROW_CAP_BATCH_SIZE:
            break
    return deleted_total


def run_retention_cleanup() -> Dict[str, int]:
    if not supabase:
        return {}

    try:
        policies = _fetch_policies()
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
        retain_rows = int(policy.get("retain_rows") or 0)
        try:
            deleted_total = 0
            if days > 0:
                cutoff = (now - timedelta(days=days)).isoformat()
                delete_resp = supabase.table(table).delete().lt(col, cutoff).execute()
                deleted_total += len(delete_resp.data or []) if hasattr(delete_resp, "data") else 0
            if retain_rows > 0:
                deleted_total += _cleanup_table_by_row_cap(table, col, retain_rows)
            if days > 0 or retain_rows > 0:
                result[table] = deleted_total
        except Exception as exc:
            print(f"⚠️ [Retention] cleanup failed for {table}: {exc}")
            result[table] = 0

    return result
