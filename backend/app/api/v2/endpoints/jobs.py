from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.legacy_supabase import get_legacy_supabase_client
from app.core.security import AccessControlService
from app.domains.reality.service import RealityDomainService

router = APIRouter()

INTERACTION_STATE_EVENTS = ["save", "unsave", "swipe_left", "swipe_right"]
ALLOWED_INTERACTION_EVENTS = {
    "impression",
    "swipe_left",
    "swipe_right",
    "open_detail",
    "apply_click",
    "save",
    "unsave",
}


class JobInteractionRequest(BaseModel):
    job_id: int | str
    event_type: str
    dwell_time_ms: int | None = None
    session_id: str | None = None
    request_id: str | None = None
    signal_value: float | None = None
    scroll_depth: float | None = None
    scoring_version: str | None = None
    model_version: str | None = None
    metadata: Dict[str, Any] | None = None


class JobInteractionStateSyncRequest(BaseModel):
    saved_job_ids: List[int | str] = Field(default_factory=list)
    dismissed_job_ids: List[int | str] = Field(default_factory=list)
    client_updated_at: str | None = None
    source: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_job_id(value: Any) -> int | None:
    try:
        normalized = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return normalized if normalized > 0 else None


def _normalize_job_id_set(values: list[int | str] | None) -> set[int]:
    normalized: set[int] = set()
    for value in values or []:
        job_id = _normalize_job_id(value)
        if job_id is not None:
            normalized.add(job_id)
    return normalized


