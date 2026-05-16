import json
import os
import time
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests


logger = logging.getLogger(__name__)


class AzureAIClientError(Exception):
    pass


@dataclass
class AzureAIResult:
    text: str
    model_name: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0


@dataclass
class AzureAIEmbeddingResult:
    embeddings: list[list[float]]
    model_name: str
    tokens_used: int = 0
    latency_ms: int = 0


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    raw = os.getenv(name)
    if raw is None:
        raw = os.getenv(name.replace("_", "-"))
    if raw is None:
        return default
    value = raw.strip().strip('"').strip("'")
    return value or default


def _normalize_base_url(endpoint: str) -> str:
    return endpoint.rstrip("/")


def _deployment_name(model_name: Optional[str] = None) -> str:
    return (
        model_name
        or _env("AZURE_OPENAI_DEPLOYMENT_NAME")
        or _env("AZURE_AI_DEPLOYMENT_NAME")
        or _env("AZURE_AI_MODEL")
        or _env("OPENAI_MODEL")
        or "gpt-5-mini"
    )


def _api_key() -> Optional[str]:
    return (
        _env("AZURE_OPENAI_API_KEY")
        or _env("AZURE_AI_API_KEY")
        or _env("AZURE_INFERENCE_CREDENTIAL")
        or _env("OPEN_API_KEY")
        or _env("OPENAI_API_KEY")
    )


