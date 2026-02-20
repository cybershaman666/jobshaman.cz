from datetime import datetime, timezone
from typing import Any, Dict, Optional
import ipaddress
import time

import requests
from fastapi import APIRouter, Request
from pydantic import BaseModel
from user_agents import parse as parse_ua

from ..core.database import supabase

router = APIRouter()

_GEO_CACHE: Dict[str, Dict[str, Any]] = {}
_GEO_CACHE_TTL = 60 * 60  # 1 hour


class AnalyticsEvent(BaseModel):
    event_type: str
    company_id: Optional[str] = None
    feature: Optional[str] = None
    tier: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


def _is_public_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
        return not (ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_multicast)
    except Exception:
        return False


def _extract_client_ip(request: Request) -> Optional[str]:
    headers = request.headers
    for key in ("cf-connecting-ip", "x-real-ip", "x-forwarded-for"):
        raw = headers.get(key)
        if not raw:
            continue
        ip = raw.split(",")[0].strip()
        if _is_public_ip(ip):
            return ip
    return None


def _geo_from_ip(ip: str) -> Dict[str, Any]:
    now = time.time()
    cached = _GEO_CACHE.get(ip)
    if cached and (now - cached.get("ts", 0)) < _GEO_CACHE_TTL:
        return cached.get("data", {})

    data: Dict[str, Any] = {}
    try:
        resp = requests.get(f"https://ipapi.co/{ip}/json/", timeout=2)
        if resp.ok:
            payload = resp.json() or {}
            data = {
                "country": payload.get("country_name"),
                "country_code": payload.get("country"),
                "region": payload.get("region"),
                "city": payload.get("city"),
                "org": payload.get("org"),
                "asn": payload.get("asn"),
                "latitude": payload.get("latitude"),
                "longitude": payload.get("longitude"),
            }
    except Exception:
        data = {}

    _GEO_CACHE[ip] = {"ts": now, "data": data}
    return data


def _parse_user_agent(ua_raw: str) -> Dict[str, Any]:
    if not ua_raw:
        return {}
    ua = parse_ua(ua_raw)
    if ua.is_bot:
        device_type = "bot"
    elif ua.is_mobile:
        device_type = "mobile"
    elif ua.is_tablet:
        device_type = "tablet"
    elif ua.is_pc:
        device_type = "desktop"
    else:
        device_type = "other"
    return {
        "device_type": device_type,
        "os": str(ua.os.family or ""),
        "os_version": str(ua.os.version_string or ""),
        "browser": str(ua.browser.family or ""),
        "browser_version": str(ua.browser.version_string or ""),
        "ua": ua_raw[:256],
    }


@router.post("/analytics/track")
async def track_analytics_event(payload: AnalyticsEvent, request: Request):
    if not supabase:
        return {"ok": False, "error": "Database unavailable"}

    metadata: Dict[str, Any] = payload.metadata or {}
    if not isinstance(metadata, dict):
        metadata = {"raw": str(metadata)}

    client_ip = _extract_client_ip(request)
    if client_ip:
        metadata.setdefault("ip", client_ip)
        metadata.setdefault("geo", {})
        geo = _geo_from_ip(client_ip)
        if geo:
            metadata.update({k: v for k, v in geo.items() if v})

    ua_raw = request.headers.get("user-agent", "")
    ua_data = _parse_user_agent(ua_raw)
    if ua_data:
        metadata.update({k: v for k, v in ua_data.items() if v})

    try:
        supabase.table("analytics_events").insert(
            {
                "event_type": payload.event_type,
                "company_id": payload.company_id,
                "feature": payload.feature,
                "tier": payload.tier,
                "metadata": metadata,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
