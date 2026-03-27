import requests
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response

from ..core import config
from ..core.database import supabase
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_csrf_token_header
from ..models.requests import (
    JobSignalBoostBriefRequest,
    JobSignalBoostEventRequest,
    JobSignalBoostOutputRequest,
    JobSignalBoostStarterRequest,
)
from ..services.job_signal_boost import (
    build_signal_boost_brief,
    build_signal_boost_recruiter_readout,
    build_signal_boost_starter_payload,
    build_signal_boost_summary,
    evaluate_signal_boost_quality,
)
from ..services.job_signal_boost_notifications import notify_candidate_of_signal_boost_interest
from ..services.job_signal_boost_store import (
    create_signal_output,
    get_latest_signal_output_for_job,
    get_signal_output_by_id,
    get_signal_output_by_share_slug,
    list_recent_signal_outputs_for_candidate,
    record_signal_output_event,
    signal_boost_store_enabled,
    update_signal_output,
)
from ..services.jobs_postgres_store import get_job_by_id
from ..utils.helpers import now_iso
from .jobs import (
    _fetch_candidate_profile_for_draft,
    _fetch_profile_identity,
    _normalize_job_id,
    _normalize_locale,
    _safe_dict,
    _safe_string_list,
    _trimmed_text,
)

router = APIRouter()


def _load_signal_boost_job_row(job_id: str) -> dict[str, Any] | None:
    normalized_job_id = _normalize_job_id(job_id)
    postgres_row = get_job_by_id(normalized_job_id)
    if isinstance(postgres_row, dict) and postgres_row:
        return postgres_row
    if not supabase:
        return None
    try:
        resp = (
            supabase
            .table("jobs")
            .select("*")
            .eq("id", normalized_job_id)
            .maybe_single()
            .execute()
        )
        row = resp.data if resp else None
        return row if isinstance(row, dict) else None
    except Exception as exc:
        print(f"⚠️ Failed to load Signal Boost job row for {job_id}: {exc}")
        return None


def _build_signal_boost_candidate_snapshot(user: dict, user_id: str) -> dict[str, Any]:
    candidate_profile = _fetch_candidate_profile_for_draft(user_id)
    profile_identity = _fetch_profile_identity(user_id)
    full_name = _trimmed_text(profile_identity.get("full_name"), 160)
    email = _trimmed_text(profile_identity.get("email") or user.get("email"), 200)
    headline = _trimmed_text(candidate_profile.get("job_title"), 160)
    avatar_url = _trimmed_text(
        candidate_profile.get("avatar_url")
        or candidate_profile.get("photo")
        or profile_identity.get("avatar_url"),
        2000,
    ) or None
    linkedin = _trimmed_text(candidate_profile.get("linkedin"), 2000) or None
    return {
        "name": full_name or (email.split("@", 1)[0] if email and "@" in email else "JobShaman member"),
        "jobTitle": headline or None,
        "avatar_url": avatar_url,
        "linkedin": linkedin,
        "skills": _safe_string_list(candidate_profile.get("skills"), limit=10),
        "preferredCountryCode": str(
            _safe_dict(candidate_profile.get("preferences")).get("preferredCountryCode")
            or candidate_profile.get("preferred_country_code")
            or ""
        ).strip().upper() or None,
    }


def _build_signal_boost_job_snapshot(job_row: dict[str, Any]) -> dict[str, Any]:
    listing_kind = str(job_row.get("listingKind") or job_row.get("source_kind") or "").strip().lower()
    source = str(job_row.get("source") or "").strip().lower()
    source_kind = "native" if "jobshaman" in source or listing_kind == "challenge" or str(job_row.get("company_id") or "").strip() else "imported"
    return {
        "id": str(job_row.get("id") or "").strip(),
        "title": _trimmed_text(job_row.get("title"), 200),
        "company": _trimmed_text(job_row.get("company"), 200),
        "location": _trimmed_text(job_row.get("location"), 160) or None,
        "url": _trimmed_text(job_row.get("url"), 800) or None,
        "company_id": _trimmed_text(job_row.get("company_id"), 120) or None,
        "source": _trimmed_text(job_row.get("source"), 120) or None,
        "source_kind": source_kind,
    }


def _signal_boost_share_url(locale: str, share_slug: str) -> str:
    normalized_locale = str(locale or "en").split("-")[0].strip().lower() or "en"
    if normalized_locale == "at":
        normalized_locale = "de"
    base_public_url = str(config.APP_PUBLIC_URL or "").strip().rstrip("/")
    if not base_public_url:
        return f"/{normalized_locale}/signal/{share_slug}"
    return f"{base_public_url}/{normalized_locale}/signal/{share_slug}"


