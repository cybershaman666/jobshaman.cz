import os
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone

from ..ai_orchestration.client import AIClientError, call_primary_with_fallback, _extract_json
from ..ai_orchestration.pipeline import generate_profile_with_orchestration
from ..core.runtime_config import get_active_model_config
from ..core.limiter import limiter
from ..core.security import verify_subscription
from ..core.database import supabase
from ..models.requests import AIGuidedProfileRequest, AIGuidedProfileRequestV2, AIExecuteRequest
from ..models.responses import AIGuidedProfileResponse, AIGuidedProfileResponseV2

router = APIRouter()


def _parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
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


def _subscription_allows_ai_profile(sub: dict) -> bool:
    tier = (sub.get("tier") or "").lower()
    allowed_tiers = {"premium"}
    return _is_active_subscription(sub) and tier in allowed_tiers


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


def _require_ai_profile_access(user: dict) -> str:
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")

    # 1) Fast path from verify_subscription context
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier in {"premium"}:
        return user_id

    # 2) User-level subscription (authoritative for candidate-side AI profile)
    user_sub = _fetch_latest_subscription_by("user_id", user_id)
    if _subscription_allows_ai_profile(user_sub or {}):
        return user_id

    # 3) Company-level fallback for recruiter/company plans
    company_id = user.get("company_id")
    if company_id and company_id in (user.get("authorized_ids") or []):
        company_sub = _fetch_latest_subscription_by("company_id", company_id)
        if _subscription_allows_ai_profile(company_sub or {}):
            return user_id

    raise HTTPException(status_code=403, detail="Premium subscription required")

    return user_id


