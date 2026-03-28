import random
from typing import Any, cast

from fastapi import HTTPException

from ..core.database import supabase
from ..core.security import require_company_access
from ..services.job_catalog import (
    hydrate_rows_with_primary_jobs as hydrate_rows_with_primary_jobs_main,
    job_exists_in_primary_store,
    read_primary_job_record,
    serialize_job_reference,
)
from ..services.jobs_postgres_store import update_job_fields
from ..services.subscription_access import (
    fetch_latest_subscription_by,
    is_active_subscription,
    user_has_allowed_subscription,
)
from ..utils.helpers import now_iso

_NATIVE_JOB_SOURCE = "jobshaman.cz"
_JOB_PUBLIC_PERSON_MAX_RESPONDERS = 3


def _is_missing_table_error(exc: Exception, table_name: str) -> bool:
    msg = str(exc).lower()
    return ("pgrst205" in msg and table_name.lower() in msg) or f"table '{table_name.lower()}'" in msg


def _is_missing_column_error(exc: Exception, column_name: str) -> bool:
    msg = str(exc).lower()
    return column_name.lower() in msg and ("does not exist" in msg or "column" in msg)


def _is_missing_relationship_error(exc: Exception, left_table: str, right_table: str) -> bool:
    msg = str(exc).lower()
    if "pgrst200" not in msg:
        return False
    left = left_table.lower()
    right = right_table.lower()
    return f"relationship between '{left}' and '{right}'" in msg or f"relationship between '{right}' and '{left}'" in msg


def _normalize_job_id(job_id: Any) -> int | str:
    raw = str(job_id or "").strip()
    if raw.startswith("db-"):
        raw = raw[3:]
    return int(raw) if raw.isdigit() else raw


def _canonical_job_id(job_id: Any) -> str:
    if job_id is None:
        return ""
    value = str(job_id).strip()
    if not value:
        return ""
    return value


