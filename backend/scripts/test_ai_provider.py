#!/usr/bin/env python3
"""
Quick provider self-test for Render shell.

Usage:
  cd backend && python scripts/test_ai_provider.py
"""

import json
import os
import sys
from pathlib import Path

# Allow running from repository root or backend/ directory.
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.ai_orchestration.client import AIClientError, call_primary_with_fallback


def _mask(value: str | None) -> str:
    if not value:
        return "MISSING"
    if len(value) < 10:
        return "***"
    return f"{value[:4]}...{value[-4:]}"


def _resolve_models() -> tuple[str, str | None]:
    provider = (os.getenv("AI_PROVIDER") or "").strip().lower()
    if provider == "azure" or os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_AI_API_KEY"):
        return (
            os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
            or os.getenv("AZURE_AI_DEPLOYMENT_NAME")
            or os.getenv("AZURE_AI_MODEL")
            or "gpt-5-mini",
            os.getenv("AZURE_OPENAI_FALLBACK_DEPLOYMENT_NAME")
            or os.getenv("AZURE_AI_FALLBACK_DEPLOYMENT_NAME")
            or os.getenv("AZURE_AI_FALLBACK_MODEL"),
        )
    if provider == "openai":
        return (
            os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            os.getenv("OPENAI_FALLBACK_MODEL", "gpt-4.1-nano"),
        )
    return (
        os.getenv("MISTRAL_MODEL", "mistral-small-latest"),
        os.getenv("MISTRAL_FALLBACK_MODEL", None),
    )


def main() -> int:
    provider = (os.getenv("AI_PROVIDER") or "").strip().lower() or "azure"
    primary_model, fallback_model = _resolve_models()
    endpoint = (
        os.getenv("AZURE_AI_FOUNDRY_ENDPOINT")
        or os.getenv("AZURE_AI_ENDPOINT")
        or os.getenv("AZURE_OPENAI_ENDPOINT")
        or os.getenv("OPENAI_ENDPOINT")
        or "(missing)"
    )

    print("=== AI Provider Self-Test ===")
    print(f"AI_PROVIDER: {provider}")
    print(f"primary_model: {primary_model}")
    print(f"fallback_model: {fallback_model}")
    print(f"AI_ENDPOINT: {endpoint}")
    print(f"AZURE_OPENAI_API_KEY: {_mask(os.getenv('AZURE_OPENAI_API_KEY'))}")
    print(f"AZURE_AI_API_KEY: {_mask(os.getenv('AZURE_AI_API_KEY'))}")
    print(f"AZURE_INFERENCE_CREDENTIAL: {_mask(os.getenv('AZURE_INFERENCE_CREDENTIAL'))}")
    print(f"OPENAI_API_KEY: {_mask(os.getenv('OPENAI_API_KEY'))}")
    print(f"MISTRAL_API_KEY: {_mask(os.getenv('MISTRAL_API_KEY'))}")
    print(f"OPENROUTER_HTTP_REFERER: {os.getenv('OPENROUTER_HTTP_REFERER', '(default)')}")
    print(f"OPENROUTER_APP_TITLE: {os.getenv('OPENROUTER_APP_TITLE', '(default)')}")
    print("")

    prompt = (
        'Return strict JSON only: {"ok": true, "provider_check": "pass", "lang": "cs"}'
    )
    try:
        result, fallback_used = call_primary_with_fallback(
            prompt=prompt,
            primary_model=primary_model,
            fallback_model=fallback_model,
            max_retries=1,
            generation_config={"temperature": 0, "top_p": 1},
        )
        print("✅ Provider call succeeded")
        print(f"model_used: {result.model_name}")
        print(f"fallback_used: {fallback_used}")
        print(f"latency_ms: {result.latency_ms}")
        print(f"tokens_in: {result.tokens_in}")
        print(f"tokens_out: {result.tokens_out}")
        text_preview = (result.text or "").strip()
        if len(text_preview) > 600:
            text_preview = text_preview[:600] + "...(truncated)"
        print("response_text:")
        print(text_preview)

        try:
            parsed = json.loads(result.text)
            print("parsed_json:", parsed)
        except Exception:
            print("parsed_json: (not valid JSON)")
        return 0
    except AIClientError as e:
        print("❌ AIClientError:", str(e))
        return 2
    except Exception as e:
        print("❌ Unexpected error:", str(e))
        return 3


if __name__ == "__main__":
    sys.exit(main())
