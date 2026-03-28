from typing import Any

from .jobs_postgres_store import get_job_by_id, get_jobs_by_ids, list_company_jobs, list_jobs_by_posted_by


_INACTIVE_JOB_STATUSES = {"closed", "paused", "archived"}


def normalize_job_id(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    if text.lower().startswith("db-"):
        text = text[3:]
    return int(text) if text.isdigit() else None


def canonical_job_id(value: Any) -> str:
    normalized = normalize_job_id(value)
    if isinstance(normalized, int):
        return str(normalized)
    return str(value or "").strip()


def read_primary_job_record(job_id: Any) -> dict[str, Any] | None:
    normalized_job_id = normalize_job_id(job_id)
    if not isinstance(normalized_job_id, int):
        return None
    row = get_job_by_id(normalized_job_id)
    return dict(row) if isinstance(row, dict) and row else None


def job_exists_in_primary_store(job_id: Any) -> bool:
    return isinstance(read_primary_job_record(job_id), dict)


def serialize_job_reference(job_row: dict[str, Any] | None) -> dict[str, Any]:
    source = job_row if isinstance(job_row, dict) else {}
    if not source:
        return {}
    return {
        "id": source.get("id"),
        "title": _trimmed_text(source.get("title"), 200) or None,
        "company": _trimmed_text(source.get("company"), 200) or None,
        "location": _trimmed_text(source.get("location") or source.get("workplace_address"), 200) or None,
        "url": _trimmed_text(source.get("url"), 500) or None,
        "source": _trimmed_text(source.get("source"), 120) or None,
        "contact_email": _trimmed_text(source.get("contact_email"), 200) or None,
        "description": _trimmed_text(source.get("description"), 8000) or None,
    }


def hydrate_rows_with_primary_jobs(
    rows: list[dict[str, Any]] | None,
    *,
    row_job_key: str = "job_id",
    target_key: str = "jobs",
) -> list[dict[str, Any]]:
    normalized_rows = [row for row in (rows or []) if isinstance(row, dict)]
    if not normalized_rows:
        return []

    requested_job_ids: list[int] = []
    jobs_by_id: dict[str, dict[str, Any]] = {}
    for row in normalized_rows:
        canonical_id = canonical_job_id(row.get(row_job_key))
        if not canonical_id:
            continue
        existing_ref = row.get(target_key)
        if isinstance(existing_ref, dict) and existing_ref.get("title"):
            jobs_by_id[canonical_id] = dict(existing_ref)
            continue
        normalized_id = normalize_job_id(canonical_id)
        if isinstance(normalized_id, int):
            requested_job_ids.append(normalized_id)

    if requested_job_ids:
        for job_row in get_jobs_by_ids(list(dict.fromkeys(requested_job_ids))):
            canonical_id = canonical_job_id((job_row or {}).get("id"))
            serialized = serialize_job_reference(job_row if isinstance(job_row, dict) else None)
            if canonical_id and serialized:
                jobs_by_id[canonical_id] = serialized

    enriched_rows: list[dict[str, Any]] = []
    for row in normalized_rows:
        enriched = dict(row)
        canonical_id = canonical_job_id(row.get(row_job_key))
        if canonical_id and jobs_by_id.get(canonical_id):
            enriched[target_key] = dict(jobs_by_id[canonical_id])
        elif target_key not in enriched:
            enriched[target_key] = {}
        enriched_rows.append(enriched)
    return enriched_rows


def count_company_active_jobs(company_id: str, *, exclude_job_id: Any = None) -> int:
    normalized_company_id = str(company_id or "").strip()
    if not normalized_company_id:
        return 0
    normalized_exclude = canonical_job_id(exclude_job_id)
    total = 0
    for row in list_company_jobs(company_id=normalized_company_id, limit=5000):
        row_id = canonical_job_id((row or {}).get("id"))
        if normalized_exclude and row_id == normalized_exclude:
            continue
        status = str((row or {}).get("status") or "active").strip().lower() or "active"
        if status in _INACTIVE_JOB_STATUSES:
            continue
        total += 1
    return total


def list_company_job_ids(company_id: str, *, job_id: Any = None, limit: int = 5000) -> list[int]:
    normalized_company_id = str(company_id or "").strip()
    if not normalized_company_id:
        return []
    requested_job_id = normalize_job_id(job_id)
    ids: list[int] = []
    for row in list_company_jobs(company_id=normalized_company_id, limit=limit):
        normalized_id = normalize_job_id((row or {}).get("id"))
        if not isinstance(normalized_id, int):
            continue
        if isinstance(requested_job_id, int) and normalized_id != requested_job_id:
            continue
        ids.append(normalized_id)
    return ids


def list_publisher_jobs(user_id: str, *, limit: int = 80, challenge_format: str | None = None) -> list[dict[str, Any]]:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return []
    rows = list_jobs_by_posted_by(
        posted_by=normalized_user_id,
        limit=limit,
        challenge_format=challenge_format,
    )
    return [dict(row) for row in rows if isinstance(row, dict)]


def _trimmed_text(value: Any, max_length: int) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text[:max(1, int(max_length))]