def _fetch_interaction_state(user_id: str, limit: int = 5000) -> tuple[list[str], list[str]]:
    client = get_legacy_supabase_client()
    if not client or not user_id:
        return [], []
    try:
        response = (
            client.table("job_interactions")
            .select("job_id,event_type,created_at")
            .eq("user_id", user_id)
            .in_("event_type", INTERACTION_STATE_EVENTS)
            .order("created_at", desc=True)
            .limit(max(1, min(20000, int(limit or 5000))))
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load interaction state: {exc}") from exc

    saved_state_by_job: dict[str, bool] = {}
    dismissed_state_by_job: dict[str, bool] = {}
    for row in response.data or []:
        job_id = str(row.get("job_id") or "").strip()
        if not job_id:
            continue
        event_type = str(row.get("event_type") or "").strip().lower()
        if job_id not in saved_state_by_job and event_type in {"save", "unsave", "swipe_right"}:
            saved_state_by_job[job_id] = event_type in {"save", "swipe_right"}
        if job_id not in dismissed_state_by_job and event_type in {"swipe_left", "save", "unsave", "swipe_right"}:
            dismissed_state_by_job[job_id] = event_type == "swipe_left"

    saved_job_ids = sorted([job_id for job_id, is_saved in saved_state_by_job.items() if is_saved])
    saved_set = set(saved_job_ids)
    dismissed_job_ids = sorted(
        [job_id for job_id, is_dismissed in dismissed_state_by_job.items() if is_dismissed and job_id not in saved_set]
    )
    return saved_job_ids, dismissed_job_ids


def _insert_interaction_rows(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    client = get_legacy_supabase_client()
    if not client:
        raise HTTPException(status_code=503, detail="Supabase client is not configured")
    try:
        client.table("job_interactions").insert(rows).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to write interactions: {exc}") from exc

@router.get("/")
async def get_jobs(
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    country: str | None = Query(None),
    q: str | None = Query(None, max_length=200),
    city: str | None = Query(None, max_length=120),
    min_salary: int | None = Query(None, ge=0),
    benefits: str | None = Query(None, max_length=500),
    work_arrangement: str | None = Query(None, max_length=20),
) -> Dict[str, Any]:
    """
    Public endpoint to list active jobs.
    In V2, this fetches from Northflank Postgres.
    """
    return await RealityDomainService.list_active_jobs_page(
        limit=limit,
        offset=offset,
        country=country,
        query=q,
        city=city,
        min_salary=min_salary,
        benefits=[item.strip() for item in str(benefits or "").split(",") if item.strip()],
        work_arrangement=work_arrangement,
    )


@router.post("/interactions")
async def log_job_interaction(
    payload: JobInteractionRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
) -> Dict[str, Any]:
    job_id = _normalize_job_id(payload.job_id)
    event_type = str(payload.event_type or "").strip().lower()
    if job_id is None:
        raise HTTPException(status_code=400, detail="Invalid job_id")
    if event_type not in ALLOWED_INTERACTION_EVENTS:
        raise HTTPException(status_code=400, detail="Invalid event_type")

    metadata = payload.metadata or {}
    if payload.request_id:
        metadata.setdefault("request_id", payload.request_id)
    if payload.signal_value is not None:
        metadata.setdefault("signal_value", payload.signal_value)
    if payload.scroll_depth is not None:
        metadata.setdefault("scroll_depth", payload.scroll_depth)
    if payload.scoring_version:
        metadata.setdefault("scoring_version", payload.scoring_version)
    if payload.model_version:
        metadata.setdefault("model_version", payload.model_version)

    _insert_interaction_rows([
        {
            "user_id": current_user["id"],
            "job_id": job_id,
            "event_type": event_type,
            "dwell_time_ms": payload.dwell_time_ms,
            "session_id": payload.session_id,
            "metadata": metadata,
        }
    ])
    return {"status": "success"}


@router.get("/interactions/state")
async def get_job_interaction_state(
    limit: int = Query(5000, ge=1, le=20000),
    current_user: dict = Depends(AccessControlService.get_current_user),
) -> Dict[str, Any]:
    saved_job_ids, dismissed_job_ids = _fetch_interaction_state(current_user["id"], limit=limit)
    return {
        "saved_job_ids": saved_job_ids,
        "dismissed_job_ids": dismissed_job_ids,
    }


@router.post("/interactions/state/sync")
async def sync_job_interaction_state(
    payload: JobInteractionStateSyncRequest,
    current_user: dict = Depends(AccessControlService.get_current_user),
) -> Dict[str, Any]:
    user_id = current_user["id"]
    client_saved = _normalize_job_id_set(payload.saved_job_ids)
    client_dismissed = _normalize_job_id_set(payload.dismissed_job_ids) - client_saved

    server_saved_raw, server_dismissed_raw = _fetch_interaction_state(user_id, limit=20000)
    server_saved = _normalize_job_id_set(server_saved_raw)
    server_dismissed = _normalize_job_id_set(server_dismissed_raw) - client_saved

    metadata = {
        "source": payload.source or "state_sync",
        "client_updated_at": payload.client_updated_at,
        "synced_at": _now_iso(),
    }

    rows: list[dict[str, Any]] = []
    for job_id in sorted(client_saved - server_saved):
        rows.append({"user_id": user_id, "job_id": job_id, "event_type": "save", "metadata": metadata})
    for job_id in sorted(server_saved - client_saved):
        rows.append({"user_id": user_id, "job_id": job_id, "event_type": "unsave", "metadata": metadata})
    for job_id in sorted(client_dismissed - server_dismissed):
        rows.append({"user_id": user_id, "job_id": job_id, "event_type": "swipe_left", "metadata": metadata})
    for job_id in sorted(server_dismissed - client_dismissed):
        rows.append({"user_id": user_id, "job_id": job_id, "event_type": "unsave", "metadata": metadata})

    _insert_interaction_rows(rows)
    saved_job_ids, dismissed_job_ids = _fetch_interaction_state(user_id, limit=20000)
    return {
        "saved_job_ids": saved_job_ids,
        "dismissed_job_ids": dismissed_job_ids,
        "updated_at": _now_iso(),
    }


@router.get("/{job_id}")
async def get_job(job_id: str) -> Dict[str, Any]:
    job = await RealityDomainService.get_job_details(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