def _safe_positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(value)
    except Exception:
        return fallback
    return parsed if parsed > 0 else fallback


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_row(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _safe_rows(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _string_list_from_json(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _read_job_record(job_id: Any) -> dict[str, Any] | None:
    return read_primary_job_record(job_id)


def _safe_string_list(value: Any, limit: int = 12) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = str(item or "").strip()
        if text:
            out.append(text[:300])
        if len(out) >= limit:
            break
    return out


def _trimmed_text(value: Any, limit: int = 240) -> str:
    return str(value or "").strip()[:limit]


def _normalize_locale(value: Any, fallback: str = "en") -> str:
    locale = str(value or fallback).split("-", 1)[0].strip().lower()
    if locale == "at":
        return "de"
    return locale if locale in {"cs", "sk", "de", "pl", "en"} else fallback


def _first_non_empty_text(*values: Any, limit: int = 220) -> str:
    for value in values:
        text = _trimmed_text(value, limit)
        if text:
            return text
    return ""


def _parse_optional_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except Exception:
        return None


def _sync_main_job_to_jobs_postgres(job_row: dict[str, Any] | None, *, source_kind: str = "native") -> None:
    if not isinstance(job_row, dict) or not job_row:
        return
    payload = dict(job_row)
    payload["source_kind"] = source_kind
    payload.setdefault("source", _NATIVE_JOB_SOURCE)
    payload.setdefault("scraped_at", payload.get("updated_at") or payload.get("created_at") or now_iso())
    payload.setdefault("created_at", payload.get("scraped_at"))
    payload["updated_at"] = payload.get("updated_at") or now_iso()
    try:
        updated = update_job_fields(payload.get("id"), payload)
        if updated:
            return
    except Exception:
        pass
    from ..services.jobs_postgres_store import backfill_jobs_from_documents

    backfill_jobs_from_documents([payload])


def _job_shadow_is_active(status: str, explicit: Any = None) -> bool:
    if explicit is not None:
        return bool(explicit)
    return status not in {"paused", "closed", "archived"}


def _normalize_supabase_job_shadow_payload(job_row: dict[str, Any]) -> dict[str, Any]:
    normalized_id = _normalize_job_id(job_row.get("id"))
    if not isinstance(normalized_id, int):
        raise ValueError("Supabase jobs shadow requires a numeric job id")

    status = str(job_row.get("status") or "active").strip().lower() or "active"
    benefits = job_row.get("benefits")
    if not isinstance(benefits, list):
        benefits = []

    return {
        "id": normalized_id,
        "title": str(job_row.get("title") or "").strip(),
        "url": str(job_row.get("url") or "").strip() or None,
        "company": str(job_row.get("company") or "").strip() or None,
        "location": str(job_row.get("location") or job_row.get("workplace_address") or "").strip() or None,
        "description": str(job_row.get("description") or "").strip() or None,
        "benefits": benefits,
        "contract_type": job_row.get("contract_type"),
        "salary_from": _parse_optional_int(job_row.get("salary_from")),
        "salary_to": _parse_optional_int(job_row.get("salary_to")),
        "work_type": job_row.get("work_type") or job_row.get("work_model"),
        "education_level": job_row.get("education_level"),
        "source": job_row.get("source") or _NATIVE_JOB_SOURCE,
        "scraped_at": job_row.get("scraped_at") or job_row.get("updated_at") or now_iso(),
        "company_id": job_row.get("company_id"),
        "recruiter_id": job_row.get("recruiter_id"),
        "is_active": _job_shadow_is_active(status, job_row.get("is_active")),
        "currency": job_row.get("currency") or job_row.get("salary_currency") or "CZK",
        "lat": job_row.get("lat"),
        "lng": job_row.get("lng"),
        "legality_status": str(job_row.get("legality_status") or "legal"),
        "verification_notes": job_row.get("verification_notes"),
        "posted_by": job_row.get("posted_by"),
        "country_code": job_row.get("country_code"),
        "ai_analysis": job_row.get("ai_analysis"),
        "updated_at": job_row.get("updated_at") or now_iso(),
        "work_model": job_row.get("work_model") or job_row.get("work_type"),
        "salary_currency": job_row.get("salary_currency") or job_row.get("currency") or "CZK",
        "salary_timeframe": job_row.get("salary_timeframe"),
        "language_code": job_row.get("language_code"),
        "status": status,
        "contact_email": job_row.get("contact_email"),
        "workplace_address": job_row.get("workplace_address"),
        "created_at": job_row.get("created_at") or job_row.get("scraped_at") or now_iso(),
    }


def _sync_main_job_shadow_to_supabase(job_row: dict[str, Any], *, create_if_missing: bool = True) -> bool:
    if not supabase or not isinstance(job_row, dict) or not job_row:
        return False
    payload = _normalize_supabase_job_shadow_payload(job_row)
    normalized_id = cast(int, payload["id"])
    try:
        existing_resp = supabase.table("jobs").select("id").eq("id", normalized_id).maybe_single().execute()
        existing = _safe_row(existing_resp.data if existing_resp else None)
        if existing:
            update_payload = dict(payload)
            update_payload.pop("id", None)
            supabase.table("jobs").update(update_payload).eq("id", normalized_id).execute()
            return True
        if not create_if_missing:
            return False
        supabase.table("jobs").insert(payload).execute()
        return True
    except Exception as exc:
        print(f"⚠️ Failed to sync job {normalized_id} to Supabase jobs shadow: {exc}")
        return False


def _serialize_job_reference_for_dialogues(job_row: dict[str, Any] | None) -> dict[str, Any]:
    return serialize_job_reference(job_row)


def _hydrate_rows_with_primary_jobs(
    rows: list[dict[str, Any]] | None,
    *,
    row_job_key: str = "job_id",
    target_key: str = "jobs",
) -> list[dict[str, Any]]:
    return hydrate_rows_with_primary_jobs_main(rows, row_job_key=row_job_key, target_key=target_key)


def _delete_main_job_shadow_from_supabase(job_id: Any) -> bool:
    normalized_id = _normalize_job_id(job_id)
    if not supabase or not isinstance(normalized_id, int):
        return False
    try:
        supabase.table("jobs").delete().eq("id", normalized_id).execute()
        return True
    except Exception as exc:
        print(f"⚠️ Failed to delete job {normalized_id} from Supabase jobs shadow: {exc}")
        return False


def _job_id_exists_in_any_store(job_id: int) -> bool:
    return job_exists_in_primary_store(job_id)


def _generate_native_job_id() -> int:
    lower_bound = 1_800_000_000
    upper_bound = 2_100_000_000
    for _ in range(64):
        candidate = random.randint(lower_bound, upper_bound)
        if not _job_id_exists_in_any_store(candidate):
            return candidate
    raise RuntimeError("Unable to allocate a unique native job id")


def _user_has_allowed_subscription(user: dict, allowed_tiers: set[str]) -> bool:
    return user_has_allowed_subscription(user, allowed_tiers)


def _fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    return fetch_latest_subscription_by(column, value)


def _is_active_subscription(sub: dict | None) -> bool:
    return is_active_subscription(sub)


def _user_has_direct_premium(user: dict) -> bool:
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier == "premium":
        return True
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        return False
    user_sub = _fetch_latest_subscription_by("user_id", user_id)
    return bool(user_sub and is_active_subscription(user_sub) and (user_sub.get("tier") or "").lower() == "premium")


def _require_company_tier(user: dict, company_id: str, allowed_tiers: set[str]) -> str:
    fast_tier = (user.get("subscription_tier") or "").lower()
    if company_id == str(user.get("company_id") or "") and user.get("is_subscription_active") and fast_tier in allowed_tiers:
        return fast_tier

    company_sub = _fetch_latest_subscription_by("company_id", company_id)
    if not company_sub or not _is_active_subscription(company_sub):
        if "free" in allowed_tiers:
            return "free"
        raise HTTPException(status_code=403, detail="Active subscription required")

    tier = (company_sub.get("tier") or "free").lower()
    if tier not in allowed_tiers:
        raise HTTPException(status_code=403, detail="Current plan does not include this feature")
    return tier


def _require_job_access(user: dict, job_id: str) -> dict[str, Any]:
    job_id_norm = _normalize_job_id(job_id)
    job_row = _safe_row(_read_job_record(job_id_norm))
    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    company_id = job_row.get("company_id")
    if company_id:
        require_company_access(user, company_id)
        return job_row

    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    posted_by = str(job_row.get("posted_by") or "").strip()
    recruiter_id = str(job_row.get("recruiter_id") or "").strip()
    if user_id and user_id in {posted_by, recruiter_id}:
        return job_row

    raise HTTPException(status_code=403, detail="Unauthorized")


def _require_dialogue_publisher_access(user: dict, row: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(row, dict):
        raise HTTPException(status_code=404, detail="Dialogue not found")

    company_id = str(row.get("company_id") or "").strip()
    if company_id:
        require_company_access(user, company_id)
        return _read_job_record(row.get("job_id")) or {}

    job_id = row.get("job_id")
    if job_id is None:
        raise HTTPException(status_code=404, detail="Dialogue is missing a linked role.")
    return _require_job_access(user, str(job_id))
