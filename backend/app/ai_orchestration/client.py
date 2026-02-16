import json
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional
import requests

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


def _usage_counts_openai(payload: Dict[str, Any]) -> tuple[int, int]:
    usage = payload.get("usage") or {}
    in_count = int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
    out_count = int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
    return in_count, out_count


def _extract_openai_text(payload: Dict[str, Any]) -> str:
    # Responses API style
    output = payload.get("output")
    if isinstance(output, list):
        chunks = []
        for item in output:
            content = item.get("content") if isinstance(item, dict) else None
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        txt = part.get("text")
                        if isinstance(txt, str) and txt.strip():
                            chunks.append(txt)
        joined = "\n".join(chunks).strip()
        if joined:
            return joined

    # Chat Completions style
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        msg = (choices[0] or {}).get("message") or {}
        content = msg.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    txt = part.get("text")
                    if isinstance(txt, str) and txt.strip():
                        parts.append(txt)
            if parts:
                return "\n".join(parts).strip()

    raise AIClientError("OpenAI response did not contain text")


def _call_openai_chat_completion(
    prompt: str,
    model_name: str,
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
) -> AIClientResult:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIClientError("OPENAI_API_KEY is not configured")

    endpoint = os.getenv("OPENAI_ENDPOINT", "https://api.openai.com/v1/chat/completions")
    temperature = (generation_config or {}).get("temperature", 0)
    top_p = (generation_config or {}).get("top_p", 1)

    payload = {
        "model": model_name,
        "temperature": temperature,
        "top_p": top_p,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    attempt = 0
    while True:
        attempt += 1
        started = time.perf_counter()
        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=90)
            if resp.status_code >= 400:
                raise AIClientError(f"OpenAI HTTP {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            text = _extract_openai_text(data)
            tokens_in, tokens_out = _usage_counts_openai(data)
            return AIClientResult(
                text=text,
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


def _resolve_provider(model_name: str) -> str:
    lowered = (model_name or "").strip().lower()
    if lowered.startswith("gemini"):
        return "gemini"
    if lowered.startswith("gpt-") or lowered.startswith("o"):
        return "openai"

    explicit = (os.getenv("AI_PROVIDER") or "").strip().lower()
    if explicit in {"openai", "gemini"}:
        return explicit
    return "gemini"


def call_model_with_retry(
    prompt: str,
    model_name: str,
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
) -> AIClientResult:
    provider = _resolve_provider(model_name)
    if provider == "openai":
        return _call_openai_chat_completion(
            prompt,
            model_name,
            max_retries=max_retries,
            generation_config=generation_config,
        )

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
                generation_config=(generation_config or {
                    # Production determinism: stable outputs for same prompt/input.
                    "temperature": 0,
                    "top_p": 1,
                    "top_k": 1,
                }),
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
    generation_config: Optional[Dict[str, Any]] = None,
) -> tuple[AIClientResult, bool]:
    rescue_models = [
        m.strip()
        for m in os.getenv(
            "GEMINI_RESCUE_MODELS",
            "gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-flash-8b",
        ).split(",")
        if m.strip()
    ]

    chain = [primary_model]
    if fallback_model:
        chain.append(fallback_model)
    chain.extend(rescue_models)

    # Preserve order, drop duplicates.
    ordered_unique: list[str] = []
    for name in chain:
        if name not in ordered_unique:
            ordered_unique.append(name)

    last_error: Optional[Exception] = None
    for index, model_name in enumerate(ordered_unique):
        try:
            return call_model_with_retry(
                prompt,
                model_name,
                max_retries=max_retries,
                generation_config=generation_config,
            ), (index > 0)
        except Exception as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    raise AIClientError("No usable AI model configured")


__all__ = [
    "AIClientError",
    "AIClientResult",
    "_extract_json",
    "call_primary_with_fallback",
]
