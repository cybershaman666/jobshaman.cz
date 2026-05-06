from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import AccessControlService
from app.domains.identity.service import IdentityDomainService
from app.domains.integrations.service import IntegrationDomainService

router = APIRouter()
integration_security = HTTPBearer()


async def _domain_user(current_user: dict = Depends(AccessControlService.get_current_user)) -> Dict[str, Any]:
    return await IdentityDomainService.get_or_create_user_mirror(
        current_user["id"],
        current_user.get("email") or f"{current_user['id']}@jobshaman.local",
        role=current_user.get("role") or "recruiter",
    )


async def _api_key(credentials: HTTPAuthorizationCredentials, scope: str):
    return await IntegrationDomainService.authenticate_api_key(credentials.credentials, scope)


@router.get("/catalog")
async def integration_catalog(_user: dict = Depends(_domain_user)):
    return IntegrationDomainService.catalog()


@router.get("/api-keys")
async def list_api_keys(user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.list_api_keys(user["id"])


@router.post("/api-keys")
async def create_api_key(payload: Dict[str, Any], user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.create_api_key(user["id"], payload)


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.revoke_api_key(user["id"], key_id)


@router.get("/webhooks")
async def list_webhooks(user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.list_webhooks(user["id"])


@router.post("/webhooks")
async def create_webhook(payload: Dict[str, Any], user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.create_webhook(user["id"], payload)


@router.patch("/webhooks/{webhook_id}")
async def update_webhook(webhook_id: str, payload: Dict[str, Any], user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.update_webhook(user["id"], webhook_id, payload)


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.delete_webhook(user["id"], webhook_id)


@router.post("/webhooks/{webhook_id}/test")
async def send_test_event(webhook_id: str, user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.send_test_event(user["id"], webhook_id)


@router.get("/deliveries")
async def list_deliveries(limit: int = Query(50, ge=1, le=50), user: dict = Depends(_domain_user)):
    return await IntegrationDomainService.list_deliveries(user["id"], limit)


@router.get("/v1/applications")
async def v1_list_applications(
    limit: int = Query(100, ge=1, le=200),
    credentials: HTTPAuthorizationCredentials = Security(integration_security),
):
    key = await _api_key(credentials, "applications:read")
    return await IntegrationDomainService.list_applications(key, limit)


@router.get("/v1/applications/{application_id}")
async def v1_get_application(
    application_id: str,
    credentials: HTTPAuthorizationCredentials = Security(integration_security),
):
    key = await _api_key(credentials, "applications:read")
    return await IntegrationDomainService.get_application(key, application_id)


@router.get("/v1/candidates/{candidate_id}")
async def v1_get_candidate(
    candidate_id: str,
    credentials: HTTPAuthorizationCredentials = Security(integration_security),
):
    key = await _api_key(credentials, "candidates:read")
    return await IntegrationDomainService.get_candidate(key, candidate_id)


@router.get("/v1/handshakes/{handshake_id}/packet")
async def v1_get_handshake_packet(
    handshake_id: str,
    credentials: HTTPAuthorizationCredentials = Security(integration_security),
):
    key = await _api_key(credentials, "handshakes:read")
    return await IntegrationDomainService.get_handshake_packet(key, handshake_id)


@router.get("/v1/openapi.json")
async def v1_openapi_schema():
    return IntegrationDomainService.openapi_schema()
