from __future__ import annotations

from urllib.parse import urlsplit

from fastapi import Request


def _pick_forwarded_value(raw: str | None) -> str | None:
    if not raw:
        return None
    first = raw.split(",", 1)[0].strip()
    if not first:
        return None
    return first.strip('"').strip("'")


def _parse_forwarded_header(raw: str | None) -> tuple[str | None, str | None]:
    if not raw:
        return None, None
    first = raw.split(",", 1)[0]
    proto: str | None = None
    host: str | None = None
    for item in first.split(";"):
        key, _, value = item.strip().partition("=")
        if not key or not value:
            continue
        normalized_key = key.strip().lower()
        normalized_value = value.strip().strip('"').strip("'")
        if normalized_key == "proto" and normalized_value:
            proto = normalized_value
        elif normalized_key == "host" and normalized_value:
            host = normalized_value
    return proto, host


def get_request_base_url(request: Request) -> str:
    forwarded_proto, forwarded_host = _parse_forwarded_header(request.headers.get("forwarded"))
    proto = (
        _pick_forwarded_value(request.headers.get("x-forwarded-proto"))
        or _pick_forwarded_value(request.headers.get("x-forwarded-scheme"))
        or forwarded_proto
        or request.url.scheme
        or urlsplit(str(request.base_url)).scheme
        or "http"
    ).strip().lower()
    if proto not in {"http", "https"}:
        proto = "https" if "https" in proto else "http"

    host = (
        _pick_forwarded_value(request.headers.get("x-forwarded-host"))
        or forwarded_host
        or (request.headers.get("host") or "").strip()
        or urlsplit(str(request.base_url)).netloc
    ).strip()

    forwarded_port = _pick_forwarded_value(request.headers.get("x-forwarded-port"))
    if host and forwarded_port and ":" not in host:
        if (proto == "https" and forwarded_port != "443") or (proto == "http" and forwarded_port != "80"):
            host = f"{host}:{forwarded_port}"

    if not host:
        base = str(request.base_url).rstrip("/")
        return base

    return f"{proto}://{host}"
