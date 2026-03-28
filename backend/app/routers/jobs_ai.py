from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..ai_orchestration.client import (
    AIClientError,
    _extract_json,
    call_primary_with_fallback,
    get_default_fallback_model,
    get_default_primary_model,
)
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription
from ..core.runtime_config import get_active_model_config
from ..core.database import supabase
from ..matching_engine import recommend_jobs_for_user
from ..matching_engine.feature_store import extract_candidate_features, extract_job_features
from ..matching_engine.retrieval import ensure_candidate_embedding, ensure_job_embeddings
from ..matching_engine.scoring import score_from_embeddings, score_job
from ..models.requests import JobAnalyzeRequest, JobApplicationDraftRequest
from ..models.responses import JobApplicationDraftResponse
from ..services.jobs_ai_runtime import (
    _build_application_draft_prompt,
    _coerce_job_analysis_payload,
    _derive_fit_signals,
    _extract_candidate_cv_context,
    _fallback_application_draft,
    _fetch_candidate_profile_for_draft,
    _fetch_cv_document_for_draft,
    _generate_application_draft_text,
    _job_analysis_prompt,
    _resolve_application_draft_language,
)
from ..services.jobs_postgres_store import update_job_fields
from ..services.jobs_interactions_runtime import _write_analytics_event
from ..services.jobs_shared import (
    _normalize_job_id,
    _read_job_record,
    _require_company_tier,
    _require_job_access,
    _safe_dict,
    _safe_row,
    _safe_rows,
    _user_has_allowed_subscription,
)

router = APIRouter()


@router.post("/jobs/analyze")
@limiter.limit("20/minute")
async def analyze_job(
    payload: JobAnalyzeRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    allowed_tiers = {"premium"}
    if not _user_has_allowed_subscription(user, allowed_tiers):
        raise HTTPException(status_code=403, detail="Premium subscription required")

    normalized_job_id = _normalize_job_id(payload.job_id) if payload.job_id else None
    if normalized_job_id is not None:
        try:
            cached_row = _safe_row(_read_job_record(normalized_job_id))
            ai_cached = cached_row.get("ai_analysis") if cached_row else None
            if isinstance(ai_cached, dict) and ai_cached.get("summary"):
                return {"analysis": ai_cached, "cached": True}
        except Exception as exc:
            print(f"⚠️ Failed to read cached ai_analysis for job {normalized_job_id}: {exc}")

    default_primary = get_default_primary_model()
    default_fallback = get_default_fallback_model()
    cfg = get_active_model_config("ai_orchestration", "job_analysis")
    primary_model = cfg.get("primary_model") or default_primary
    fallback_model = cfg.get("fallback_model") or default_fallback
    generation_config = {
        "temperature": cfg.get("temperature", 0),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }
    prompt = _job_analysis_prompt(payload.description, payload.title, payload.language or "cs")

    try:
        result, fallback_used = call_primary_with_fallback(
            prompt,
            primary_model,
            fallback_model,
            generation_config=generation_config,
        )
        parsed = _extract_json(result.text)
        analysis = _coerce_job_analysis_payload(parsed)
    except AIClientError as exc:
        raise HTTPException(status_code=503, detail=f"AI provider unavailable: {str(exc)}")
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI response invalid: {str(exc)}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(exc)}")

    if normalized_job_id is not None:
        try:
            update_job_fields(normalized_job_id, {"ai_analysis": analysis})
        except Exception as exc:
            print(f"⚠️ Failed to persist ai_analysis for job {normalized_job_id}: {exc}")

    return {
        "analysis": analysis,
        "cached": False,
        "meta": {
            "model_used": result.model_name,
            "fallback_used": fallback_used,
            "token_usage": {"input": result.tokens_in, "output": result.tokens_out},
            "latency_ms": result.latency_ms,
        },
    }


