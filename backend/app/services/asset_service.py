from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode, urlsplit
from uuid import uuid4

from ..core import config
from ..core.config import SECRET_KEY
from ..core.database import supabase
from ..utils.helpers import now_iso

_UPLOAD_SESSIONS: dict[str, dict[str, Any]] = {}
_MEMORY_ASSET_REGISTRY: dict[str, dict[str, Any]] = {}

_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
}

_MAX_SIZE_BYTES_BY_KIND = {
    "attachment": 10 * 1024 * 1024,
    "audio": 12 * 1024 * 1024,
    "candidate_document": 15 * 1024 * 1024,
}

_BUCKET_BY_KIND = {
    "attachment": "dialogue-attachments",
    "audio": "dialogue-audio",
    "candidate_document": "candidate-documents",
}


def _storage_mode() -> str:
    raw = (config.EXTERNAL_ASSET_STORAGE_MODE or "local").strip().lower()
    if raw == "s3":
        if not (
            config.EXTERNAL_ASSET_S3_ENDPOINT
            and config.EXTERNAL_ASSET_S3_BUCKET
            and config.EXTERNAL_ASSET_S3_ACCESS_KEY_ID
            and config.EXTERNAL_ASSET_S3_SECRET_ACCESS_KEY
        ):
            return "local"
    return "s3" if raw == "s3" else "local"


def _storage_root() -> Path:
    base = Path(config.EXTERNAL_ASSET_LOCAL_DIR or "data/external_assets")
    if not base.is_absolute():
        base = Path.cwd() / base
    base.mkdir(parents=True, exist_ok=True)
    return base


def _sanitize_filename(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {".", "-", "_"} else "-" for ch in (name or "").strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    cleaned = cleaned.strip("-.")
    return cleaned[:120] or "file"


def _validate_asset_request(kind: str, file_name: str, content_type: str, size_bytes: int) -> tuple[str, str, int]:
    normalized_kind = (kind or "attachment").strip().lower()
    if normalized_kind not in _BUCKET_BY_KIND:
        raise ValueError("Unsupported asset kind")

    normalized_name = _sanitize_filename(file_name)
    if not normalized_name:
        raise ValueError("Missing filename")

    normalized_type = (content_type or "application/octet-stream").strip().lower()
    if normalized_type not in _ALLOWED_MIME_TYPES:
        raise ValueError("Unsupported file type")

    max_size = _MAX_SIZE_BYTES_BY_KIND[normalized_kind]
    if size_bytes <= 0 or size_bytes > max_size:
        raise ValueError(f"File exceeds size limit ({max_size} bytes)")

    return normalized_kind, normalized_name, max_size


def _sign_token(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), raw, hashlib.sha256).digest()
    return (
        base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        + "."
        + base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    )


def _decode_part(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def _verify_token(token: str) -> dict[str, Any]:
    try:
        payload_part, sig_part = token.split(".", 1)
        raw = _decode_part(payload_part)
        sig = _decode_part(sig_part)
    except Exception as exc:
        raise ValueError("Invalid token format") from exc

    expected = hmac.new(SECRET_KEY.encode("utf-8"), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise PermissionError("Invalid token signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Invalid token payload") from exc

    exp = payload.get("exp")
    if exp is not None and datetime.now(timezone.utc).timestamp() > float(exp):
        raise PermissionError("Token expired")
    return payload


def _build_abs_url(request_base_url: str, path: str) -> str:
    return f"{request_base_url.rstrip('/')}{path}"


def _build_object_key(*, bucket_namespace: str, user_id: str, asset_id: str, file_name: str, now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    return (
        f"{bucket_namespace}/{user_id[:8]}/{current.year:04d}/{current.month:02d}/"
        f"{asset_id}-{_sanitize_filename(file_name)}"
    )


def _sign_s3_presigned_url(
    *,
    method: str,
    object_key: str,
    expires_seconds: int,
    content_type: str | None = None,
) -> str:
    endpoint = str(config.EXTERNAL_ASSET_S3_ENDPOINT or "").rstrip("/")
    bucket = str(config.EXTERNAL_ASSET_S3_BUCKET or "").strip()
    if not endpoint or not bucket:
        raise ValueError("S3 endpoint/bucket not configured")

    parsed = urlsplit(endpoint)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Invalid S3 endpoint")

    region = str(config.EXTERNAL_ASSET_S3_REGION or "auto").strip() or "auto"
    access_key = str(config.EXTERNAL_ASSET_S3_ACCESS_KEY_ID or "").strip()
    secret_key = str(config.EXTERNAL_ASSET_S3_SECRET_ACCESS_KEY or "").strip()
    service = "s3"
    host = parsed.netloc
    endpoint_path = parsed.path.rstrip("/")
    canonical_uri = f"{endpoint_path}/{quote(bucket, safe='')}/{quote(object_key, safe='/~')}"
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    credential = f"{access_key}/{credential_scope}"

    headers_to_sign = {
        "host": host,
    }
    if method.upper() == "PUT" and content_type:
        headers_to_sign["content-type"] = content_type

    signed_headers = ";".join(sorted(headers_to_sign))
    canonical_headers = "".join(f"{key}:{headers_to_sign[key].strip()}\n" for key in sorted(headers_to_sign))

    query_params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": credential,
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(max(1, min(int(expires_seconds), 7 * 24 * 60 * 60))),
        "X-Amz-SignedHeaders": signed_headers,
    }
    canonical_query = urlencode(sorted(query_params.items()), quote_via=quote, safe="~")
    canonical_request = "\n".join(
        [
            method.upper(),
            canonical_uri,
            canonical_query,
            canonical_headers,
            signed_headers,
            "UNSIGNED-PAYLOAD",
        ]
    )
    canonical_request_hash = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            canonical_request_hash,
        ]
    )

    def _sign(key: bytes, message: str) -> bytes:
        return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    final_query = f"{canonical_query}&X-Amz-Signature={signature}"
    return f"{parsed.scheme}://{host}{canonical_uri}?{final_query}"