def _user_has_allowed_subscription(user: dict, allowed_tiers: set[str]) -> bool:
    user_tier = (user.get("subscription_tier") or "").lower()
    if user.get("is_subscription_active") and user_tier in allowed_tiers:
        return True

    user_id = user.get("id") or user.get("auth_id")
    if user_id:
        user_sub = _fetch_latest_subscription_by("user_id", user_id)
        if user_sub and _is_active_subscription(user_sub) and (user_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    for company_id in (user.get("authorized_ids") or []):
        if company_id == user_id:
            continue
        company_sub = _fetch_latest_subscription_by("company_id", company_id)
        if company_sub and _is_active_subscription(company_sub) and (company_sub.get("tier") or "").lower() in allowed_tiers:
            return True

    return False


def _model_cfg(feature: str, default_openai: str = "gpt-4.1-mini", default_openai_fallback: str = "gpt-4.1-nano"):
    cfg = get_active_model_config("ai_orchestration", feature)
    primary = cfg.get("primary_model")
    fallback = cfg.get("fallback_model")

    if not primary:
        primary = default_openai
    if not fallback:
        fallback = default_openai_fallback

    generation_config = {
        "temperature": cfg.get("temperature", 0),
        "top_p": cfg.get("top_p", 1),
        "top_k": cfg.get("top_k", 1),
    }
    return primary, fallback, generation_config


def _ai_json(prompt: str, feature: str) -> tuple[dict[str, Any], dict[str, Any]]:
    primary, fallback, generation_config = _model_cfg(feature)
    result, fallback_used = call_primary_with_fallback(
        prompt,
        primary,
        fallback,
        generation_config=generation_config,
    )
    parsed = _extract_json(result.text)
    meta = {
        "model_used": result.model_name,
        "fallback_used": fallback_used,
        "token_usage": {"input": result.tokens_in, "output": result.tokens_out},
        "latency_ms": result.latency_ms,
    }
    return parsed, meta


def _ai_text(prompt: str, feature: str) -> tuple[str, dict[str, Any]]:
    primary, fallback, generation_config = _model_cfg(feature)
    result, fallback_used = call_primary_with_fallback(
        prompt,
        primary,
        fallback,
        generation_config=generation_config,
    )
    meta = {
        "model_used": result.model_name,
        "fallback_used": fallback_used,
        "token_usage": {"input": result.tokens_in, "output": result.tokens_out},
        "latency_ms": result.latency_ms,
    }
    return (result.text or "").strip(), meta


def _execute_ai_action(action: str, params: dict[str, Any] | None) -> dict[str, Any]:
    p = params or {}

    if action == "generate_assessment":
        role = str(p.get("role") or "Kandidát")
        difficulty = str(p.get("difficulty") or "Senior")
        raw_skills = p.get("skills") or []
        skills = [str(s).strip() for s in (raw_skills if isinstance(raw_skills, list) else []) if str(s).strip()][:20]
        prompt = f"""
Vytvoř praktický Digital Assessment Center pro roli "{role}" (obtížnost: {difficulty}).
Skills: {", ".join(skills) if skills else "obecné dovednosti"}.
Vrať STRICT JSON:
{{
  "title": "string",
  "description": "string",
  "timeLimitSeconds": number,
  "questions": [{{"id":"q1","text":"...","type":"Code|Open|Scenario|MultipleChoice","category":"Technical|Situational|Practical|Logic","options":["..."],"correctAnswer":"..."}}]
}}
Pravidla:
- 8 až 14 otázek
- každá otázka musí mít unikátní id
- pro MultipleChoice přidej options i correctAnswer
- bez markdownu
""".strip()
        parsed, meta = _ai_json(prompt, "assessment_generate")
        questions = parsed.get("questions") if isinstance(parsed, dict) else None
        if not isinstance(questions, list):
            raise ValueError("Invalid assessment response: questions missing")
        return {
            "assessment": {
                "id": str(p.get("id") or ""),
                "role": role,
                "title": str(parsed.get("title") or f"Assessment: {role}"),
                "description": str(parsed.get("description") or ""),
                "timeLimitSeconds": int(parsed.get("timeLimitSeconds") or 1200),
                "questions": questions,
            },
            "meta": meta,
        }

    if action == "evaluate_assessment_result":
        role = str(p.get("role") or "Candidate")
        difficulty = str(p.get("difficulty") or "Senior")
        questions = p.get("questions") or []
        answers = p.get("answers") or []
        prompt = f"""
Vyhodnoť assessment odpovědi kandidáta pro roli "{role}" ({difficulty}).
Otázky: {questions}
Odpovědi: {answers}
Vrať STRICT JSON:
{{
  "pros": ["..."],
  "cons": ["..."],
  "summary": "string",
  "skillMatchScore": number,
  "recommendation": "string",
  "questionFeedback": [{{"questionId":"q1","feedback":"..."}}]
}}
Bez markdownu.
""".strip()
        parsed, meta = _ai_json(prompt, "assessment_evaluate")
        return {"evaluation": parsed, "meta": meta}

    if action == "extract_skills_from_job":
        title = str(p.get("title") or "")
        description = str(p.get("description") or "")
        prompt = f"""
Extract 5-12 key skills from this job offer.
Title: {title}
Description: {description[:6000]}
Return STRICT JSON: {{"skills":["skill1","skill2"]}}
""".strip()
        parsed, meta = _ai_json(prompt, "job_skill_extract")
        skills = parsed.get("skills") if isinstance(parsed, dict) else []
        if not isinstance(skills, list):
            skills = []
        skills = [str(s).strip() for s in skills if str(s).strip()][:20]
        return {"skills": skills, "meta": meta}

    if action == "optimize_job_description":
        desc = str(p.get("description") or p.get("currentDescription") or "")
        tone = str((p.get("companyProfile") or {}).get("tone") or p.get("tone") or "")
        values = (p.get("companyProfile") or {}).get("values") or p.get("values") or []
        philosophy = str((p.get("companyProfile") or {}).get("philosophy") or p.get("philosophy") or "")
        prompt = f"""
Rewrite this job ad in Czech, remove cliches and improve clarity.
Company tone: {tone}
Company values: {values}
Company philosophy: {philosophy}
Input: {desc[:7000]}
Return STRICT JSON:
{{
  "rewrittenText": "string",
  "removedCliches": ["string"],
  "improvedClarity": "string"
}}
""".strip()
        parsed, meta = _ai_json(prompt, "job_ad_optimize")
        return {"result": parsed, "meta": meta}

    if action == "generate_cover_letter":
        job_title = str(p.get("jobTitle") or "")
        company = str(p.get("company") or "")
        description = str(p.get("description") or "")
        experience = str(p.get("userExperience") or "")
        candidate_cv = str(p.get("candidateCvText") or "")
        prompt = f"""
Napiš krátký profesionální motivační dopis v češtině pro pozici "{job_title}" ve firmě "{company}".
Kontext inzerátu: {description[:4000]}
Vstup kandidáta: {experience[:3000]}
CV kandidáta: {candidate_cv[:4000]}
Max 220 slov, bez klišé.
""".strip()
        text, meta = _ai_text(prompt, "cover_letter")
        return {"text": text, "meta": meta}

    if action == "parse_profile_from_cv":
        cv_text = str(p.get("text") or p.get("cvText") or "")
        prompt = f"""
Extract candidate profile data from CV text.
CV text:
{cv_text[:12000]}
Return STRICT JSON with keys:
name, email, phone, jobTitle, cvText, skills, workHistory, education
where workHistory items: role, company, duration, description
and education items: school, degree, year
""".strip()
        parsed, meta = _ai_json(prompt, "cv_parse")
        return {"profile": parsed, "meta": meta}

    if action == "estimate_salary":
        title = str(p.get("title") or "")
        company = str(p.get("company") or "")
        location = str(p.get("location") or "")
        description = str(p.get("description") or "")
        prompt = f"""
Estimate gross monthly salary range in CZK for:
Title: {title}
Company: {company}
Location: {location}
Description: {description[:3000]}
Return STRICT JSON: {{"min": number, "max": number, "currency": "CZK"}}
""".strip()
        parsed, meta = _ai_json(prompt, "salary_estimate")
        return {"salary": parsed, "meta": meta}

    if action == "analyze_user_cv":
        cv_text = str(p.get("cvText") or "")
        prompt = f"""
Analyze this CV and return STRICT JSON:
{{
  "summary":"string",
  "currentLevel":"string",
  "suggestedCareerPath":"string",
  "marketValueEstimation":"string",
  "skillGaps":["string"],
  "upsellCourses":[{{"name":"string","description":"string","estimatedSalaryBump":"string","price":"string"}}]
}}
CV:
{cv_text[:9000]}
""".strip()
        parsed, meta = _ai_json(prompt, "cv_analyze")
        return {"analysis": parsed, "meta": meta}

    if action == "optimize_cv_for_ats":
        cv_text = str(p.get("cvText") or "")
        prompt = f"""
Rewrite this CV for ATS readability in Czech.
CV:
{cv_text[:9000]}
Return STRICT JSON: {{"optimizedText":"string","improvements":["string"]}}
""".strip()
        parsed, meta = _ai_json(prompt, "cv_ats_optimize")
        return {"optimized": parsed, "meta": meta}

    if action == "match_candidate_to_job":
        candidate_bio = str(p.get("candidateBio") or "")
        job_desc = str(p.get("jobDescription") or "")
        prompt = f"""
Compare candidate to job and return STRICT JSON: {{"score": number, "reason": "string"}}
Candidate: {candidate_bio[:5000]}
Job: {job_desc[:5000]}
""".strip()
        parsed, meta = _ai_json(prompt, "candidate_job_match")
        return {"match": parsed, "meta": meta}

    if action == "generate_styled_cv":
        template = str(p.get("template") or "ATS Minimal")
        profile = p.get("profile") or {}
        prompt = f"""
Create Czech CV in markdown using template "{template}".
Profile JSON:
{profile}
Return markdown only.
""".strip()
        text, meta = _ai_text(prompt, "cv_generate")
        return {"markdown": text, "meta": meta}

    if action == "get_shaman_advice":
        user_profile = p.get("userProfile") or {}
        job_description = str(p.get("jobDescription") or "")
        prompt = f"""
Compare user profile to job and return STRICT JSON:
{{
  "matchScore": number,
  "missingSkills": ["string"],
  "salaryImpact": "string",
  "seniorityLabel": "string",
  "reasoning": "string",
  "learningTimeHours": number
}}
Profile: {user_profile}
Job: {job_description[:6000]}
""".strip()
        parsed, meta = _ai_json(prompt, "shaman_advice")
        return {"advice": parsed, "meta": meta}

    raise HTTPException(status_code=400, detail=f"Unsupported AI action: {action}")


@router.post("/ai/profile/generate", response_model=AIGuidedProfileResponseV2)
@limiter.limit("8/minute")
async def profile_generate_v2(
    payload: AIGuidedProfileRequestV2,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    user_id = _require_ai_profile_access(user)

    try:
        result = generate_profile_with_orchestration(
            user_id=user_id,
            steps=[{"id": s.id, "text": s.text} for s in payload.steps],
            language=payload.language or "cs",
            existing_profile=payload.existingProfile or {},
            requested_prompt_version=payload.prompt_version,
        )
    except ValueError as e:
        if "release flag" in str(e).lower() or "disabled" in str(e).lower():
            raise HTTPException(status_code=503, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except AIClientError as e:
        raise HTTPException(status_code=503, detail=f"AI provider unavailable: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")

    return result


@router.post("/ai/profile-from-story", response_model=AIGuidedProfileResponse)
@limiter.limit("5/minute")
async def profile_from_story(
    payload: AIGuidedProfileRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    """Legacy endpoint kept for backward compatibility. Maps V2 response to old contract."""
    user_id = _require_ai_profile_access(user)

    try:
        result = generate_profile_with_orchestration(
            user_id=user_id,
            steps=[{"id": s.id, "text": s.text} for s in payload.steps],
            language=payload.language or "cs",
            existing_profile=payload.existingProfile or {},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")

    return {
        "profileUpdates": result.profile_updates.model_dump(),
        "aiProfile": result.ai_profile.model_dump(),
        "cv_ai_text": result.cv_ai_text,
        "cv_summary": result.cv_summary,
    }


@router.post("/ai/execute")
@limiter.limit("40/minute")
async def ai_execute(
    payload: AIExecuteRequest,
    request: Request,
    user: dict = Depends(verify_subscription),
):
    action = (payload.action or "").strip()
    params = payload.params or {}

    try:
        # Candidate-only AI tools: premium users only (no company plans).
        if action in {"generate_cover_letter", "parse_profile_from_cv", "analyze_user_cv", "optimize_cv_for_ats", "get_shaman_advice", "estimate_salary"}:
            allowed = {"premium"}
            if not _user_has_allowed_subscription(user, allowed):
                raise HTTPException(status_code=403, detail="Premium subscription required")

        # Company assessment tooling: company plans only.
        if action in {"evaluate_assessment_result", "extract_skills_from_job", "optimize_job_description", "match_candidate_to_job"}:
            allowed = {"basic", "professional", "enterprise", "assessment_bundle"}
            if not _user_has_allowed_subscription(user, allowed):
                raise HTTPException(status_code=403, detail="Company subscription required")

        result = _execute_ai_action(action, params)
        return {"ok": True, **result}
    except HTTPException:
        raise
    except AIClientError as e:
        raise HTTPException(status_code=503, detail=f"AI provider unavailable: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI response invalid: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")


@router.post("/ai/execute-public")
@limiter.limit("20/minute")
async def ai_execute_public(
    payload: AIExecuteRequest,
    request: Request,
):
    action = (payload.action or "").strip()
    if action not in {"generate_assessment"}:
        raise HTTPException(status_code=403, detail="Unsupported public AI action")

    try:
        result = _execute_ai_action(action, payload.params or {})
        return {"ok": True, **result}
    except HTTPException:
        raise
    except AIClientError as e:
        raise HTTPException(status_code=503, detail=f"AI provider unavailable: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI response invalid: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)}")
