from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.security import get_current_user, verify_subscription
from ..core.database import supabase
from ..services.jcfpm_scoring import score_dimensions
from ..services.jcfpm_mapping import rank_roles
from ..services.jcfpm_ai import generate_jcfpm_report
from ..models.requests import JcfpmSubmitRequest

router = APIRouter()


def _require_premium(user: dict) -> None:
    tier = (user.get("subscription_tier") or "").lower()
    if not user.get("is_subscription_active") or tier != "premium":
        raise HTTPException(status_code=403, detail="Premium subscription required")


def _fetch_items() -> list[dict]:
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")
    resp = (
        supabase
        .table("jcfpm_items")
        .select("id, dimension, subdimension, prompt, reverse_scoring, sort_order")
        .order("sort_order", desc=False)
        .execute()
    )
    return resp.data or []


@router.get("/tests/jcfpm/items")
async def jcfpm_items(user: dict = Depends(verify_subscription)):
    _require_premium(user)
    items = _fetch_items()
    if len(items) < 72:
        raise HTTPException(status_code=500, detail="JCFPM items not seeded")
    return {"items": items}


@router.post("/tests/jcfpm/submit")
async def jcfpm_submit(payload: JcfpmSubmitRequest, user: dict = Depends(verify_subscription)):
    _require_premium(user)
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    items = _fetch_items()
    if len(items) != 72:
        raise HTTPException(status_code=500, detail="JCFPM items not seeded")

    responses = payload.responses or {}
    if len(responses) != 72:
        raise HTTPException(status_code=400, detail="Expected 72 responses")

    # Validate range
    for key, value in responses.items():
        if not isinstance(value, int) or value < 1 or value > 7:
            raise HTTPException(status_code=400, detail=f"Invalid response {key}")

    # Score
    dimension_scores = score_dimensions(items, responses)
    percentile_summary = {row["dimension"]: row["percentile"] for row in dimension_scores}

    # Fit scores
    role_resp = (
        supabase
        .table("job_role_profiles")
        .select("id,title,d1,d2,d3,d4,d5,d6,salary_range,growth_potential,ai_impact,ai_intensity,remote_friendly")
        .execute()
    )
    roles = role_resp.data or []
    user_profile = {row["dimension"]: row["raw_score"] for row in dimension_scores}
    fit_scores = rank_roles(user_profile, roles, top_n=10) if roles else []

    # AI report
    ai_payload = {
        "dimension_scores": dimension_scores,
        "percentiles": percentile_summary,
        "top_roles": fit_scores[:5],
    }
    ai_report = generate_jcfpm_report(ai_payload)

    snapshot = {
        "schema_version": "jcfpm-v1",
        "completed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "responses": responses,
        "dimension_scores": dimension_scores,
        "fit_scores": fit_scores,
        "ai_report": ai_report,
        "percentile_summary": percentile_summary,
        "confidence": 100,
    }

    # Save results
    supabase.table("jcfpm_results").insert({
        "user_id": user_id,
        "raw_responses": responses,
        "dimension_scores": dimension_scores,
        "fit_scores": fit_scores,
        "ai_report": ai_report,
        "version": "jcfpm-v1",
    }).execute()

    # Update profile preferences snapshot
    prof_resp = (
        supabase.table("candidate_profiles")
        .select("preferences")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    prefs = (prof_resp.data or {}).get("preferences") if prof_resp and prof_resp.data else {}
    if not isinstance(prefs, dict):
        prefs = {}
    prefs["jcfpm_v1"] = snapshot
    supabase.table("candidate_profiles").update({"preferences": prefs}).eq("id", user_id).execute()

    return {"snapshot": snapshot}


@router.get("/tests/jcfpm/latest")
async def jcfpm_latest(user: dict = Depends(verify_subscription)):
    _require_premium(user)
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    prof_resp = (
        supabase.table("candidate_profiles")
        .select("preferences")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    prefs = (prof_resp.data or {}).get("preferences") if prof_resp and prof_resp.data else {}
    if not isinstance(prefs, dict):
        prefs = {}
    snapshot = prefs.get("jcfpm_v1")
    return {"snapshot": snapshot}