def _build_s3_download_url(asset: dict[str, Any]) -> str:
    object_key = str(asset.get("object_key") or "").strip()
    if not object_key:
        raise ValueError("Missing object key")
    return _sign_s3_presigned_url(
        method="GET",
        object_key=object_key,
        expires_seconds=config.EXTERNAL_ASSET_DOWNLOAD_URL_TTL_SECONDS,
    )


def create_upload_session(
    *,
    user_id: str,
    kind: str,
    file_name: str,
    content_type: str,
    size_bytes: int,
    request_base_url: str,
) -> dict[str, Any]:
    normalized_kind, normalized_name, max_size = _validate_asset_request(kind, file_name, content_type, size_bytes)
    asset_id = str(uuid4())
    upload_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=config.EXTERNAL_ASSET_UPLOAD_SESSION_TTL_SECONDS)
    provider_mode = _storage_mode()
    now = datetime.now(timezone.utc)
    storage_bucket = (
        str(config.EXTERNAL_ASSET_S3_BUCKET or "").strip()
        if provider_mode == "s3"
        else _BUCKET_BY_KIND[normalized_kind]
    )
    object_key = _build_object_key(
        bucket_namespace=_BUCKET_BY_KIND[normalized_kind],
        user_id=user_id,
        asset_id=asset_id,
        file_name=normalized_name,
        now=now,
    )
    staged_payload = {
        "storage_provider": provider_mode,
        "bucket": storage_bucket,
        "object_key": object_key,
        "mime_type": (content_type or "application/octet-stream").strip().lower(),
        "size_bytes": size_bytes,
        "sha256": None,
        "uploaded_by": user_id,
        "filename": normalized_name,
        "kind": normalized_kind,
        "asset_id": asset_id,
        "uploaded_at": now_iso(),
    }
    _UPLOAD_SESSIONS[upload_token] = {
        "asset_id": asset_id,
        "user_id": user_id,
        "kind": normalized_kind,
        "bucket": storage_bucket,
        "file_name": normalized_name,
        "content_type": content_type,
        "declared_size_bytes": size_bytes,
        "created_at": now_iso(),
        "expires_at": expires_at.isoformat(),
        "staged": staged_payload if provider_mode == "s3" else None,
    }
    upload_url = _build_abs_url(request_base_url, f"/assets/upload/{upload_token}")
    upload_method = "PUT"
    upload_headers: dict[str, str] | None = None
    direct_upload = False
    if provider_mode == "s3":
        upload_url = _sign_s3_presigned_url(
            method="PUT",
            object_key=object_key,
            expires_seconds=config.EXTERNAL_ASSET_UPLOAD_SESSION_TTL_SECONDS,
            content_type=(content_type or "application/octet-stream").strip().lower(),
        )
        upload_headers = {
            "Content-Type": (content_type or "application/octet-stream").strip().lower(),
        }
        direct_upload = True
    return {
        "asset_id": asset_id,
        "kind": normalized_kind,
        "upload_token": upload_token,
        "upload_url": upload_url,
        "upload_method": upload_method,
        "upload_headers": upload_headers,
        "direct_upload": direct_upload,
        "expires_at": expires_at.isoformat(),
        "max_size_bytes": max_size,
        "provider": provider_mode,
    }


