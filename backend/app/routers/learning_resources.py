from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..core.security import get_current_user, require_company_access, verify_csrf_token_header
from ..services.learning_resources_store import (
    create_learning_resource,
    get_partner_learning_resources,
    learning_resources_enabled,
    list_learning_resources,
    update_learning_resource,
)

router = APIRouter()


def _payload_to_dict(payload: BaseModel) -> dict[str, Any]:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(exclude_unset=True)
    return payload.dict(exclude_unset=True)


class LearningResourcePayload(BaseModel):
    partner_name: str | None = None
    provider: str | None = None
    title: str | None = None
    description: str | None = ""
    skill_tags: list[str] = Field(default_factory=list)
    url: str | None = None
    affiliate_url: str | None = None
    duration_hours: int | None = 0
    difficulty: str | None = "Beginner"
    price: float | int | None = 0
    currency: str | None = "CZK"
    rating: float | int | None = 0
    reviews_count: int | None = 0
    is_government_funded: bool | None = False
    funding_amount_czk: int | None = None
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    status: str | None = "active"


@router.get("/learning-resources")
async def list_public_learning_resources(
    skillName: str | None = Query(default=None),
    status: str = Query(default="active"),
    partnerId: str | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
):
    if not learning_resources_enabled():
        raise HTTPException(status_code=503, detail="Learning resources store unavailable")
    try:
        items = list_learning_resources(
            skill_name=skillName,
            status=status,
            partner_id=partnerId,
            limit=limit,
        )
        return {"items": items}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list learning resources: {exc}")


@router.get("/companies/{company_id}/learning-resources")
async def list_company_learning_resources(
    company_id: str,
    user: dict = Depends(get_current_user),
):
    if not learning_resources_enabled():
        raise HTTPException(status_code=503, detail="Learning resources store unavailable")
    require_company_access(user, company_id)
    try:
        return {"items": get_partner_learning_resources(company_id)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list company learning resources: {exc}")


@router.post("/companies/{company_id}/learning-resources")
async def create_company_learning_resource(
    company_id: str,
    payload: LearningResourcePayload,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    if not learning_resources_enabled():
        raise HTTPException(status_code=503, detail="Learning resources store unavailable")
    require_company_access(user, company_id)
    data = _payload_to_dict(payload)
    if not str(data.get("title") or "").strip():
        raise HTTPException(status_code=400, detail="Missing title")
    if not str(data.get("url") or "").strip():
        raise HTTPException(status_code=400, detail="Missing url")
    if not data.get("skill_tags"):
        raise HTTPException(status_code=400, detail="Missing skill tags")
    try:
        return create_learning_resource(company_id=company_id, payload=data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create learning resource: {exc}")


@router.patch("/companies/{company_id}/learning-resources/{resource_id}")
async def patch_company_learning_resource(
    company_id: str,
    resource_id: str,
    payload: LearningResourcePayload,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not verify_csrf_token_header(request, user):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    if not learning_resources_enabled():
        raise HTTPException(status_code=503, detail="Learning resources store unavailable")
    require_company_access(user, company_id)
    try:
        return update_learning_resource(
            company_id=company_id,
            resource_id=resource_id,
            updates=_payload_to_dict(payload),
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Learning resource not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update learning resource: {exc}")