def _build_public_candidate_snapshot(source: dict[str, Any]) -> dict[str, Any]:
    stored_snapshot = _safe_dict(source.get("candidate_snapshot"))
    candidate_id = str(source.get("candidate_id") or "").strip()
    candidate_profile = _fetch_candidate_profile_for_draft(candidate_id) if candidate_id else {}
    profile_identity = _fetch_profile_identity(candidate_id) if candidate_id else {}

    name = _trimmed_text(
        profile_identity.get("full_name")
        or stored_snapshot.get("name"),
        160,
    ) or "JobShaman member"
    job_title = _trimmed_text(
        candidate_profile.get("job_title")
        or stored_snapshot.get("jobTitle"),
        160,
    ) or None
    avatar_url = _trimmed_text(
        candidate_profile.get("avatar_url")
        or candidate_profile.get("photo")
        or profile_identity.get("avatar_url")
        or stored_snapshot.get("avatar_url"),
        2000,
    ) or None
    linkedin = _trimmed_text(
        candidate_profile.get("linkedin")
        or stored_snapshot.get("linkedin"),
        2000,
    ) or None
    skills = _safe_string_list(
        candidate_profile.get("skills") or stored_snapshot.get("skills"),
        limit=8,
    )
    preferred_country_code = str(
        _safe_dict(candidate_profile.get("preferences")).get("preferredCountryCode")
        or candidate_profile.get("preferred_country_code")
        or stored_snapshot.get("preferredCountryCode")
        or ""
    ).strip().upper() or None

    return {
        "name": name,
        "jobTitle": job_title,
        "avatar_url": avatar_url,
        "linkedin": linkedin,
        "skills": skills,
        "preferredCountryCode": preferred_country_code,
    }


def _should_redirect_public_avatar(url: str) -> bool:
    normalized = str(url or "").strip().lower()
    if not normalized:
        return False
    if normalized.startswith("/"):
        return True
    return "/storage/v1/object/public/" in normalized or "/profile-photos/" in normalized


def _serialize_signal_output_owner(row: dict[str, Any] | None) -> dict[str, Any] | None:
    source = row or {}
    if not source:
        return None
    locale = str(source.get("locale") or "en").strip() or "en"
    share_slug = str(source.get("share_slug") or "").strip()
    return {
        "id": str(source.get("id") or "").strip(),
        "share_slug": share_slug,
        "share_url": _signal_boost_share_url(locale, share_slug),
        "locale": locale,
        "status": str(source.get("status") or "draft").strip() or "draft",
        "job_snapshot": _safe_dict(source.get("job_snapshot")),
        "candidate_snapshot": _safe_dict(source.get("candidate_snapshot")),
        "scenario_payload": _safe_dict(source.get("scenario_payload")),
        "response_payload": _safe_dict(source.get("response_payload")),
        "recruiter_readout": _safe_dict(source.get("recruiter_readout")) or None,
        "signal_summary": _safe_dict(source.get("signal_summary")) or None,
        "quality_flags": _safe_dict(source.get("quality_flags")),
        "analytics": _safe_dict(source.get("analytics")),
        "created_at": source.get("created_at"),
        "updated_at": source.get("updated_at"),
        "published_at": source.get("published_at"),
    }


def _serialize_signal_output_public(row: dict[str, Any] | None) -> dict[str, Any] | None:
    source = row or {}
    if not source:
        return None
    job_snapshot = _safe_dict(source.get("job_snapshot"))
    locale = str(source.get("locale") or "en").strip() or "en"
    share_slug = str(source.get("share_slug") or "").strip()
    public_candidate_snapshot = _build_public_candidate_snapshot(source)
    return {
        "id": str(source.get("id") or "").strip(),
        "share_slug": share_slug,
        "share_url": _signal_boost_share_url(locale, share_slug),
        "locale": locale,
        "job_snapshot": job_snapshot,
        "candidate_snapshot": public_candidate_snapshot,
        "scenario_payload": _safe_dict(source.get("scenario_payload")),
        "response_payload": _safe_dict(source.get("response_payload")),
        "recruiter_readout": _safe_dict(source.get("recruiter_readout")) or None,
        "signal_summary": _safe_dict(source.get("signal_summary")) or None,
        "quality_flags": _safe_dict(source.get("quality_flags")),
        "created_at": source.get("created_at"),
        "published_at": source.get("published_at"),
    }