def _chat_endpoint() -> tuple[str, dict[str, str], bool]:
    """
    Return URL, headers, and whether the model/deployment belongs in the JSON body.

    Supports both current Azure AI Foundry model inference endpoints:
    - https://<resource>.services.ai.azure.com/models/chat/completions
    - https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions
    """
    key = _api_key()
    if not key:
        raise AzureAIClientError(
            "Azure AI key is not configured. Set AZURE_OPENAI_API_KEY, "
            "AZURE_AI_API_KEY, AZURE_INFERENCE_CREDENTIAL, or OPENAI_API_KEY."
        )

    headers = {
        "api-key": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    endpoint = (
        _env("AZURE_AI_FOUNDRY_ENDPOINT")
        or _env("AZURE_AI_ENDPOINT")
        or _env("AZURE_OPENAI_ENDPOINT")
        or _env("OPENAI_ENDPOINT")
        or "https://jobshaman.openai.azure.com/"
    )
    if not endpoint:
        raise AzureAIClientError(
            "Azure AI endpoint is not configured. Set AZURE_AI_FOUNDRY_ENDPOINT, "
            "AZURE_AI_ENDPOINT, AZURE_OPENAI_ENDPOINT, or OPENAI_ENDPOINT."
        )

    base = _normalize_base_url(endpoint)
    api_version = _env("AZURE_AI_API_VERSION", "2024-05-01-preview")
    azure_openai_api_version = _env("AZURE_OPENAI_API_VERSION", "2024-10-21")

    if "/chat/completions" in base:
        sep = "&" if "?" in base else "?"
        if "api-version=" not in base and "services.ai.azure.com" in base:
            base = f"{base}{sep}api-version={api_version}"
        logger.debug("Using chat completions URL %s (model_in_body=True)", base)
        return base, headers, True

    if base.endswith("/models"):
        return f"{base}/chat/completions?api-version={api_version}", headers, True

    if "services.ai.azure.com" in base:
        return f"{base}/models/chat/completions?api-version={api_version}", headers, True

    if base.endswith("/openai/v1"):
        logger.debug("Using openai/v1 chat completions base %s", base)
        return f"{base}/chat/completions", headers, True

    deployment = _deployment_name()
    url = (
        f"{base}/openai/deployments/{deployment}/chat/completions"
        f"?api-version={azure_openai_api_version}"
    )
    logger.debug("Using deployment URL %s (deployment=%s, model_in_body=False)", url, deployment)
    return url, headers, False


def _extract_text(payload: Dict[str, Any]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = (choices[0] or {}).get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
        if isinstance(content, list):
            parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("text")
            ]
            if parts:
                return "\n".join(parts).strip()

    output = payload.get("output")
    if isinstance(output, list):
        parts: list[str] = []
        for item in output:
            content = item.get("content") if isinstance(item, dict) else None
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and isinstance(part.get("text"), str):
                        parts.append(part["text"])
        if parts:
            return "\n".join(parts).strip()

    raise AzureAIClientError("Azure AI response did not contain text")


def _extract_json_object(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end < start:
            raise AzureAIClientError("Azure AI response did not contain a JSON object")
        return json.loads(cleaned[start : end + 1])


def _usage_counts(payload: Dict[str, Any]) -> tuple[int, int]:
    usage = payload.get("usage") or {}
    return (
        int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0),
        int(usage.get("completion_tokens") or usage.get("output_tokens") or 0),
    )


def call_ai_text(
    prompt: str,
    *,
    model_name: Optional[str] = None,
    temperature: float = 0.2,
    timeout: int = 90,
    response_format: Optional[Dict[str, Any]] = None,
) -> tuple[str, AzureAIResult]:
    url, headers, model_in_body = _chat_endpoint()
    model = _deployment_name(model_name)
    payload: Dict[str, Any] = {
        "messages": [{"role": "user", "content": prompt}],
    }
    if model_in_body:
        payload["model"] = model
    if response_format:
        payload["response_format"] = response_format

    # GPT-5 family deployments can reject temperature/top_p on some Azure routes.
    if _env("AZURE_AI_INCLUDE_SAMPLING_PARAMS", "false").lower() in {"1", "true", "yes", "on"}:
        payload["temperature"] = temperature
        payload["top_p"] = 1

    started = time.perf_counter()
    try:
        logger.debug("POST %s (model=%s) payload keys=%s", url, model, list(payload.keys()))
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    except Exception as exc:
        logger.exception("Request to Azure AI failed")
        raise AzureAIClientError(f"Azure AI request failed: {exc}") from exc
    if resp.status_code == 400 and response_format and "response_format" in resp.text:
        payload.pop("response_format", None)
        try:
            logger.debug("Retry POST %s after removing response_format", url)
            resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        except Exception as exc:
            logger.exception("Retry request to Azure AI failed")
            raise AzureAIClientError(f"Azure AI request failed: {exc}") from exc
    if resp.status_code >= 400:
        logger.warning("Azure AI HTTP %s: %s", resp.status_code, resp.text[:500])
        raise AzureAIClientError(f"Azure AI HTTP {resp.status_code}: {resp.text[:500]}")

    try:
        response_payload = resp.json()
    except Exception as exc:
        logger.exception("Failed to parse JSON response from Azure AI (status=%s): %s", resp.status_code, resp.text[:1000])
        raise AzureAIClientError(f"Azure AI returned invalid JSON (status {resp.status_code})") from exc
    text = _extract_text(response_payload)
    tokens_in, tokens_out = _usage_counts(response_payload)
    return text, AzureAIResult(
        text=text,
        model_name=model,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )


def call_ai_json(
    prompt: str,
    *,
    model_name: Optional[str] = None,
    temperature: float = 0.2,
    timeout: int = 90,
) -> tuple[Dict[str, Any], AzureAIResult]:
    text, result = call_ai_text(
        prompt,
        model_name=model_name,
        temperature=temperature,
        timeout=timeout,
        response_format={"type": "json_object"},
    )
    return _extract_json_object(text), result


def call_ai_embed(
    texts: list[str],
    *,
    model_name: Optional[str] = None,
    timeout: int = 60,
) -> AzureAIEmbeddingResult:
    key = _api_key()
    if not key:
        raise AzureAIClientError("Azure AI key is not configured")

    endpoint = (
        _env("AZURE_AI_EMBEDDING_ENDPOINT")
        or _env("AZURE_AI_FOUNDRY_ENDPOINT")
        or _env("AZURE_AI_ENDPOINT")
        or _env("AZURE_OPENAI_ENDPOINT")
        or "https://jobshaman.openai.azure.com/"
    )
    if not endpoint:
        raise AzureAIClientError("Azure AI embedding endpoint is not configured")

    model = (
        model_name
        or _env("AZURE_AI_EMBEDDING_MODEL")
        or _env("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME")
        or _env("OPENAI_EMBEDDING_MODEL")
        or "text-embedding-3-large"
    )
    base = _normalize_base_url(endpoint)
    api_version = _env("AZURE_AI_API_VERSION", "2024-05-01-preview")
    azure_openai_api_version = _env("AZURE_OPENAI_API_VERSION", "2024-10-21")
    model_in_body = True
    if "/embeddings" in base:
        url = base
        if "api-version=" not in url and "services.ai.azure.com" in url:
            url = f"{url}{'&' if '?' in url else '?'}api-version={api_version}"
    elif base.endswith("/models"):
        url = f"{base}/embeddings?api-version={api_version}"
    elif "services.ai.azure.com" in base:
        url = f"{base}/models/embeddings?api-version={api_version}"
    else:
        url = (
            f"{base}/openai/deployments/{model}/embeddings"
            f"?api-version={azure_openai_api_version}"
        )
        model_in_body = False

    payload: Dict[str, Any] = {"input": texts, "encoding_format": "float"}
    dimensions = _env("AZURE_AI_EMBEDDING_DIMENSIONS")
    if dimensions:
        payload["dimensions"] = int(dimensions)
    if model_in_body:
        payload["model"] = model

    started = time.perf_counter()
    headers = {
        "api-key": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    resp = None
    for attempt in range(1, 6):
        logger.debug("POST embeddings %s (model=%s) attempt=%s", url, model, attempt)
        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        if resp.status_code != 429:
            break
        retry_after = resp.headers.get("Retry-After")
        try:
            delay = float(retry_after) if retry_after else float(attempt * 2)
        except ValueError:
            delay = float(attempt * 2)
        time.sleep(min(delay, 15.0))
    assert resp is not None
    if resp.status_code >= 400:
        logger.warning("Azure AI embeddings HTTP %s: %s", resp.status_code, resp.text[:500])
        raise AzureAIClientError(f"Azure AI embeddings HTTP {resp.status_code}: {resp.text[:500]}")
    try:
        response_payload = resp.json()
    except Exception as exc:
        logger.exception("Failed to parse JSON response for embeddings (status=%s): %s", resp.status_code, resp.text[:1000])
        raise AzureAIClientError(f"Azure AI embeddings returned invalid JSON (status {resp.status_code})") from exc
    data = response_payload.get("data") or []
    if not data:
        raise AzureAIClientError("Azure AI embeddings response contained no data")
    data.sort(key=lambda item: item.get("index", 0))
    usage = response_payload.get("usage") or {}
    return AzureAIEmbeddingResult(
        embeddings=[item["embedding"] for item in data],
        model_name=model,
        tokens_used=int(usage.get("total_tokens") or usage.get("prompt_tokens") or 0),
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
