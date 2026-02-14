import json
import time
from typing import Any, Dict, List, Optional

from pydantic import ValidationError

from .client import AIClientError, _extract_json, call_primary_with_fallback
from .models import (
    AIGuidedProfileAIResult,
    AIGuidedProfileResponseV2,
    AIProfileTyped,
    ProfileUpdatesTyped,
    AIGenerationMeta,
    TokenUsage,
)
from .prompt_registry import get_prompt
from .telemetry import estimate_text_cost_usd, log_ai_generation

PRIMARY_MODEL = "gemini-1.5-flash"
FALLBACK_MODEL = "gemini-1.5-flash-8b"


def _sanitize_steps(steps: List[Dict[str, str]]) -> List[Dict[str, str]]:
    safe_steps: List[Dict[str, str]] = []
    for step in steps or []:
        step_id = str(step.get("id") or "").strip()[:50]
        text = str(step.get("text") or "").strip()[:5000]
        if text:
            safe_steps.append({"id": step_id, "text": text})
    return safe_steps[:6]


def _normalize_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    profile_updates = raw.get("profile_updates") or raw.get("profileUpdates") or {}
    ai_profile = raw.get("ai_profile") or raw.get("aiProfile") or {}

    # normalize snake/camel variants from model output
    if "inferredSkills" in ai_profile and "inferred_skills" not in ai_profile:
        ai_profile["inferred_skills"] = ai_profile.get("inferredSkills")
    if "sideProjects" in ai_profile and "side_projects" not in ai_profile:
        ai_profile["side_projects"] = ai_profile.get("sideProjects")
    if "workPreferences" in ai_profile and "work_preferences" not in ai_profile:
        ai_profile["work_preferences"] = ai_profile.get("workPreferences")

    return {
        "profile_updates": profile_updates,
        "ai_profile": ai_profile,
        "cv_ai_text": raw.get("cv_ai_text") or raw.get("cvAiText") or "",
        "cv_summary": raw.get("cv_summary") or raw.get("cvSummary") or "",
    }


def _build_generation_prompt(
    system_prompt: str,
    language: str,
    existing_profile: Optional[Dict[str, Any]],
    steps: List[Dict[str, str]],
) -> str:
    steps_text = "\n\n".join([f"[{s['id']}] {s['text']}" for s in steps])
    existing_json = json.dumps(existing_profile or {}, ensure_ascii=False)

    schema_hint = {
        "profile_updates": {
            "name": "string|null",
            "email": "string|null",
            "phone": "string|null",
            "jobTitle": "string|null",
            "skills": ["string"],
            "workHistory": [{"role": "string", "company": "string", "duration": "string", "description": "string"}],
            "education": [{"school": "string", "degree": "string", "year": "string"}],
            "cvText": "string|null",
        },
        "ai_profile": {
            "story": "string",
            "hobbies": ["string"],
            "volunteering": ["string"],
            "leadership": ["string"],
            "strengths": ["string"],
            "values": ["string"],
            "inferred_skills": ["string"],
            "awards": ["string"],
            "certifications": ["string"],
            "side_projects": ["string"],
            "motivations": ["string"],
            "work_preferences": ["string"],
        },
        "cv_ai_text": "string",
        "cv_summary": "string (<=300 chars)",
    }

    return f"""
{system_prompt}

Return STRICT JSON only. No markdown, no commentary.
Language: {language}

Rules:
- Follow exactly this schema: {json.dumps(schema_hint, ensure_ascii=False)}
- Arrays must contain strings only.
- Infer hidden strengths from hobbies/volunteering/leadership where possible.
- Keep cv_summary concise and professional.

Existing profile context:
{existing_json}

User story steps:
{steps_text}
""".strip()


def _build_repair_prompt(original_prompt: str, invalid_output: str, error_message: str) -> str:
    return f"""
The previous output was invalid JSON/schema.
Error: {error_message}
Return corrected STRICT JSON only for the same task.

Original task:
{original_prompt}

Invalid output:
{invalid_output[:7000]}
""".strip()


def generate_profile_with_orchestration(
    user_id: str,
    steps: List[Dict[str, str]],
    language: str = "cs",
    existing_profile: Optional[Dict[str, Any]] = None,
    requested_prompt_version: Optional[str] = None,
) -> AIGuidedProfileResponseV2:
    safe_steps = _sanitize_steps(steps)
    if not safe_steps:
        raise ValueError("No valid steps provided")

    prompt_version, system_prompt = get_prompt("profile_generate", requested_prompt_version)
    prompt = _build_generation_prompt(system_prompt, language, existing_profile, safe_steps)

    started = time.perf_counter()
    model_final = PRIMARY_MODEL
    fallback_used = False
    tokens_in = 0
    tokens_out = 0
    output_valid = False
    error_code = None

    try:
        result, fallback_used = call_primary_with_fallback(prompt, PRIMARY_MODEL, FALLBACK_MODEL)
        model_final = result.model_name
        tokens_in += result.tokens_in
        tokens_out += result.tokens_out

        parsed = _extract_json(result.text)
        normalized = _normalize_payload(parsed)

        try:
            typed = AIGuidedProfileAIResult(**normalized)
            output_valid = True
        except ValidationError as schema_error:
            repair_prompt = _build_repair_prompt(prompt, result.text, str(schema_error))
            repaired, repaired_fallback = call_primary_with_fallback(repair_prompt, PRIMARY_MODEL, FALLBACK_MODEL)
            fallback_used = fallback_used or repaired_fallback
            model_final = repaired.model_name
            tokens_in += repaired.tokens_in
            tokens_out += repaired.tokens_out
            repaired_parsed = _extract_json(repaired.text)
            typed = AIGuidedProfileAIResult(**_normalize_payload(repaired_parsed))
            output_valid = True

        latency_ms = int((time.perf_counter() - started) * 1000)
        estimated_cost = estimate_text_cost_usd(model_final, tokens_in, tokens_out)

        log_ai_generation(
            {
                "user_id": user_id,
                "feature": "profile_generate",
                "prompt_version": prompt_version,
                "model_primary": PRIMARY_MODEL,
                "model_final": model_final,
                "fallback_used": fallback_used,
                "input_chars": len(prompt),
                "output_valid": output_valid,
                "latency_ms": latency_ms,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "estimated_cost": estimated_cost,
                "error_code": None,
            }
        )

        return AIGuidedProfileResponseV2(
            profile_updates=typed.profile_updates,
            ai_profile=typed.ai_profile,
            cv_ai_text=typed.cv_ai_text,
            cv_summary=typed.cv_summary,
            meta=AIGenerationMeta(
                prompt_version=prompt_version,
                model_used=model_final,
                fallback_used=fallback_used,
                latency_ms=latency_ms,
                token_usage=TokenUsage(input=tokens_in, output=tokens_out),
            ),
        )

    except AIClientError:
        error_code = "provider_error"
        raise
    except ValidationError:
        error_code = "schema_validation_error"
        raise
    except Exception:
        error_code = "pipeline_error"
        raise
    finally:
        if not output_valid:
            latency_ms = int((time.perf_counter() - started) * 1000)
            log_ai_generation(
                {
                    "user_id": user_id,
                    "feature": "profile_generate",
                    "prompt_version": prompt_version,
                    "model_primary": PRIMARY_MODEL,
                    "model_final": model_final,
                    "fallback_used": fallback_used,
                    "input_chars": len(prompt),
                    "output_valid": False,
                    "latency_ms": latency_ms,
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "estimated_cost": estimate_text_cost_usd(model_final, tokens_in, tokens_out),
                    "error_code": error_code,
                }
            )