def _get_live_session(upload_token: str, user_id: str) -> dict[str, Any]:
    session = _UPLOAD_SESSIONS.get(upload_token)
    if not session:
        raise ValueError("Upload session not found")
    if session.get("user_id") != user_id:
        raise PermissionError("Upload session owner mismatch")
    expires_at = session.get("expires_at")
    if expires_at:
        try:
            parsed = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        except Exception:
            parsed = None
        if parsed and datetime.now(timezone.utc) > parsed:
            _UPLOAD_SESSIONS.pop(upload_token, None)
            raise PermissionError("Upload session expired")
    return session


def stage_upload_bytes(
    *,
    upload_token: str,
    user_id: str,
    content_type: str,
    payload: bytes,
) -> dict[str, Any]:
    session = _get_live_session(upload_token, user_id)
    if _storage_mode() != "local":
        raise ValueError("Byte staging is available only in local storage mode")
    normalized_kind = str(session.get("kind") or "attachment")
    _, _, max_size = _validate_asset_request(
        normalized_kind,
        str(session.get("file_name") or "file"),
        content_type or str(session.get("content_type") or ""),
        len(payload),
    )

    if not payload:
        raise ValueError("Empty file payload")
    if len(payload) > max_size:
        raise ValueError("Uploaded payload exceeds size limit")

    now = datetime.now(timezone.utc)
    object_key = _build_object_key(
        bucket_namespace=_BUCKET_BY_KIND[normalized_kind],
        user_id=user_id,
        asset_id=str(session["asset_id"]),
        file_name=str(session.get("file_name") or "file"),
        now=now,
    )
    target = _storage_root() / object_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)

    sha256 = hashlib.sha256(payload).hexdigest()
    session["staged"] = {
        "storage_provider": config.EXTERNAL_ASSET_STORAGE_MODE,
        "bucket": session["bucket"],
        "object_key": object_key,
        "mime_type": (content_type or session.get("content_type") or "application/octet-stream").strip().lower(),
        "size_bytes": len(payload),
        "sha256": sha256,
        "uploaded_by": user_id,
        "filename": session.get("file_name"),
        "kind": normalized_kind,
        "asset_id": session["asset_id"],
        "local_path": str(target),
        "uploaded_at": now_iso(),
    }
    return {
        "ok": True,
        "asset_id": session["asset_id"],
        "size_bytes": len(payload),
        "sha256": sha256,
    }


