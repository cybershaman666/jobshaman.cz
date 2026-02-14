import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import sentry_sdk

from ..core.database import supabase


def _safe_hash(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()[:16]


def log_ai_generation(event: Dict[str, Any]) -> None:
    payload = {
        "user_id": event.get("user_id"),
        "feature": event.get("feature", "profile_generate"),
        "prompt_version": event.get("prompt_version"),
        "model_primary": event.get("model_primary"),
        "model_final": event.get("model_final"),
        "fallback_used": bool(event.get("fallback_used", False)),
        "input_chars": int(event.get("input_chars") or 0),
        "output_valid": bool(event.get("output_valid", False)),
        "latency_ms": int(event.get("latency_ms") or 0),
        "tokens_in": int(event.get("tokens_in") or 0),
        "tokens_out": int(event.get("tokens_out") or 0),
        "estimated_cost": float(event.get("estimated_cost") or 0.0),
        "error_code": event.get("error_code"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Structured log without raw user content (PII-safe)
    redacted = {
        **payload,
        "user_hash": _safe_hash(str(payload.get("user_id") or "")),
        "user_id": None,
    }
    print(f"📊 [AI Generation] {json.dumps(redacted, ensure_ascii=False)}")

    sentry_sdk.add_breadcrumb(
        category="ai",
        message="ai_generation",
        level="info",
        data={
            "feature": payload["feature"],
            "prompt_version": payload["prompt_version"],
            "model_final": payload["model_final"],
            "fallback_used": payload["fallback_used"],
            "schema_valid": payload["output_valid"],
        },
    )
    sentry_sdk.set_tag("prompt_version", payload.get("prompt_version") or "unknown")
    sentry_sdk.set_tag("model_final", payload.get("model_final") or "unknown")
    sentry_sdk.set_tag("fallback_used", str(payload.get("fallback_used", False)).lower())

    if not supabase:
        return

    try:
        supabase.table("ai_generation_logs").insert(payload).execute()
    except Exception as exc:
        print(f"⚠️ [AI Telemetry] failed to persist ai_generation_logs: {exc}")


def estimate_text_cost_usd(model_name: str, tokens_in: int, tokens_out: int) -> float:
    # Coarse price mapping; replace when billing is finalized.
    pricing = {
        "gemini-1.5-flash": (0.00000035, 0.00000105),
        "gemini-1.5-flash-8b": (0.00000018, 0.00000054),
    }
    in_price, out_price = pricing.get(model_name, (0.0000004, 0.0000012))
    return round(tokens_in * in_price + tokens_out * out_price, 8)
