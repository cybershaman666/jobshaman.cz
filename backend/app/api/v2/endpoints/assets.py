from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse

from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.media.service import MediaDomainService

router = APIRouter()


@router.post("/upload-session")
async def create_asset_upload_session(
    payload: dict,
    request: Request,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        session = await MediaDomainService.create_upload_session(
            owner_user_id=domain_user["id"],
            kind=payload.get("kind") or "",
            file_name=payload.get("file_name") or payload.get("fileName") or "",
            content_type=payload.get("content_type") or payload.get("contentType") or "application/octet-stream",
            size_bytes=int(payload.get("size_bytes") or payload.get("sizeBytes") or 0),
            request_base_url=str(request.base_url).rstrip("/"),
            usage=payload.get("usage"),
            company_id=payload.get("company_id") or payload.get("companyId"),
            title=payload.get("title"),
            caption=payload.get("caption"),
            visibility=payload.get("visibility"),
            metadata=payload.get("metadata") if isinstance(payload.get("metadata"), dict) else None,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return session


@router.put("/upload/{upload_token}")
async def upload_asset_bytes(upload_token: str, request: Request):
    try:
        body = await request.body()
        await MediaDomainService.store_local_upload(upload_token, body)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=204)


@router.post("/complete-upload")
async def complete_asset_upload(
    payload: dict,
    request: Request,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    try:
        asset = await MediaDomainService.complete_upload(
            payload.get("upload_token") or payload.get("uploadToken") or "",
            request_base_url=str(request.base_url).rstrip("/"),
            requester_user_id=domain_user["id"],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "success", "asset": asset}


@router.get("/{asset_id}/download-url")
async def get_asset_download_url(
    asset_id: str,
    request: Request,
    current_user: dict = Depends(AccessControlService.get_current_user),
):
    domain_user = await IdentityDomainService.get_or_create_user_mirror(
        supabase_id=current_user["id"],
        email=current_user["email"],
        role=current_user["role"],
    )
    download_url = await MediaDomainService.create_download_url(
        asset_id,
        request_base_url=str(request.base_url).rstrip("/"),
        requester_user_id=domain_user["id"],
    )
    if not download_url:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"status": "success", "download_url": download_url}


@router.get("/download/{download_token}")
async def download_asset(download_token: str):
    try:
        asset, stored_file = await MediaDomainService.resolve_local_asset_path(download_token)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        stored_file,
        media_type=asset.content_type,
        filename=asset.original_name,
    )
