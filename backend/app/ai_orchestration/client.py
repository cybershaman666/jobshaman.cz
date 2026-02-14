import json
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

class AIClientError(Exception):
    pass


@dataclass
class AIClientResult:
    text: str
    model_name: str
    tokens_in: int
    tokens_out: int
    latency_ms: int


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        raise AIClientError("Empty model response")

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            raise AIClientError("Model response is not valid JSON")
        return json.loads(cleaned[start : end + 1])


def _is_transient_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in ["timeout", "temporar", "unavailable", "resource exhausted", "429", "503"])


def _usage_counts(response: Any) -> tuple[int, int]:
    usage = getattr(response, "usage_metadata", None)
    if not usage:
        return 0, 0
    in_count = int(getattr(usage, "prompt_token_count", 0) or 0)
    out_count = int(getattr(usage, "candidates_token_count", 0) or 0)
    return in_count, out_count


def call_model_with_retry(prompt: str, model_name: str, max_retries: int = 2) -> AIClientResult:
    try:
        import google.generativeai as genai
    except Exception as exc:
        raise AIClientError(f"google-generativeai is not installed: {exc}")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise AIClientError("GEMINI_API_KEY is not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    attempt = 0
    while True:
        attempt += 1
        started = time.perf_counter()
        try:
            response = model.generate_content(
                prompt,
                generation_config={
                    # Production determinism: stable outputs for same prompt/input.
                    "temperature": 0,
                    "top_p": 1,
                    "top_k": 1,
                },
            )
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            tokens_in, tokens_out = _usage_counts(response)
            return AIClientResult(
                text=(response.text or "").strip(),
                model_name=model_name,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                latency_ms=elapsed_ms,
            )
        except Exception as exc:
            if attempt > max_retries or not _is_transient_error(exc):
                raise AIClientError(str(exc))
            backoff = 0.4 * (2 ** (attempt - 1))
            time.sleep(backoff)


def call_primary_with_fallback(
    prompt: str,
    primary_model: str,
    fallback_model: Optional[str],
    max_retries: int = 2,
) -> tuple[AIClientResult, bool]:
    try:
        return call_model_with_retry(prompt, primary_model, max_retries=max_retries), False
    except Exception:
        if not fallback_model:
            raise
        return call_model_with_retry(prompt, fallback_model, max_retries=max_retries), True


__all__ = [
    "AIClientError",
    "AIClientResult",
    "_extract_json",
    "call_primary_with_fallback",
]
