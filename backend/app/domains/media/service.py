from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote, urlencode, urlsplit
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import engine
from app.domains.media.models import MediaAsset
from app.domains.reality.models import CompanyUser


ASSET_STORAGE_MODE = os.environ.get("EXTERNAL_ASSET_STORAGE_MODE", "local").strip().lower()
ASSET_LOCAL_DIR = os.environ.get("EXTERNAL_ASSET_LOCAL_DIR", "data/external_assets")
ASSET_UPLOAD_SESSION_TTL_SECONDS = int(os.environ.get("EXTERNAL_ASSET_UPLOAD_SESSION_TTL_SECONDS", "900") or "900")
ASSET_DOWNLOAD_URL_TTL_SECONDS = int(os.environ.get("EXTERNAL_ASSET_DOWNLOAD_URL_TTL_SECONDS", "15552000") or "15552000")
ASSET_S3_ENDPOINT = os.environ.get("EXTERNAL_ASSET_S3_ENDPOINT")
ASSET_S3_REGION = os.environ.get("EXTERNAL_ASSET_S3_REGION", "auto")
ASSET_S3_BUCKET = os.environ.get("EXTERNAL_ASSET_S3_BUCKET")
ASSET_S3_ACCESS_KEY_ID = os.environ.get("EXTERNAL_ASSET_S3_ACCESS_KEY_ID")
ASSET_S3_SECRET_ACCESS_KEY = os.environ.get("EXTERNAL_ASSET_S3_SECRET_ACCESS_KEY")
ASSET_SECRET = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SUPABASE_JWT_SECRET")

_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/rtf",
    "application/zip",
    "application/x-zip-compressed",
    "text/plain",
    "text/markdown",
}

_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/svg+xml",
}

_AUDIO_VIDEO_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "video/mp4",
    "video/webm",
}

_ALLOWED_BY_KIND: dict[str, dict[str, Any]] = {
    "candidate_document": {
        "max_size_bytes": 15 * 1024 * 1024,
        "mime_types": _DOCUMENT_MIME_TYPES | {"application/octet-stream"},
        "bucket": "candidate-documents",
        "visibility": "private",
    },
    "profile_photo": {
        "max_size_bytes": 8 * 1024 * 1024,
        "mime_types": _IMAGE_MIME_TYPES,
        "bucket": "profile-photos",
        "visibility": "private",
    },
    "company_branding": {
        "max_size_bytes": 12 * 1024 * 1024,
        "mime_types": _IMAGE_MIME_TYPES,
        "bucket": "company-branding",
        "visibility": "company",
    },
    "handshake_material": {
        "max_size_bytes": 25 * 1024 * 1024,
        "mime_types": _DOCUMENT_MIME_TYPES | _IMAGE_MIME_TYPES | _AUDIO_VIDEO_MIME_TYPES | {"application/octet-stream"},
        "bucket": "handshake-materials",
        "visibility": "company",
    },
    "dialogue_attachment": {
        "max_size_bytes": 12 * 1024 * 1024,
        "mime_types": _DOCUMENT_MIME_TYPES | _IMAGE_MIME_TYPES | _AUDIO_VIDEO_MIME_TYPES | {"application/octet-stream"},
        "bucket": "dialogue-attachments",
        "visibility": "private",
    },
}


