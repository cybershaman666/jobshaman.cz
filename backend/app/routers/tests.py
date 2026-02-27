from __future__ import annotations
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request

from ..core.security import get_current_user, verify_subscription, verify_supabase_token
from ..core.database import supabase
from ..core import config
from ..services.jcfpm_scoring import score_dimensions
from ..services.jcfpm_mapping import rank_roles
from ..services.jcfpm_ai import generate_jcfpm_report
from ..models.requests import JcfpmSubmitRequest

router = APIRouter()


def _require_premium(user: dict | None) -> None:
    if not config.JCFPM_REQUIRE_PREMIUM:
        return
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tier = (user.get("subscription_tier") or "").lower()
    if not user.get("is_subscription_active") or tier != "premium":
        raise HTTPException(status_code=403, detail="Premium subscription required")


def _resolve_optional_user(request: Request) -> dict | None:
    auth_header = request.headers.get("authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        # Enrich with subscription context when token is valid.
        return verify_subscription(verify_supabase_token(token))
    except Exception:
        return None


def _fetch_items() -> list[dict]:
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")
    resp = (
        supabase
        .table("jcfpm_items")
        .select("id, dimension, subdimension, prompt, reverse_scoring, sort_order, item_type, payload, assets, pool_key, variant_index")
        .order("sort_order", desc=False)
        .execute()
    )
    return resp.data or []


@router.get("/tests/jcfpm/items")
async def jcfpm_items(request: Request):
    user = _resolve_optional_user(request)
    _require_premium(user)
    items = _fetch_items()
    pool_keys = {str(row.get("pool_key") or row.get("id") or "").strip().upper() for row in items}
    pool_keys.discard("")
    if len(pool_keys) < 108:
        raise HTTPException(status_code=500, detail="JCFPM items not seeded")
    return {"items": items}


@router.get("/tests/jcfpm/diagnostics")
async def jcfpm_diagnostics(request: Request):
    user = _resolve_optional_user(request)
    _require_premium(user)
    if not supabase:
        raise HTTPException(status_code=500, detail="Database unavailable")
    items = _fetch_items()
    pool_keys = {str(row.get("pool_key") or row.get("id") or "").strip().upper() for row in items}
    pool_keys.discard("")
    pool_key_nulls = sum(1 for row in items if row.get("pool_key") in (None, ""))
    return {
        "supabase_url": config.SUPABASE_URL or None,
        "supabase_key_set": bool(config.SUPABASE_KEY),
        "total_items": len(items),
        "distinct_pool_keys": len(pool_keys),
        "pool_key_nulls": pool_key_nulls,
    }


@router.post("/tests/jcfpm/submit")
async def jcfpm_submit(payload: JcfpmSubmitRequest, request: Request):
    user = _resolve_optional_user(request)
    _require_premium(user)
    user_id = (user or {}).get("id") or (user or {}).get("auth_id")

    items = _fetch_items()
    pool_keys = {str(row.get("pool_key") or row.get("id") or "").strip().upper() for row in items}
    pool_keys.discard("")
    if len(pool_keys) < 108:
        raise HTTPException(status_code=500, detail="JCFPM items not seeded")

    responses = payload.responses or {}
    selected_ids = payload.item_ids or list(responses.keys())
    # Deduplicate while preserving order
    seen = set()
    selected_ids = [item_id for item_id in selected_ids if not (item_id in seen or seen.add(item_id))]
    if len(selected_ids) != 108:
        raise HTTPException(status_code=400, detail="Expected 108 responses")
    if len(responses) != len(selected_ids):
        raise HTTPException(status_code=400, detail="Responses count does not match selected items")

    # Validate range for likert items only
    item_map = {row.get("id"): row for row in items}
    selected_items: list[dict] = []
    for item_id in selected_ids:
        item = item_map.get(item_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Unknown item {item_id}")
        selected_items.append(item)
    for key, value in responses.items():
        if key not in item_map:
            raise HTTPException(status_code=400, detail=f"Unknown item {key}")
        if key not in selected_ids:
            continue
        item = item_map.get(key)
        item_type = (item.get("item_type") or "likert").lower()
        if item_type == "likert":
            if not isinstance(value, int) or value < 1 or value > 7:
                raise HTTPException(status_code=400, detail=f"Invalid response {key}")

    # Score
    dimension_scores = score_dimensions(selected_items, responses)
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
        "item_ids": selected_ids,
        "variant_seed": payload.variant_seed,
        "dimension_scores": dimension_scores,
        "fit_scores": fit_scores,
        "ai_report": ai_report,
        "percentile_summary": percentile_summary,
        "confidence": 100,
    }

    # Persist only for authenticated users.
    if user_id:
        supabase.table("jcfpm_results").insert({
            "user_id": user_id,
            "raw_responses": responses,
            "dimension_scores": dimension_scores,
            "fit_scores": fit_scores,
            "ai_report": ai_report,
            "version": "jcfpm-v1",
        }).execute()

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
async def jcfpm_latest(request: Request):
    user = _resolve_optional_user(request)
    _require_premium(user)
    user_id = (user or {}).get("id") or (user or {}).get("auth_id")
    if not user_id:
        return {"snapshot": None}

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
