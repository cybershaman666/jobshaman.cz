from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from ..core.limiter import limiter
from ..core.security import get_current_user, verify_csrf_token_header
from ..models.requests import AssetCompleteUploadRequest, AssetUploadSessionRequest
from ..services.asset_service import (
    complete_upload,
    create_upload_session,
    get_download_url_for_asset,
    resolve_download_token,
    stage_upload_bytes,
)
from ..utils.request_urls import get_request_base_url

router = APIRouter(prefix="/assets")


def _request_base_url(request: Request) -> str:
    return get_request_base_url(request).rstrip("/")


@router.post("/upload-session")
@limiter.limit("60/minute")
async def create_asset_upload_session(
    payload: AssetUploadSessionRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    try:
        session = create_upload_session(
            user_id=str(user_id),
            kind=payload.kind,
            file_name=payload.file_name,
            content_type=payload.content_type,
            size_bytes=payload.size_bytes,
            request_base_url=_request_base_url(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return session


@router.put("/upload/{upload_token}")
@limiter.limit("120/minute")
async def upload_asset_bytes(
    upload_token: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    content_type = request.headers.get("content-type") or "application/octet-stream"
    payload = await request.body()
    try:
        result = stage_upload_bytes(
            upload_token=upload_token,
            user_id=str(user_id),
            content_type=content_type,
            payload=payload,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.post("/complete-upload")
@limiter.limit("60/minute")
async def finalize_asset_upload(
    payload: AssetCompleteUploadRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="CSRF validation failed")
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    try:
        asset = complete_upload(
            upload_token=payload.upload_token,
            user_id=str(user_id),
            request_base_url=_request_base_url(request),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"asset": asset}


@router.get("/{asset_id}/download-url")
@limiter.limit("120/minute")
async def issue_asset_download_url(
    asset_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    user_id = user.get("id") or user.get("auth_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    try:
        payload = get_download_url_for_asset(
            asset_id,
            _request_base_url(request),
            requester_user_id=str(user_id),
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return payload


@router.get("/download/{download_token}")
@limiter.limit("300/minute")
async def download_asset(download_token: str, request: Request):
    try:
        resolved = resolve_download_token(download_token)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        path=resolved["file_path"],
        media_type=resolved["mime_type"],
        filename=resolved["filename"],
    )
