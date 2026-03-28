from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

from ..core.limiter import limiter
from ..matching_engine.retrieval import ensure_job_embeddings, fetch_recent_jobs
from ..matching_engine.scoring import score_from_embeddings
from ..services.jobs_interactions_runtime import _attach_job_dialogue_preview_metrics
from ..services.jobs_postgres_store import get_job_by_id, get_jobs_by_ids, list_company_jobs
from ..services.jobs_shared import (
    _JOB_PUBLIC_PERSON_MAX_RESPONDERS,
    _NATIVE_JOB_SOURCE,
    _first_non_empty_text,
    _normalize_job_id,
    _read_job_record,
    _trimmed_text,
)
from .jobs import (
    _compute_company_human_context_trust,
    _empty_job_human_context_payload,
    _load_valid_job_public_people,
    _serialize_job_public_person,
)

router = APIRouter()


@router.post("/jobs/lookup")
@limiter.limit("120/minute")
async def lookup_jobs_catalog(
    payload: dict[str, Any],
    request: Request,
):
    ids = payload.get("ids") if isinstance(payload, dict) else []
    if not isinstance(ids, list):
        ids = []
    normalized_ids: list[int] = []
    seen: set[int] = set()
    for value in ids[:200]:
        normalized = _normalize_job_id(value)
        if not isinstance(normalized, int) or normalized in seen:
            continue
        seen.add(normalized)
        normalized_ids.append(normalized)
    if not normalized_ids:
        return {"jobs": []}
    rows = get_jobs_by_ids(normalized_ids)
    _attach_job_dialogue_preview_metrics(rows)
    return {"jobs": rows}


@router.get("/jobs/by-company/{company_id}")
@limiter.limit("120/minute")
async def get_jobs_for_company_public_catalog(
    company_id: str,
    request: Request,
    limit: int = Query(20, ge=1, le=100),
):
    rows = list_company_jobs(company_id=company_id, limit=limit)
    filtered: list[dict[str, Any]] = []
    for row in rows:
        status = str(row.get("status") or "active").strip().lower()
        if status == "archived":
            continue
        filtered.append(row)
    _attach_job_dialogue_preview_metrics(filtered)
    return {"jobs": filtered[:limit]}


@router.get("/jobs/{job_id}")
@limiter.limit("240/minute")
async def get_job_detail_catalog(
    job_id: str,
    request: Request,
):
    payload = get_job_by_id(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Job not found")

    row = dict(payload)
    _attach_job_dialogue_preview_metrics([row])
    return row


@router.get("/jobs/{job_id}/human-context")
@limiter.limit("120/minute")
async def get_job_human_context_catalog(
    job_id: str,
    request: Request,
):
    normalized_job_id = _normalize_job_id(job_id)
    job_row = _read_job_record(normalized_job_id)
    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    company_id = str(job_row.get("company_id") or "").strip()
    source = str(job_row.get("source") or "").strip().lower()
    if not company_id or source != _NATIVE_JOB_SOURCE:
        return _empty_job_human_context_payload()

    rows = _load_valid_job_public_people(job_id, company_id)
    publisher = None
    responders: list[dict[str, Any]] = []
    for row in rows:
        serialized = _serialize_job_public_person(row)
        if serialized.get("person_kind") == "publisher" and publisher is None:
            publisher = serialized
            continue
        if serialized.get("person_kind") == "responder" and len(responders) < _JOB_PUBLIC_PERSON_MAX_RESPONDERS:
            responders.append(serialized)

    return {
        "publisher": publisher,
        "responders": responders,
        "trust": _compute_company_human_context_trust(company_id),
    }


@router.get("/jobs/{job_id}/related")
@limiter.limit("120/minute")
async def get_related_job_challenges_catalog(
    job_id: str,
    request: Request,
    limit: int = Query(4, ge=1, le=8),
):
    normalized_job_id = _normalize_job_id(job_id)
    source_job = _read_job_record(normalized_job_id)
    if not source_job:
        raise HTTPException(status_code=404, detail="Job not found")

    recent_jobs = fetch_recent_jobs(limit=300, days=120)
    source_job_id = str(source_job.get("id") or normalized_job_id)
    candidate_rows: list[dict[str, Any]] = []
    seen_ids: set[str] = {source_job_id}

    for row in recent_jobs:
        candidate_id = str((row or {}).get("id") or "").strip()
        if not candidate_id or candidate_id in seen_ids:
            continue
        seen_ids.add(candidate_id)
        candidate_rows.append(row)

    if not candidate_rows:
        return {"items": []}

    embeddings = ensure_job_embeddings([source_job, *candidate_rows], persist=False)
    source_embedding = embeddings.get(source_job_id) or []
    if not source_embedding:
        return {"items": []}

    source_work_model = str(source_job.get("work_model") or source_job.get("type") or "").strip().lower()
    source_location = str(source_job.get("location") or "").strip().lower()
    source_company_id = str(source_job.get("company_id") or "").strip()

    scored_items: list[dict[str, Any]] = []
    for row in candidate_rows:
        candidate_id = str((row or {}).get("id") or "").strip()
        candidate_embedding = embeddings.get(candidate_id) or []
        if not candidate_embedding:
            continue

        similarity_score = float(score_from_embeddings(source_embedding, candidate_embedding))
        work_model = str((row or {}).get("work_model") or (row or {}).get("type") or "").strip().lower()
        location = str((row or {}).get("location") or "").strip().lower()
        company_id = str((row or {}).get("company_id") or "").strip()

        if source_work_model and work_model and source_work_model == work_model:
            similarity_score += 0.06
        if source_location and location and source_location == location:
            similarity_score += 0.04
        if source_company_id and company_id and source_company_id == company_id:
            similarity_score += 0.03

        preview = _first_non_empty_text(
            (row or {}).get("role_summary"),
            (row or {}).get("description"),
            limit=220,
        )
        if not preview:
            preview = _first_non_empty_text((row or {}).get("title"), limit=220)

        scored_items.append(
            {
                "id": candidate_id,
                "title": _first_non_empty_text((row or {}).get("title"), limit=160) or "Untitled role",
                "company": _first_non_empty_text((row or {}).get("company"), limit=160) or "Unknown company",
                "location": _first_non_empty_text((row or {}).get("location"), limit=120),
                "work_model": _trimmed_text((row or {}).get("work_model"), 80) or None,
                "source": _trimmed_text((row or {}).get("source"), 80) or None,
                "preview": preview,
                "similarity_score": round(similarity_score, 4),
            }
        )

    scored_items.sort(key=lambda item: item.get("similarity_score") or 0.0, reverse=True)
    return {"items": scored_items[:limit]}