def _sanitize_filename(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {".", "-", "_"} else "-" for ch in (name or "").strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    cleaned = cleaned.strip("-.")
    return cleaned[:120] or "file"


def _storage_mode() -> str:
    if ASSET_STORAGE_MODE == "s3" and all([ASSET_S3_ENDPOINT, ASSET_S3_BUCKET, ASSET_S3_ACCESS_KEY_ID, ASSET_S3_SECRET_ACCESS_KEY]):
        return "s3"
    return "local"


def _storage_root() -> Path:
    base = Path(ASSET_LOCAL_DIR)
    if not base.is_absolute():
        base = Path.cwd() / base
    base.mkdir(parents=True, exist_ok=True)
    return base


def _sign_payload(payload: dict[str, Any]) -> str:
    if not ASSET_SECRET:
        raise ValueError("Missing asset signing secret")
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(ASSET_SECRET.encode("utf-8"), raw, hashlib.sha256).digest()
    return (
        base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
        + "."
        + base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    )


def _decode_part(raw: str) -> bytes:
    return base64.urlsafe_b64decode(raw + ("=" * (-len(raw) % 4)))


def _verify_signed_payload(token: str) -> dict[str, Any]:
    if not ASSET_SECRET:
        raise ValueError("Missing asset signing secret")
    payload_part, signature_part = token.split(".", 1)
    raw = _decode_part(payload_part)
    signature = _decode_part(signature_part)
    expected = hmac.new(ASSET_SECRET.encode("utf-8"), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise PermissionError("Invalid asset token signature")
    payload = json.loads(raw.decode("utf-8"))
    exp = payload.get("exp")
    if exp and datetime.now(timezone.utc).timestamp() > float(exp):
        raise PermissionError("Asset token expired")
    return payload


def _build_object_key(*, bucket_namespace: str, owner_key: str, asset_id: UUID, file_name: str) -> str:
    now = datetime.now(timezone.utc)
    return (
        f"{bucket_namespace}/{owner_key[:8]}/{now.year:04d}/{now.month:02d}/"
        f"{asset_id}-{_sanitize_filename(file_name)}"
    )


def _sign_s3_presigned_url(*, method: str, object_key: str, expires_seconds: int, content_type: Optional[str] = None) -> str:
    endpoint = str(ASSET_S3_ENDPOINT or "").rstrip("/")
    bucket = str(ASSET_S3_BUCKET or "").strip()
    if not endpoint or not bucket:
        raise ValueError("S3 endpoint/bucket not configured")

    parsed = urlsplit(endpoint)
    region = str(ASSET_S3_REGION or "auto").strip() or "auto"
    access_key = str(ASSET_S3_ACCESS_KEY_ID or "").strip()
    secret_key = str(ASSET_S3_SECRET_ACCESS_KEY or "").strip()
    canonical_uri = f"{parsed.path.rstrip('/')}/{quote(bucket, safe='')}/{quote(object_key, safe='/~')}"
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    credential_scope = f"{date_stamp}/{region}/s3/aws4_request"
    credential = f"{access_key}/{credential_scope}"

    headers_to_sign = {"host": parsed.netloc}
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
    canonical_request = "\n".join([method.upper(), canonical_uri, canonical_query, canonical_headers, signed_headers, "UNSIGNED-PAYLOAD"])
    canonical_request_hash = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = "\n".join(["AWS4-HMAC-SHA256", amz_date, credential_scope, canonical_request_hash])

    def _sign(key: bytes, message: str) -> bytes:
        return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()

    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, "s3")
    k_signing = _sign(k_service, "aws4_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{parsed.scheme}://{parsed.netloc}{canonical_uri}?{canonical_query}&X-Amz-Signature={signature}"


class MediaDomainService:
    @staticmethod
    async def user_can_manage_company(user_id: str, company_id: str) -> bool:
        async with AsyncSession(engine) as session:
            statement = select(CompanyUser).where(
                CompanyUser.user_id == UUID(user_id),
                CompanyUser.company_id == UUID(company_id),
            )
            result = await session.execute(statement)
            return result.scalar_one_or_none() is not None

    @staticmethod
    def validate_request(kind: str, file_name: str, content_type: str, size_bytes: int) -> tuple[str, str, str, int]:
        normalized_kind = (kind or "").strip().lower()
        if normalized_kind not in _ALLOWED_BY_KIND:
            raise ValueError("Unsupported asset kind")

        normalized_name = _sanitize_filename(file_name)
        normalized_type = (content_type or "application/octet-stream").strip().lower()
        definition = _ALLOWED_BY_KIND[normalized_kind]
        if normalized_type not in definition["mime_types"]:
            raise ValueError("Unsupported file type")
        max_size_bytes = int(definition["max_size_bytes"])
        if size_bytes <= 0 or size_bytes > max_size_bytes:
            raise ValueError(f"File exceeds size limit ({max_size_bytes} bytes)")
        return normalized_kind, normalized_name, normalized_type, max_size_bytes

    @staticmethod
    async def create_upload_session(
        *,
        owner_user_id: str,
        kind: str,
        file_name: str,
        content_type: str,
        size_bytes: int,
        request_base_url: str,
        usage: Optional[str] = None,
        company_id: Optional[str] = None,
        title: Optional[str] = None,
        caption: Optional[str] = None,
        visibility: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        normalized_kind, normalized_name, normalized_type, max_size_bytes = MediaDomainService.validate_request(
            kind,
            file_name,
            content_type,
            size_bytes,
        )
        if company_id and not await MediaDomainService.user_can_manage_company(owner_user_id, company_id):
            raise PermissionError("You do not have access to this company")

        asset_id = uuid4()
        storage_mode = _storage_mode()
        bucket = str(ASSET_S3_BUCKET or "").strip() if storage_mode == "s3" else _ALLOWED_BY_KIND[normalized_kind]["bucket"]
        object_key = _build_object_key(
            bucket_namespace=_ALLOWED_BY_KIND[normalized_kind]["bucket"],
            owner_key=company_id or owner_user_id,
            asset_id=asset_id,
            file_name=normalized_name,
        )
        effective_visibility = visibility or _ALLOWED_BY_KIND[normalized_kind]["visibility"]
        asset = MediaAsset(
            id=asset_id,
            owner_user_id=UUID(owner_user_id),
            company_id=UUID(company_id) if company_id else None,
            kind=normalized_kind,
            usage=usage,
            visibility=effective_visibility,
            title=title,
            caption=caption,
            original_name=file_name or normalized_name,
            file_name=normalized_name,
            content_type=normalized_type,
            size_bytes=size_bytes,
            storage_provider=storage_mode,
            storage_bucket=bucket,
            object_key=object_key,
            upload_status="pending",
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
        )
        async with AsyncSession(engine) as session:
            session.add(asset)
            await session.commit()

        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ASSET_UPLOAD_SESSION_TTL_SECONDS)
        upload_token = _sign_payload(
            {
                "asset_id": str(asset_id),
                "owner_user_id": owner_user_id,
                "company_id": company_id,
                "exp": expires_at.timestamp(),
                "purpose": "upload",
            }
        )

        upload_url = f"{request_base_url.rstrip('/')}/api/v2/assets/upload/{upload_token}"
        upload_headers: Optional[dict[str, str]] = None
        direct_upload = False
        if storage_mode == "s3":
            upload_url = _sign_s3_presigned_url(
                method="PUT",
                object_key=object_key,
                expires_seconds=ASSET_UPLOAD_SESSION_TTL_SECONDS,
                content_type=normalized_type,
            )
            upload_headers = {"Content-Type": normalized_type}
            direct_upload = True

        return {
            "asset_id": str(asset_id),
            "kind": normalized_kind,
            "upload_token": upload_token,
            "upload_url": upload_url,
            "upload_method": "PUT",
            "upload_headers": upload_headers,
            "direct_upload": direct_upload,
            "expires_at": expires_at.isoformat(),
            "max_size_bytes": max_size_bytes,
            "provider": storage_mode,
        }

    @staticmethod
    async def store_local_upload(upload_token: str, body: bytes) -> None:
        payload = _verify_signed_payload(upload_token)
        if payload.get("purpose") != "upload":
            raise PermissionError("Invalid upload token")
        asset_id = payload.get("asset_id")
        if not asset_id:
            raise ValueError("Upload token missing asset id")

        async with AsyncSession(engine) as session:
            result = await session.execute(select(MediaAsset).where(MediaAsset.id == UUID(asset_id)))
            asset = result.scalar_one_or_none()
            if not asset:
                raise ValueError("Asset not found")
            if len(body) > asset.size_bytes:
                raise ValueError("Uploaded bytes exceed declared file size")

            destination = _storage_root() / asset.object_key
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(body)

    @staticmethod
    async def complete_upload(upload_token: str, request_base_url: str, requester_user_id: str) -> dict[str, Any]:
        payload = _verify_signed_payload(upload_token)
        if payload.get("purpose") != "upload":
            raise PermissionError("Invalid upload token")
        asset_id = payload.get("asset_id")
        if not asset_id:
            raise ValueError("Upload token missing asset id")

        async with AsyncSession(engine) as session:
            result = await session.execute(select(MediaAsset).where(MediaAsset.id == UUID(asset_id)))
            asset = result.scalar_one_or_none()
            if not asset:
                raise ValueError("Asset not found")
            if str(asset.owner_user_id) != requester_user_id:
                raise PermissionError("Asset does not belong to current user")
            if asset.company_id and not await MediaDomainService.user_can_manage_company(requester_user_id, str(asset.company_id)):
                raise PermissionError("You do not have access to this company asset")

            if asset.storage_provider == "local":
                stored_file = _storage_root() / asset.object_key
                if not stored_file.exists():
                    raise ValueError("Uploaded file bytes not found")
                if stored_file.stat().st_size == 0:
                    raise ValueError("Uploaded file is empty")

            asset.upload_status = "ready"
            asset.uploaded_at = datetime.utcnow()
            session.add(asset)
            await session.commit()
            await session.refresh(asset)
            return MediaDomainService.serialize_asset(asset, request_base_url=request_base_url)

    @staticmethod
    async def get_asset(asset_id: str) -> Optional[MediaAsset]:
        async with AsyncSession(engine) as session:
            result = await session.execute(select(MediaAsset).where(MediaAsset.id == UUID(asset_id)))
            return result.scalar_one_or_none()

    @staticmethod
    async def create_download_url(asset_id: str, request_base_url: str, requester_user_id: Optional[str] = None) -> Optional[str]:
        asset = await MediaDomainService.get_asset(asset_id)
        if not asset or asset.upload_status != "ready":
            return None
        if requester_user_id and str(asset.owner_user_id) != requester_user_id and (
            not asset.company_id or not await MediaDomainService.user_can_manage_company(requester_user_id, str(asset.company_id))
        ):
            return None
        return MediaDomainService.build_download_url(asset, request_base_url=request_base_url)

    @staticmethod
    def build_download_url(asset: MediaAsset, request_base_url: str) -> str:
        if asset.storage_provider == "s3":
            return _sign_s3_presigned_url(
                method="GET",
                object_key=asset.object_key,
                expires_seconds=ASSET_DOWNLOAD_URL_TTL_SECONDS,
            )
        token = _sign_payload(
            {
                "asset_id": str(asset.id),
                "exp": (datetime.now(timezone.utc) + timedelta(seconds=ASSET_DOWNLOAD_URL_TTL_SECONDS)).timestamp(),
                "purpose": "download",
            }
        )
        return f"{request_base_url.rstrip('/')}/api/v2/assets/download/{token}"

    @staticmethod
    async def resolve_local_asset_path(download_token: str) -> tuple[MediaAsset, Path]:
        payload = _verify_signed_payload(download_token)
        if payload.get("purpose") != "download":
            raise PermissionError("Invalid download token")
        asset_id = payload.get("asset_id")
        if not asset_id:
            raise ValueError("Download token missing asset id")
        asset = await MediaDomainService.get_asset(asset_id)
        if not asset or asset.upload_status != "ready":
            raise ValueError("Asset not found")
        stored_file = _storage_root() / asset.object_key
        if not stored_file.exists():
            raise FileNotFoundError("Asset bytes not found")
        return asset, stored_file

    @staticmethod
    def serialize_asset(asset: MediaAsset, request_base_url: str) -> dict[str, Any]:
        try:
            metadata = json.loads(asset.metadata_json or "{}")
        except json.JSONDecodeError:
            metadata = {}
        download_url = MediaDomainService.build_download_url(asset, request_base_url=request_base_url)
        return {
            "id": str(asset.id),
            "asset_id": str(asset.id),
            "owner_user_id": str(asset.owner_user_id) if asset.owner_user_id else None,
            "company_id": str(asset.company_id) if asset.company_id else None,
            "kind": asset.kind,
            "usage": asset.usage,
            "visibility": asset.visibility,
            "title": asset.title,
            "caption": asset.caption,
            "name": asset.original_name,
            "filename": asset.file_name,
            "original_name": asset.original_name,
            "url": download_url,
            "download_url": download_url,
            "mime_type": asset.content_type,
            "content_type": asset.content_type,
            "size_bytes": asset.size_bytes,
            "size": asset.size_bytes,
            "storage_provider": asset.storage_provider,
            "bucket": asset.storage_bucket,
            "object_key": asset.object_key,
            "upload_status": asset.upload_status,
            "created_at": asset.created_at.isoformat(),
            "uploaded_at": asset.uploaded_at.isoformat() if asset.uploaded_at else None,
            "metadata": metadata,
        }