def _persist_asset_metadata(payload: dict[str, Any]) -> None:
    if not supabase:
        return
    insert_payload = {
        "id": payload.get("asset_id"),
        "storage_provider": payload.get("storage_provider"),
        "bucket": payload.get("bucket"),
        "object_key": payload.get("object_key"),
        "kind": payload.get("kind"),
        "mime_type": payload.get("mime_type"),
        "size_bytes": payload.get("size_bytes"),
        "sha256": payload.get("sha256"),
        "uploaded_by": payload.get("uploaded_by"),
        "filename": payload.get("filename"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    try:
        supabase.table("external_assets").insert(insert_payload).execute()
    except Exception:
        # Table rollout is additive; keep runtime working even before DB migration lands.
        return


def _load_asset_metadata(asset_id: str) -> dict[str, Any] | None:
    in_memory = _MEMORY_ASSET_REGISTRY.get(asset_id)
    if in_memory:
        return dict(in_memory)
    if not supabase or not asset_id:
        return None
    try:
        resp = supabase.table("external_assets").select("*").eq("id", asset_id).maybe_single().execute()
    except Exception:
        return None
    if not resp or not resp.data:
        return None
    return dict(resp.data)


def load_asset_metadata(asset_id: str) -> dict[str, Any] | None:
    normalized_asset_id = str(asset_id or "").strip()
    if not normalized_asset_id:
        return None
    return _load_asset_metadata(normalized_asset_id)


def load_assets_metadata(asset_ids: list[str]) -> list[dict[str, Any]]:
    ordered_ids: list[str] = []
    seen: set[str] = set()
    for raw_id in asset_ids:
        asset_id = str(raw_id or "").strip()
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        ordered_ids.append(asset_id)

    if not ordered_ids:
        return []

    loaded_by_id: dict[str, dict[str, Any]] = {}
    missing_ids: list[str] = []

    for asset_id in ordered_ids:
        in_memory = _MEMORY_ASSET_REGISTRY.get(asset_id)
        if in_memory:
            loaded_by_id[asset_id] = dict(in_memory)
        else:
            missing_ids.append(asset_id)

    if supabase and missing_ids:
        try:
            resp = supabase.table("external_assets").select("*").in_("id", missing_ids).execute()
            for row in resp.data or []:
                if not isinstance(row, dict):
                    continue
                asset_id = str(row.get("id") or row.get("asset_id") or "").strip()
                if asset_id:
                    loaded_by_id[asset_id] = dict(row)
        except Exception:
            pass

    out: list[dict[str, Any]] = []
    for asset_id in ordered_ids:
        item = loaded_by_id.get(asset_id)
        if item:
            out.append(item)
    return out


def _build_download_token(asset: dict[str, Any]) -> str:
    exp = datetime.now(timezone.utc) + timedelta(seconds=config.EXTERNAL_ASSET_DOWNLOAD_URL_TTL_SECONDS)
    return _sign_token(
        {
            "asset_id": asset.get("asset_id") or asset.get("id"),
            "object_key": asset.get("object_key"),
            "filename": asset.get("filename"),
            "mime_type": asset.get("mime_type"),
            "exp": exp.timestamp(),
        }
    )


def build_download_url(asset: dict[str, Any], request_base_url: str) -> str:
    provider = str(asset.get("storage_provider") or asset.get("provider") or _storage_mode()).strip().lower()
    if provider == "s3":
        return _build_s3_download_url(asset)
    token = _build_download_token(asset)
    return _build_abs_url(request_base_url, f"/assets/download/{token}")


def _serialize_asset(asset: dict[str, Any], request_base_url: str) -> dict[str, Any]:
    kind = str(asset.get("kind") or "attachment")
    mime_type = str(asset.get("mime_type") or "application/octet-stream")
    transcript_status = "pending" if kind == "audio" else "not_applicable"
    url = build_download_url(asset, request_base_url)
    return {
        "id": asset.get("asset_id") or asset.get("id"),
        "asset_id": asset.get("asset_id") or asset.get("id"),
        "provider": asset.get("storage_provider") or asset.get("provider") or config.EXTERNAL_ASSET_STORAGE_MODE,
        "storage_provider": asset.get("storage_provider") or asset.get("provider") or config.EXTERNAL_ASSET_STORAGE_MODE,
        "bucket": asset.get("bucket"),
        "object_key": asset.get("object_key"),
        "kind": kind,
        "mime_type": mime_type,
        "size_bytes": asset.get("size_bytes"),
        "filename": asset.get("filename"),
        "download_url": url,
        "transcript_status": transcript_status,
        # Backward-compatible fields used by existing attachment UI / message payloads.
        "name": asset.get("filename"),
        "url": url,
        "path": asset.get("object_key"),
        "size": asset.get("size_bytes"),
        "content_type": mime_type,
    }


def serialize_asset_metadata(asset: dict[str, Any], request_base_url: str) -> dict[str, Any]:
    return _serialize_asset(asset, request_base_url)


def complete_upload(*, upload_token: str, user_id: str, request_base_url: str) -> dict[str, Any]:
    session = _get_live_session(upload_token, user_id)
    staged = session.get("staged")
    if not isinstance(staged, dict):
        raise ValueError("No uploaded file to finalize")

    _persist_asset_metadata(staged)
    asset_id = str(staged.get("asset_id") or "")
    if asset_id:
        _MEMORY_ASSET_REGISTRY[asset_id] = dict(staged)
    _UPLOAD_SESSIONS.pop(upload_token, None)
    return _serialize_asset(staged, request_base_url)


def get_download_url_for_asset(
    asset_id: str,
    request_base_url: str,
    requester_user_id: str | None = None,
) -> dict[str, Any]:
    asset = _load_asset_metadata(asset_id)
    if not asset:
        raise ValueError("Asset not found")
    if requester_user_id:
        uploaded_by = str(asset.get("uploaded_by") or "").strip()
        if uploaded_by and uploaded_by != str(requester_user_id).strip():
            raise PermissionError("Asset access denied")
    return {
        "asset_id": asset_id,
        "download_url": build_download_url(asset, request_base_url),
        "expires_in_seconds": config.EXTERNAL_ASSET_DOWNLOAD_URL_TTL_SECONDS,
    }


def resolve_download_token(download_token: str) -> dict[str, Any]:
    if _storage_mode() != "local":
        raise ValueError("Token-based download is not active for this storage mode")
    payload = _verify_token(download_token)
    object_key = str(payload.get("object_key") or "").strip()
    if not object_key:
        raise ValueError("Missing object key")
    local_path = (_storage_root() / object_key).resolve()
    root = _storage_root().resolve()
    if root not in local_path.parents and local_path != root:
        raise PermissionError("Invalid asset path")
    if not local_path.exists() or not local_path.is_file():
        raise ValueError("Asset file not found")
    return {
        "asset_id": payload.get("asset_id"),
        "file_path": str(local_path),
        "filename": payload.get("filename") or "download",
        "mime_type": payload.get("mime_type") or "application/octet-stream",
    }
