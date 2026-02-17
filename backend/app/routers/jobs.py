import os
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from uuid import uuid4
from datetime import datetime, timezone
from ..core.limiter import limiter
from ..core.security import get_current_user, verify_subscription, verify_csrf_token_header, require_company_access, verify_supabase_token
from ..models.requests import JobCheckRequest, JobStatusUpdateRequest, JobInteractionRequest, HybridJobSearchRequest, HybridJobSearchV2Request, JobAnalyzeRequest
from ..models.responses import JobCheckResponse
from ..services.legality import check_legality_rules
from ..services.matching import calculate_candidate_match
from ..matching_engine import recommend_jobs_for_user, hybrid_search_jobs, hybrid_search_jobs_v2
from ..services.email import send_review_email, send_recruiter_legality_email
from ..core.database import supabase
from ..core.runtime_config import get_active_model_config
from ..ai_orchestration.client import AIClientError, call_primary_with_fallback, _extract_json
from ..utils.helpers import now_iso

router = APIRouter()


def _try_get_optional_user_id(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth_header:
        return None
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        user = verify_supabase_token(token)
        return user.get("id") or user.get("auth_id")
    except Exception:
        return None


def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _is_active_subscription(sub: dict) -> bool:
    if not sub:
        return False
    status = (sub.get("status") or "").lower()
    if status not in ["active", "trialing"]:
        return False

    expires_at = _parse_iso_datetime(sub.get("current_period_end"))
    if expires_at:
        return datetime.now(timezone.utc) <= expires_at
    return True


def _fetch_latest_subscription_by(column: str, value: str) -> dict | None:
    if not supabase or not value:
        return None
    try:
        resp = (
            supabase
            .table("subscriptions")
            .select("*")
            .eq(column, value)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def _user_has_allowed_subscription(user: dict, allowed_tiers: set[str]) -> bool:
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier in allowed_tiers:
        return True

    user_id = user.get("id") or user.get("auth_id")
    if user_id:
        user_sub = _fetch_latest_subscription_by("user_id", user_id)
        if user_sub and _is_active_subscription(user_sub) and (user_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    # Keep recruiter/company fallback for shared auth contexts.
    for company_id in (user.get("authorized_ids") or []):
        if company_id == user_id:
            continue
        company_sub = _fetch_latest_subscription_by("company_id", company_id)
        if company_sub and _is_active_subscription(company_sub) and (company_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    return False

def _normalize_job_id(job_id: str):
    return int(job_id) if str(job_id).isdigit() else job_id

def _coerce_job_analysis_payload(raw: dict) -> dict:
    summary = str(raw.get("summary") or "").strip()
    hidden = raw.get("hiddenRisks")
    if not isinstance(hidden, list):
        hidden = raw.get("hidden_risks")
    if not isinstance(hidden, list):
        hidden = []
    hidden = [str(item).strip() for item in hidden if str(item).strip()][:12]
    cultural = str(raw.get("culturalFit") or raw.get("cultural_fit") or "").strip()
    if not summary:
        raise ValueError("Missing summary in AI response")
    if not cultural:
        cultural = "Neutrální"
    return {
        "summary": summary[:2000],
        "hiddenRisks": hidden,
        "culturalFit": cultural[:200],
    }

def _job_analysis_prompt(description: str, title: str | None = None, language: str = "cs") -> str:
    normalized_lang = (language or "cs").strip().lower()
    output_lang = "Czech" if normalized_lang.startswith("cs") else "English"
    job_title = (title or "").strip()
    title_line = f"Job title: {job_title}\n" if job_title else ""
    return f"""
Analyze the following job posting as a pragmatic career advisor.
Output language: {output_lang}
Return STRICT JSON only with keys:
- summary: string
- hiddenRisks: string[]
- culturalFit: string

Rules:
- summary = one sentence of what the job actually is
- hiddenRisks = implied red flags or ambiguity
- culturalFit = short tone assessment
- no markdown, no extra keys

{title_line}Job description:
{description[:7000]}
""".strip()

def _require_job_access(user: dict, job_id: str):
    """Ensure the current user is authorized to manage the given job."""
    job_id_norm = _normalize_job_id(job_id)

    job_resp = supabase.table("jobs").select("id, company_id").eq("id", job_id_norm).maybe_single().execute()
    if not job_resp.data:
        raise HTTPException(status_code=404, detail="Job not found")

    company_id = job_resp.data.get("company_id")
    require_company_access(user, company_id)

    return job_resp.data

@router.get("/")
async def root(request: Request):
    return {"status": "JobShaman API is running"}

@router.post("/check-legality", response_model=JobCheckResponse)
@limiter.limit("5/minute")
async def check_job_legality(job: JobCheckRequest, request: Request, user: dict = Depends(verify_subscription)):
    print(f"🔥 [CRITICAL] check_job_legality REACHED for job {job.id}")
    _require_job_access(user, str(job.id))
    risk_score, is_legal, reasons, needs_review = check_legality_rules(
        job.title,
        job.company,
        job.description,
        country_code=job.country_code,
        location=job.location
    )
    print(f"   [RESULT] Risk Score: {risk_score}, Is Legal: {is_legal}, Needs Review: {needs_review}")
    result = JobCheckResponse(risk_score=risk_score, is_legal=is_legal, reasons=reasons, needs_manual_review=needs_review)
    
    # Determine status for DB
    db_status = 'legal'
    if not is_legal:
        db_status = 'illegal'
    elif needs_review:
        db_status = 'review'
    
    # Update Supabase
    print(f"💾 [DB] Updating job {job.id} legality_status to: {db_status}")
    try:
        # Ensure job ID is treated as integer for BIGINT column
        job_id_int = int(job.id) if str(job.id).isdigit() else job.id
        
        # Use existing columns: legality_status, risk_score, verification_notes
        update_data = {
            "legality_status": db_status,
            "risk_score": risk_score,
            "verification_notes": ", ".join(reasons) if reasons else ""
        }
        
        update_result = supabase.table("jobs").update(update_data).eq("id", job_id_int).execute()
        
        if not update_result.data:
            print(f"⚠️ [DB WARNING] No rows updated for job {job.id}. Check if ID exists and types match.")
        else:
            print(f"✅ [DB] Successfully updated status for job {job.id}")
            
    except Exception as e:
        print(f"❌ [DB ERROR] Failed to update job status for {job.id}: {e}")

    # If ad is illegal OR needs review, notify admin AND recruiter
    if not is_legal or needs_review:
        print(f"⚠️ [ACTION] Job {job.id} flagged! Sending emails...")
        
        # 1. Notify Admin
        email_context = {
            "job_id": job.id,
            "job_title": job.title,
            "job_company": job.company,
            "is_legal": is_legal,
            "needs_review": needs_review,
            "risk_score": risk_score,
            "reasons": reasons
        }
        send_review_email(job, result, context=email_context)

        # 2. Notify Recruiter (fetch email from DB first)
        try:
            job_data = supabase.table("jobs").select("contact_email, title").eq("id", job.id).single().execute()
            if job_data.data and job_data.data.get("contact_email"):
                rec_email = job_data.data["contact_email"]
                print("📧 Sending status update to recruiter.")
                send_recruiter_legality_email(rec_email, job_data.data["title"], result)
            else:
                print(f"⚠️ Could not find recruiter email for job {job.id}")
        except Exception as e:
            print(f"❌ Error notifying recruiter: {e}")
        
    return result

@router.put("/{job_id}/status")
async def update_job_status(job_id: str, update: JobStatusUpdateRequest, request: Request, user: dict = Depends(get_current_user)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    _require_job_access(user, job_id)
    # Query Supabase for job ownership and update status
    resp = supabase.table("jobs").update({"status": update.status}).eq("id", job_id).execute()
    return {"status": "success"}

@router.delete("/{job_id}")
async def delete_job(job_id: str, request: Request, user: dict = Depends(get_current_user)):
    print(f"🗑️ [REQUEST] Delete job {job_id}")
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    _require_job_access(user, job_id)
    supabase.table("jobs").delete().eq("id", job_id).execute()
    return {"status": "success"}

@router.post("/jobs/interactions")
@limiter.limit("120/minute")
async def log_job_interaction(payload: JobInteractionRequest, request: Request, user: dict = Depends(get_current_user)):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")

    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    try:
        metadata = payload.metadata or {}
        request_id = payload.request_id or metadata.get("request_id")
        scoring_version = payload.scoring_version or metadata.get("scoring_version")
        model_version = payload.model_version or metadata.get("model_version")
        insert_data = {
            "user_id": user_id,
            "job_id": payload.job_id,
            "event_type": payload.event_type,
            "dwell_time_ms": payload.dwell_time_ms,
            "session_id": payload.session_id,
            "metadata": metadata
        }
        res = supabase.table("job_interactions").insert(insert_data).execute()
        if not res.data:
            return {"status": "error", "message": "No data inserted"}

        feedback_rows = [
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": payload.job_id,
                "signal_type": payload.event_type,
                "signal_value": payload.signal_value,
                "scoring_version": scoring_version,
                "model_version": model_version,
                "metadata": metadata,
            }
        ]

        # Capture implicit relevance signals without changing client event taxonomy.
        if payload.dwell_time_ms is not None:
            feedback_rows.append(
                {
                    "request_id": request_id,
                    "user_id": user_id,
                    "job_id": payload.job_id,
                    "signal_type": "dwell_ms",
                    "signal_value": float(payload.dwell_time_ms),
                    "scoring_version": scoring_version,
                    "model_version": model_version,
                    "metadata": metadata,
                }
            )
        if payload.scroll_depth is not None:
            feedback_rows.append(
                {
                    "request_id": request_id,
                    "user_id": user_id,
                    "job_id": payload.job_id,
                    "signal_type": "scroll_depth",
                    "signal_value": float(payload.scroll_depth),
                    "scoring_version": scoring_version,
                    "model_version": model_version,
                    "metadata": metadata,
                }
            )
        try:
            supabase.table("recommendation_feedback_events").insert(feedback_rows).execute()
        except Exception as feedback_exc:
            print(f"⚠️ Failed to write recommendation feedback events: {feedback_exc}")

        search_feedback_rows = []
        for row in feedback_rows:
            search_feedback_rows.append(
                {
                    "request_id": row.get("request_id"),
                    "user_id": row.get("user_id"),
                    "job_id": row.get("job_id"),
                    "signal_type": row.get("signal_type"),
                    "signal_value": row.get("signal_value"),
                    "metadata": row.get("metadata") or {},
                }
            )
        if search_feedback_rows:
            try:
                supabase.table("search_feedback_events").insert(search_feedback_rows).execute()
            except Exception as search_exc:
                print(f"⚠️ Failed to write search feedback events: {search_exc}")
        return {"status": "success"}
    except Exception as e:
        print(f"❌ Error logging job interaction: {e}")
        raise HTTPException(status_code=500, detail="Failed to log interaction")


@router.get("/jobs/recommendations")
@limiter.limit("30/minute")
async def get_job_recommendations(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    matches = recommend_jobs_for_user(user_id=user_id, limit=limit, allow_cache=True)
    request_id = str(uuid4())

    exposure_rows = []
    enriched_matches = []
    for idx, item in enumerate(matches):
        job = item.get("job") or {}
        job_id = job.get("id")
        if not job_id:
            continue
        position = int(item.get("position") or (idx + 1))
        score = float(item.get("score") or 0.0)
        model_version = item.get("model_version") or "career-os-v2"
        scoring_version = item.get("scoring_version") or "scoring-v1"

        exposure_rows.append(
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": job_id,
                "position": position,
                "score": score,
                "predicted_action_probability": float(item.get("action_probability") or 0.0),
                "action_model_version": item.get("action_model_version") or None,
                "ranking_strategy": (item.get("breakdown") or {}).get("selection_strategy"),
                "is_new_job": bool((item.get("breakdown") or {}).get("is_new_job")),
                "is_long_tail_company": bool((item.get("breakdown") or {}).get("is_long_tail_company")),
                "model_version": model_version,
                "scoring_version": scoring_version,
                "source": "recommendations_api",
            }
        )
        enriched_matches.append(
            {
                **item,
                "position": position,
                "request_id": request_id,
            }
        )

    if exposure_rows:
        try:
            supabase.table("recommendation_exposures").upsert(
                exposure_rows, on_conflict="request_id,user_id,job_id"
            ).execute()
        except Exception as exp_exc:
            print(f"⚠️ Failed to write recommendation exposures: {exp_exc}")

    return {"jobs": enriched_matches, "request_id": request_id}


@router.post("/jobs/hybrid-search")
@limiter.limit("60/minute")
async def jobs_hybrid_search(
    payload: HybridJobSearchRequest,
    request: Request,
):
    result = hybrid_search_jobs(
        {
            "search_term": payload.search_term,
            "user_lat": payload.user_lat,
            "user_lng": payload.user_lng,
            "radius_km": payload.radius_km,
            "filter_city": payload.filter_city,
            "filter_contract_types": payload.filter_contract_types,
            "filter_benefits": payload.filter_benefits,
            "filter_min_salary": payload.filter_min_salary,
            "filter_date_posted": payload.filter_date_posted,
            "filter_experience_levels": payload.filter_experience_levels,
            "filter_country_codes": payload.filter_country_codes,
            "exclude_country_codes": payload.exclude_country_codes,
            "filter_language_codes": payload.filter_language_codes,
        },
        page=payload.page,
        page_size=payload.page_size,
    )
    return result


@router.post("/jobs/hybrid-search-v2")
@limiter.limit("90/minute")
async def jobs_hybrid_search_v2(
    payload: HybridJobSearchV2Request,
    request: Request,
):
    user_id = _try_get_optional_user_id(request)
    request_id = str(uuid4())
    result = hybrid_search_jobs_v2(
        {
            "search_term": payload.search_term,
            "user_lat": payload.user_lat,
            "user_lng": payload.user_lng,
            "radius_km": payload.radius_km,
            "filter_city": payload.filter_city,
            "filter_contract_types": payload.filter_contract_types,
            "filter_benefits": payload.filter_benefits,
            "filter_min_salary": payload.filter_min_salary,
            "filter_date_posted": payload.filter_date_posted,
            "filter_experience_levels": payload.filter_experience_levels,
            "filter_country_codes": payload.filter_country_codes,
            "exclude_country_codes": payload.exclude_country_codes,
            "filter_language_codes": payload.filter_language_codes,
            "sort_mode": payload.sort_mode,
        },
        page=payload.page,
        page_size=payload.page_size,
        user_id=user_id,
    )

    jobs = result.get("jobs") or []
    exposures = []
    for idx, job in enumerate(jobs):
        job_id = job.get("id")
        if not job_id:
            continue
        exposures.append(
            {
                "request_id": request_id,
                "user_id": user_id,
                "job_id": job_id,
                "position": int(job.get("rank_position") or (idx + 1)),
                "query": payload.search_term or "",
                "filters_json": {
                    "sort_mode": payload.sort_mode,
                    "filter_city": payload.filter_city,
                    "filter_contract_types": payload.filter_contract_types,
                    "filter_benefits": payload.filter_benefits,
                    "filter_min_salary": payload.filter_min_salary,
                    "filter_date_posted": payload.filter_date_posted,
                    "filter_experience_levels": payload.filter_experience_levels,
                    "filter_country_codes": payload.filter_country_codes,
                    "exclude_country_codes": payload.exclude_country_codes,
                    "filter_language_codes": payload.filter_language_codes,
                    "radius_km": payload.radius_km,
                },
                "ranking_features_json": {
                    "hybrid_score": job.get("hybrid_score"),
                    "fts_score": job.get("fts_score"),
                    "trigram_score": job.get("trigram_score"),
                    "profile_fit_score": job.get("profile_fit_score"),
                    "recency_score": job.get("recency_score"),
                    "behavior_prior_score": job.get("behavior_prior_score"),
                },
            }
        )
    if exposures:
        try:
            supabase.table("search_exposures").upsert(exposures, on_conflict="request_id,job_id").execute()
        except Exception as exc:
            print(f"⚠️ Failed to write search exposures: {exc}")

    meta = result.get("meta") or {}
    response = {
        "jobs": jobs,
        "has_more": result.get("has_more", False),
        "total_count": result.get("total_count", 0),
        "request_id": request_id,
        "meta": {
            "sort_mode": payload.sort_mode,
            "latency_ms": meta.get("latency_ms"),
            "fallback": meta.get("fallback"),
            "result_count": len(jobs),
        },
    }
    if payload.debug:
        response["meta"]["debug"] = {
            "user_id_present": bool(user_id),
            "engine_meta": meta,
        }
    return response

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

    # Cache fast path: return already saved analysis from jobs.ai_analysis
    if normalized_job_id is not None:
        try:
            cached = (
                supabase
                .table("jobs")
                .select("id, ai_analysis")
                .eq("id", normalized_job_id)
                .maybe_single()
                .execute()
            )
            ai_cached = (cached.data or {}).get("ai_analysis") if cached and cached.data else None
            if isinstance(ai_cached, dict) and ai_cached.get("summary"):
                return {"analysis": ai_cached, "cached": True}
        except Exception as exc:
            print(f"⚠️ Failed to read cached ai_analysis for job {normalized_job_id}: {exc}")

    default_primary = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    default_fallback = os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4.1-nano")
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
            supabase.table("jobs").update({"ai_analysis": analysis}).eq("id", normalized_job_id).execute()
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

@router.post("/match-candidates")
@limiter.limit("10/minute")
async def match_candidates_service(request: Request, job_id: str = Query(...), user: dict = Depends(verify_subscription)):
    _require_job_access(user, job_id)
    if not user.get("is_subscription_active"):
        raise HTTPException(status_code=403, detail="Active subscription required")
    job_res = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not job_res.data: raise HTTPException(status_code=404, detail="Job not found")
    job = job_res.data
    
    cand_res = supabase.table("candidate_profiles").select("*").execute()
    candidates = cand_res.data or []
    
    matches = []
    for cand in candidates:
        score, reasons = calculate_candidate_match(cand, job)
        if score > 15:
            matches.append({"candidate_id": cand["id"], "score": score, "reasons": reasons})
    
    return {"job_id": job_id, "matches": sorted(matches, key=lambda x: x["score"], reverse=True)[:10]}
