import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional


class MistralClientError(Exception):
    pass


@dataclass
class MistralResult:
    text: str
    model_name: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0


def extract_json_object(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start < 0 or end < start:
            raise MistralClientError("Mistral response did not contain a JSON object")
        return json.loads(cleaned[start : end + 1])


def _extract_text(payload: Dict[str, Any]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = (choices[0] or {}).get("message") or {}
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    raise MistralClientError("Mistral response did not contain text")


def call_mistral_json(
    prompt: str,
    *,
    model_name: Optional[str] = None,
    temperature: float = 0.2,
    timeout: int = 90,
) -> tuple[Dict[str, Any], MistralResult]:
    text, result = call_mistral_text(
        prompt,
        model_name=model_name,
        temperature=temperature,
        timeout=timeout,
        response_format={"type": "json_object"},
    )
    return extract_json_object(text), result


@dataclass
class MistralEmbeddingResult:
    embeddings: list[list[float]]
    model_name: str
    tokens_used: int = 0
    latency_ms: int = 0


def call_mistral_embed(
    texts: list[str],
    *,
    model_name: Optional[str] = None,
    timeout: int = 60,
) -> MistralEmbeddingResult:
    """
    Generate embeddings via Mistral's v1/embeddings endpoint.
    Returns 1024-dimensional vectors matching the jobs_nf.embedding column.
    """
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise MistralClientError("MISTRAL_API_KEY is not configured")

    model = model_name or os.getenv("MISTRAL_EMBED_MODEL", "mistral-embed")
    endpoint = os.getenv(
        "MISTRAL_EMBED_ENDPOINT",
        "https://api.mistral.ai/v1/embeddings",
    )

    # Mistral embed API accepts max ~16K tokens per request; batch in chunks if needed
    payload = {
        "model": model,
        "input": texts,
        "encoding_format": "float",
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise MistralClientError(f"Mistral Embed HTTP {exc.code}: {body[:500]}") from exc
    except Exception as exc:
        raise MistralClientError(str(exc)) from exc

    response_payload = json.loads(raw)
    data = response_payload.get("data") or []
    if not data:
        raise MistralClientError("Mistral Embed response contained no embedding data")

    # Sort by index to preserve input order
    data.sort(key=lambda item: item.get("index", 0))
    embeddings = [item["embedding"] for item in data]

    usage = response_payload.get("usage") or {}
    return MistralEmbeddingResult(
        embeddings=embeddings,
        model_name=model,
        tokens_used=int(usage.get("total_tokens") or usage.get("prompt_tokens") or 0),
        latency_ms=int((time.perf_counter() - started) * 1000),
    )


def call_mistral_text(
    prompt: str,
    *,
    model_name: Optional[str] = None,
    temperature: float = 0.2,
    timeout: int = 90,
    response_format: Optional[Dict[str, Any]] = None,
) -> tuple[str, MistralResult]:
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise MistralClientError("MISTRAL_API_KEY is not configured")

    model = model_name or os.getenv("MISTRAL_MODEL", "mistral-small-latest")
    endpoint = os.getenv("MISTRAL_ENDPOINT", "https://api.mistral.ai/v1/chat/completions")
    payload = {
        "model": model,
        "temperature": temperature,
        "top_p": 1,
        "messages": [{"role": "user", "content": prompt}],
    }
    if response_format:
        payload["response_format"] = response_format
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise MistralClientError(f"Mistral HTTP {exc.code}: {body[:500]}") from exc
    except Exception as exc:
        raise MistralClientError(str(exc)) from exc

    response_payload = json.loads(raw)
    text = _extract_text(response_payload)
    usage = response_payload.get("usage") or {}
    result = MistralResult(
        text=text,
        model_name=model,
        tokens_in=int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0),
        tokens_out=int(usage.get("completion_tokens") or usage.get("output_tokens") or 0),
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    return text, result
