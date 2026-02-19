from datetime import datetime, timezone
from urllib.parse import urlparse
import ipaddress
import requests

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..core.database import supabase
from ..core.config import SUPABASE_URL
from ..core.security import get_current_user, verify_csrf_token_header

router = APIRouter()

MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB


class ImportProfilePhotoRequest(BaseModel):
    url: str


def _is_blocked_host(hostname: str | None) -> bool:
    if not hostname:
        return True
    host = hostname.lower()
    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    if host.endswith(".local"):
        return True
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_multicast
    except ValueError:
        return False


def _extension_from_content_type(content_type: str) -> str:
    value = (content_type or "").split(";")[0].strip().lower()
    if value == "image/jpeg":
        return "jpg"
    if value == "image/png":
        return "png"
    if value == "image/webp":
        return "webp"
    if value == "image/gif":
        return "gif"
    return "jpg"


@router.post("/profile/photo/import")
async def import_profile_photo(
    payload: ImportProfilePhotoRequest,
    request: Request,
    user: dict = Depends(get_current_user)
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    url = (payload.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing url")

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Invalid url scheme")
    if _is_blocked_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="Blocked url host")

    try:
        response = requests.get(
            url,
            stream=True,
            timeout=10,
            headers={"User-Agent": "jobshaman-backend/1.0"}
        )
        response.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {exc}")

    content_type = response.headers.get("Content-Type", "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="URL did not return an image")

    content_length = response.headers.get("Content-Length")
    if content_length:
        try:
            if int(content_length) > MAX_PROFILE_PHOTO_BYTES:
                raise HTTPException(status_code=413, detail="Image too large")
        except ValueError:
            pass

    data = bytearray()
    for chunk in response.iter_content(chunk_size=64 * 1024):
        if not chunk:
            continue
        data.extend(chunk)
        if len(data) > MAX_PROFILE_PHOTO_BYTES:
            raise HTTPException(status_code=413, detail="Image too large")

    ext = _extension_from_content_type(content_type)
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    filename = f"{user_id}/{int(datetime.now(timezone.utc).timestamp())}-oauth.{ext}"
    try:
        supabase.storage.from_("profile-photos").upload(
            filename,
            bytes(data),
            {"content-type": content_type, "upsert": "true"}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/profile-photos/{filename}"
    try:
        supabase.table("profiles").update({"avatar_url": public_url}).eq("id", user_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Profile update failed: {exc}")

    return {"photo_url": public_url}
