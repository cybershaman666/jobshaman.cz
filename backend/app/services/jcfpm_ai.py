from __future__ import annotations
import json
from typing import Any, Dict, List
from ..ai_orchestration.client import call_primary_with_fallback, _extract_json, AIClientError
from ..core.runtime_config import get_active_model_config

DEFAULT_REPORT = {
    "strengths": [],
    "ideal_environment": [],
    "top_roles": [],
    "development_areas": [],
    "next_steps": [],
    "ai_readiness": "",
}


def _build_prompt(payload: Dict[str, Any]) -> str:
    return f"""
Vytvoř personalizovaný career report na základě následujícího profilu.
Odpověz STRICT JSON ve tvaru:
{{
  "strengths": ["..."],
  "ideal_environment": ["..."],
  "top_roles": [{{"title": "...", "reason": "..."}}],
  "development_areas": ["..."],
  "next_steps": ["..."],
  "ai_readiness": "..."
}}

Profil:
{json.dumps(payload, ensure_ascii=False, indent=2)}
""".strip()


def generate_jcfpm_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    cfg = get_active_model_config("ai_orchestration", "jcfpm_report")
    primary = cfg.get("primary_model") or "gpt-4.1-mini"
    fallback = cfg.get("fallback_model") or "gpt-4.1-nano"
    generation_config = {
        "temperature": cfg.get("temperature", 0.2),
        "top_p": cfg.get("top_p", 1),
    }
    prompt = _build_prompt(payload)
    try:
        result, _ = call_primary_with_fallback(prompt, primary, fallback, generation_config=generation_config)
        parsed = _extract_json(result.text)
        if not isinstance(parsed, dict):
            raise AIClientError("Invalid AI report payload")
        return {
            "strengths": list(parsed.get("strengths") or []),
            "ideal_environment": list(parsed.get("ideal_environment") or []),
            "top_roles": list(parsed.get("top_roles") or []),
            "development_areas": list(parsed.get("development_areas") or []),
            "next_steps": list(parsed.get("next_steps") or []),
            "ai_readiness": str(parsed.get("ai_readiness") or ""),
        }
    except Exception:
        return DEFAULT_REPORT