@router.post("/jobs/{job_id}/signal-boost/brief")
@limiter.limit("30/minute")
async def generate_job_signal_boost_brief(
    job_id: str,
    payload: JobSignalBoostBriefRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    job_row = _load_signal_boost_job_row(job_id)
    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    locale = _normalize_locale(payload.locale or job_row.get("language_code") or "en")
    brief = build_signal_boost_brief(job_row, locale, prefer_ai=True)
    void_meta = {
        "job_id": str(job_row.get("id") or job_id),
        "source_kind": _build_signal_boost_job_snapshot(job_row).get("source_kind"),
    }
    return {"brief": brief, "meta": void_meta}


@router.post("/jobs/{job_id}/signal-boost/starter")
@limiter.limit("20/minute")
async def generate_job_signal_boost_starter(
    job_id: str,
    payload: JobSignalBoostStarterRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    job_row = _load_signal_boost_job_row(job_id)
    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    locale = _normalize_locale(payload.locale or job_row.get("language_code") or "en")
    response_payload = {
        key: _trimmed_text(value, 4000)
        for key, value in dict(payload.response_payload or {}).items()
        if _trimmed_text(value, 4000)
    }
    starter = build_signal_boost_starter_payload(job_row, locale, response_payload, prefer_ai=True)
    return starter


@router.post("/jobs/{job_id}/signal-boost/outputs")
@limiter.limit("20/minute")
async def publish_job_signal_boost_output(
    job_id: str,
    payload: JobSignalBoostOutputRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    job_row = _load_signal_boost_job_row(job_id)
    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    locale = _normalize_locale(payload.locale or job_row.get("language_code") or "en")
    scenario_payload = _safe_dict(payload.scenario_payload)
    brief = scenario_payload if scenario_payload else build_signal_boost_brief(job_row, locale, prefer_ai=True)
    response_payload = {
        key: _trimmed_text(value, 4000)
        for key, value in dict(payload.response_payload or {}).items()
        if _trimmed_text(value, 4000)
    }
    quality = evaluate_signal_boost_quality(response_payload, locale, brief=brief)
    if payload.status == "published" and not quality.get("publish_ready"):
        raise HTTPException(status_code=409, detail={"quality_flags": quality, "message": "Signal Boost needs a bit more substance before publishing."})

    job_snapshot = _build_signal_boost_job_snapshot(job_row)
    summary = build_signal_boost_summary(response_payload, locale, quality, brief=brief)
    recruiter_readout = build_signal_boost_recruiter_readout(response_payload, locale, brief, quality)
    output = create_signal_output(
        {
            "id": uuid4().hex,
            "share_slug": uuid4().hex[:16],
            "candidate_id": user_id,
            "job_id": str(job_row.get("id") or job_id),
            "source_kind": job_snapshot.get("source_kind") or "imported",
            "locale": locale,
            "status": payload.status,
            "job_snapshot": job_snapshot,
            "candidate_snapshot": _build_signal_boost_candidate_snapshot(user, user_id),
            "scenario_payload": brief,
            "response_payload": response_payload,
            "recruiter_readout": recruiter_readout,
            "signal_summary": summary,
            "quality_flags": quality,
            "analytics": {"view": 0, "share_copy": 0, "recruiter_cta_click": 0, "open_original_listing": 0},
            "published_at": now_iso() if payload.status == "published" else None,
        }
    )

    return {
        "output": _serialize_signal_output_owner(output),
        "quality_flags": quality,
    }


@router.get("/jobs/{job_id}/signal-boost/output")
@limiter.limit("60/minute")
async def get_latest_job_signal_boost_output(
    job_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")

    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    output = get_latest_signal_output_for_job(candidate_id=user_id, job_id=job_id)
    if not output:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")
    return {"output": _serialize_signal_output_owner(output)}


@router.get("/signal-boost/me")
@limiter.limit("60/minute")
async def get_my_signal_boost_outputs(
    request: Request,
    limit: int = Query(12, ge=1, le=50),
    include_archived: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")

    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    outputs = list_recent_signal_outputs_for_candidate(
        candidate_id=user_id,
        limit=limit,
        include_archived=include_archived,
    )
    return {"items": [_serialize_signal_output_owner(output) for output in outputs if output]}


@router.put("/signal-boost/{output_id}")
@limiter.limit("20/minute")
async def update_job_signal_boost_output(
    output_id: str,
    payload: JobSignalBoostOutputRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    existing = get_signal_output_by_id(output_id=output_id, candidate_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")

    locale = _normalize_locale(payload.locale or existing.get("locale") or "en")
    scenario_payload = _safe_dict(payload.scenario_payload)
    brief = scenario_payload if scenario_payload else _safe_dict(existing.get("scenario_payload"))
    response_payload = {
        key: _trimmed_text(value, 4000)
        for key, value in dict(payload.response_payload or {}).items()
        if _trimmed_text(value, 4000)
    }
    quality = evaluate_signal_boost_quality(response_payload, locale, brief=brief)
    if payload.status == "published" and not quality.get("publish_ready"):
        raise HTTPException(status_code=409, detail={"quality_flags": quality, "message": "Signal Boost needs a bit more substance before publishing."})

    updated = update_signal_output(
        output_id=output_id,
        candidate_id=user_id,
        patch={
            "locale": locale,
            "status": payload.status,
            "scenario_payload": brief,
            "response_payload": response_payload,
            "recruiter_readout": build_signal_boost_recruiter_readout(response_payload, locale, brief, quality),
            "signal_summary": build_signal_boost_summary(response_payload, locale, quality, brief=brief),
            "quality_flags": quality,
            "published_at": now_iso() if payload.status == "published" else existing.get("published_at"),
        },
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")
    return {"output": _serialize_signal_output_owner(updated), "quality_flags": quality}


@router.post("/signal-boost/{output_id}/revoke")
@limiter.limit("20/minute")
async def revoke_job_signal_boost_output(
    output_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    user_id = str(user.get("id") or user.get("auth_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    existing = get_signal_output_by_id(output_id=output_id, candidate_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")

    if str(existing.get("status") or "").strip() == "archived":
        return {"output": _serialize_signal_output_owner(existing)}

    updated = update_signal_output(
        output_id=output_id,
        candidate_id=user_id,
        patch={
            "status": "archived",
            "published_at": existing.get("published_at"),
        },
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")
    return {"output": _serialize_signal_output_owner(updated)}


@router.get("/signal-boost/{share_slug}")
@limiter.limit("120/minute")
async def get_public_job_signal_boost_output(
    share_slug: str,
    request: Request,
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")
    output = get_signal_output_by_share_slug(share_slug=share_slug)
    if not output:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")
    record_signal_output_event(output_id=str(output.get("id") or ""), event_type="view", increment=1)
    return {"output": _serialize_signal_output_public(output)}


@router.get("/signal-boost/{share_slug}/avatar")
@limiter.limit("240/minute")
async def get_public_job_signal_boost_avatar(
    share_slug: str,
    request: Request,
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")
    output = get_signal_output_by_share_slug(share_slug=share_slug)
    if not output:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")

    candidate_snapshot = _build_public_candidate_snapshot(output)
    avatar_url = _trimmed_text(candidate_snapshot.get("avatar_url"), 4000)
    if not avatar_url:
        raise HTTPException(status_code=404, detail="Candidate avatar not found")

    if _should_redirect_public_avatar(avatar_url):
        return RedirectResponse(url=avatar_url, status_code=307)

    try:
        fetched = requests.get(
            avatar_url,
            timeout=10,
            headers={"User-Agent": "jobshaman-signal-boost-avatar/1.0"},
        )
        fetched.raise_for_status()
        content_type = str(fetched.headers.get("Content-Type") or "").strip().lower()
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=415, detail="Avatar source did not return an image")
        return Response(
            content=fetched.content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except HTTPException:
        raise
    except Exception:
        return RedirectResponse(url=avatar_url, status_code=307)


@router.post("/signal-boost/{output_id}/events")
@limiter.limit("120/minute")
async def record_public_job_signal_boost_event(
    output_id: str,
    payload: JobSignalBoostEventRequest,
    request: Request,
):
    if not signal_boost_store_enabled():
        raise HTTPException(status_code=503, detail="Signal Boost store unavailable")
    output = record_signal_output_event(output_id=output_id, event_type=payload.event_type, increment=1)
    if not output:
        raise HTTPException(status_code=404, detail="Signal Boost output not found")
    notification_delivery = {"email": False, "push": False}
    if payload.event_type in {"recruiter_cta_click", "open_original_listing"}:
        notification_delivery = notify_candidate_of_signal_boost_interest(output)
    return {"ok": True, "notification_delivery": notification_delivery}
