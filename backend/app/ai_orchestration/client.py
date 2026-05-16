import json
import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional
import requests

def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    raw = os.getenv(name)
    if raw is None:
        raw = os.getenv(name.replace("_", "-"))
    if raw is None:
        return default
    value = raw.strip().strip('"').strip("'")
    return value or default

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


def _usage_counts_openai(payload: Dict[str, Any]) -> tuple[int, int]:
    usage = payload.get("usage") or {}
    in_count = int(usage.get("input_tokens") or usage.get("prompt_tokens") or 0)
    out_count = int(usage.get("output_tokens") or usage.get("completion_tokens") or 0)
    return in_count, out_count


def resolve_ai_provider() -> str:
    provider = (_env("AI_PROVIDER") or "").strip().lower()
    if provider in {"azure", "mistral", "openai"}:
        return provider
    if (
        _env("AZURE_OPENAI_API_KEY")
        or _env("AZURE_AI_API_KEY")
        or _env("AZURE_INFERENCE_CREDENTIAL")
    ):
        return "azure"
    if _env("MISTRAL_API_KEY"):
        return "mistral"
    return "openai"


def get_default_primary_model() -> str:
    provider = resolve_ai_provider()
    if provider == "azure":
        return (
            _env("AZURE_OPENAI_DEPLOYMENT_NAME")
            or _env("AZURE_AI_DEPLOYMENT_NAME")
            or _env("AZURE_AI_MODEL")
            or _env("OPENAI_MODEL")
            or "gpt-5-mini"
        )
    if provider == "mistral":
        return _env("MISTRAL_MODEL") or "mistral-small-latest"
    return _env("OPENAI_MODEL") or "gpt-4.1-mini"


def get_default_fallback_model() -> Optional[str]:
    provider = resolve_ai_provider()
    if provider == "azure":
        return (
            _env("AZURE_OPENAI_FALLBACK_DEPLOYMENT_NAME")
            or _env("AZURE_AI_FALLBACK_DEPLOYMENT_NAME")
            or _env("AZURE_AI_FALLBACK_MODEL")
            or _env("OPENAI_FALLBACK_MODEL")
            or None
        )
    if provider == "mistral":
        return (
            _env("MISTRAL_FALLBACK_MODEL")
            or _env("MISTRAL_MODEL_FALLBACK")
            or None
        )
    return _env("OPENAI_FALLBACK_MODEL") or "gpt-4.1-nano"


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


def _call_mistral_chat_completion(
    prompt: str,
    model_name: str,
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
) -> AIClientResult:
    api_key = _env("MISTRAL_API_KEY")
    if not api_key:
        raise AIClientError("MISTRAL_API_KEY is not configured")

    endpoint = _env("MISTRAL_ENDPOINT") or "https://api.mistral.ai/v1/chat/completions"
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
        "Accept": "application/json",
    }

    attempt = 0
    while True:
        attempt += 1
        started = time.perf_counter()
        try:
            resp = requests.post(endpoint, headers=headers, json=payload, timeout=90)
            if resp.status_code >= 400:
                raise AIClientError(f"Mistral HTTP {resp.status_code}: {resp.text[:500]}")
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


def _call_openai_chat_completion(
    prompt: str,
    model_name: str,
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
) -> AIClientResult:
    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        raise AIClientError("OPENAI_API_KEY is not configured")

    endpoint = _env("OPENAI_ENDPOINT") or "https://openrouter.ai/api/v1/chat/completions"
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
    is_openrouter = "openrouter.ai" in endpoint
    if is_openrouter:
        headers["HTTP-Referer"] = _env("OPENROUTER_HTTP_REFERER") or "https://jobshaman.cz"
        headers["X-Title"] = _env("OPENROUTER_APP_TITLE") or "JobShaman"

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


def _call_azure_chat_completion(
    prompt: str,
    model_name: str,
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
) -> AIClientResult:
    from app.services.azure_ai_client import AzureAIClientError, call_ai_text

    temperature = (generation_config or {}).get("temperature", 0)
    attempt = 0
    while True:
        attempt += 1
        try:
            text, result = call_ai_text(
                prompt,
                model_name=model_name,
                temperature=temperature,
                timeout=90,
            )
            return AIClientResult(
                text=text,
                model_name=result.model_name,
                tokens_in=result.tokens_in,
                tokens_out=result.tokens_out,
                latency_ms=result.latency_ms,
            )
        except AzureAIClientError as exc:
            if attempt > max_retries or not _is_transient_error(exc):
                raise AIClientError(str(exc))
            backoff = 0.4 * (2 ** (attempt - 1))
            time.sleep(backoff)


def call_model_with_retry(
    prompt: str,
    model_name: str,
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
    provider_override: Optional[str] = None,
) -> AIClientResult:
    provider = (provider_override or resolve_ai_provider()).strip().lower()
    if provider == "azure":
        return _call_azure_chat_completion(
            prompt,
            model_name,
            max_retries=max_retries,
            generation_config=generation_config,
        )
    if provider == "mistral":
        return _call_mistral_chat_completion(
            prompt,
            model_name,
            max_retries=max_retries,
            generation_config=generation_config,
        )
    return _call_openai_chat_completion(
        prompt,
        model_name,
        max_retries=max_retries,
        generation_config=generation_config,
    )


def call_primary_with_fallback(
    prompt: str,
    primary_model: str,
    fallback_model: Optional[str],
    max_retries: int = 2,
    generation_config: Optional[Dict[str, Any]] = None,
    provider_override: Optional[str] = None,
) -> tuple[AIClientResult, bool]:
    default_rescue = "gpt-4.1-mini,gpt-4.1-nano"
    provider = (provider_override or resolve_ai_provider()).strip().lower()
    if provider == "azure":
        default_rescue = "gpt-5-mini"
    if provider == "mistral":
        default_rescue = "mistral-small-latest"

    rescue_raw = _env("AI_RESCUE_MODELS") or default_rescue
    rescue_models = [m.strip() for m in rescue_raw.split(",") if m.strip()]

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
                provider_override=provider,
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
    "get_default_fallback_model",
    "get_default_primary_model",
    "resolve_ai_provider",
]