@router.post("/jobs/{job_id}/application-draft", response_model=JobApplicationDraftResponse)
@limiter.limit("12/minute")
async def generate_job_application_draft(
    job_id: str,
    payload: JobApplicationDraftRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    if not _user_has_allowed_subscription(user, {"premium"}):
        raise HTTPException(status_code=403, detail="Premium subscription required")

    normalized_job_id = _normalize_job_id(job_id)
    if normalized_job_id is None:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    job = _read_job_record(normalized_job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_profile = _fetch_candidate_profile_for_draft(user_id)
    cv_document = None
    if payload.cv_document_id:
        cv_document = _fetch_cv_document_for_draft(user_id, payload.cv_document_id)
        if not cv_document:
            raise HTTPException(status_code=404, detail="CV document not found")

    recommendation = None
    try:
        recommendations = recommend_jobs_for_user(user_id=user_id, limit=120, allow_cache=True)
        recommendation = next(
            (
                item
                for item in recommendations
                if str(_safe_dict(item.get("job")).get("id") or "") == str(normalized_job_id)
            ),
            None,
        )
    except Exception as exc:
        print(f"⚠️ Failed to compute draft recommendation context: {exc}")

    fit_score, fit_reasons, fit_warnings = _derive_fit_signals(job, candidate_profile, recommendation)
    language = _resolve_application_draft_language(payload.language, candidate_profile, cv_document, job)
    cv_text, cv_ai_text = _extract_candidate_cv_context(candidate_profile, cv_document)

    used_fallback = False
    model_meta: dict
    try:
        prompt = _build_application_draft_prompt(
            job=job,
            candidate_profile=candidate_profile,
            cv_text=cv_text,
            cv_ai_text=cv_ai_text,
            fit_score=fit_score,
            fit_reasons=fit_reasons,
            fit_warnings=fit_warnings,
            language=language,
            tone=payload.tone,
        )
        draft_text, model_meta = _generate_application_draft_text(prompt)
        if not draft_text.strip():
            raise ValueError("Empty application draft")
    except Exception as exc:
        used_fallback = True
        draft_text = _fallback_application_draft(
            job=job,
            candidate_profile=candidate_profile,
            fit_reasons=fit_reasons,
            language=language,
        )
        model_meta = {
            "mode": "deterministic_fallback",
            "error": str(exc),
            "model_used": None,
            "fallback_used": False,
            "token_usage": {"input": 0, "output": 0},
            "latency_ms": 0,
        }

    _write_analytics_event(
        event_type="application_draft_regenerated" if payload.regenerate else "application_draft_generated",
        user_id=user_id,
        company_id=str(job.get("company_id") or "") or None,
        feature="candidate_copilot",
        tier=(user.get("subscription_tier") or "").lower() or "premium",
        metadata={
            "job_id": normalized_job_id,
            "cv_document_id": payload.cv_document_id,
            "tone": payload.tone,
            "language": language,
            "used_fallback": used_fallback,
            "fit_score": fit_score,
        },
    )

    return JobApplicationDraftResponse(
        draft_text=draft_text,
        fit_score=fit_score,
        fit_reasons=fit_reasons,
        fit_warnings=fit_warnings,
        language=language,
        tone=payload.tone,
        used_fallback=used_fallback,
        model_meta=model_meta,
    )


@router.post("/match-candidates")
@limiter.limit("10/minute")
async def match_candidates_service(
    request: Request,
    job_id: str = Query(...),
    user: dict = Depends(verify_subscription),
):
    job_row = _require_job_access(user, job_id)
    company_id = str(job_row.get("company_id") or "")
    _require_company_tier(user, company_id, {"growth", "professional", "enterprise"})
    job = _read_job_record(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    cand_res = supabase.table("candidate_profiles").select("*").execute()
    candidates = _safe_rows(cand_res.data if cand_res else None)
    job_features = extract_job_features(job)
    job_embeddings = ensure_job_embeddings([job], persist=False)
    job_embedding = job_embeddings.get(str(job.get("id") or job_id)) or []

    matches = []
    for cand in candidates:
        candidate_id = str(cand.get("id") or "")
        if not candidate_id:
            continue
        candidate_features = extract_candidate_features(cand)
        candidate_embedding = ensure_candidate_embedding(
            candidate_id,
            candidate_features.get("text") or "",
            persist=False,
        )
        semantic = score_from_embeddings(candidate_embedding, job_embedding)
        score, reasons, breakdown = score_job(candidate_features, job_features, semantic)
        if score >= 25:
            matches.append(
                {
                    "candidate_id": candidate_id,
                    "score": score,
                    "reasons": reasons,
                    "breakdown": breakdown,
                }
            )

    return {"job_id": job_id, "matches": sorted(matches, key=lambda x: x["score"], reverse=True)[:10]}
