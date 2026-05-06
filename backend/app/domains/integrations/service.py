import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import engine
from app.domains.handshake.models import Handshake, HandshakeEvent
from app.domains.handshake.service import HandshakeDomainService
from app.domains.identity.models import CandidateCVDocument, CandidateProfile, User
from app.domains.integrations.models import IntegrationApiKey, IntegrationEventDelivery, IntegrationWebhook
from app.domains.reality.models import Job
from app.domains.reality.service import RealityDomainService


INTEGRATION_SCOPES = {
    "candidates:read",
    "applications:read",
    "handshakes:read",
    "webhooks:manage",
}

WEBHOOK_EVENTS = {
    "application.submitted",
    "application.updated",
    "candidate.packet_ready",
    "candidate.withdrawn",
    "handshake.completed",
}

ATS_GUIDES = [
    {
        "id": "greenhouse",
        "name": "Greenhouse",
        "purpose": "Poslat kandidáta z JobShamanu do Greenhouse přes Candidate Ingestion API.",
        "permissions": ["Candidate Ingestion API key", "Job/Post mapping", "Permission to add notes and attachments"],
        "mapping": [
            {"jobshaman": "application.external_id", "ats": "external_id", "note": "Stabilní ID pro idempotenci."},
            {"jobshaman": "candidate.email/name", "ats": "candidate.email/name", "note": "Z kandidátního packetu."},
            {"jobshaman": "candidate.cv.url", "ats": "resume URL", "note": "Aktivní CV dokument, pokud existuje."},
            {"jobshaman": "handshake.packet_url", "ats": "note", "note": "Reviewer context a score."},
        ],
        "setup": [
            "V Greenhouse vytvořte Candidate Ingestion API key.",
            "V Integracích JobShamanu založte API key se scopes candidates:read, applications:read, handshakes:read.",
            "Namapujte Greenhouse job/posting ID k JobShaman opportunity_id.",
            "Middleware při candidate.packet_ready stáhne /handshakes/{id}/packet a pošle kandidáta do Greenhouse.",
        ],
        "checklist": ["Test candidate exists", "Resume URL opens", "external_id is stored", "Job/posting mapping is correct"],
        "troubleshooting": ["409/duplicate: reuse external_id", "Missing resume: push note with packet URL", "401: rotate Candidate Ingestion key"],
        "links": ["https://developers.greenhouse.io/candidate-ingestion.html"],
    },
    {
        "id": "ashby",
        "name": "Ashby",
        "purpose": "Vytvořit kandidáta a application v Ashby přes candidate.create a application.create.",
        "permissions": ["Ashby API key", "Candidates write", "Applications write", "Notes write"],
        "mapping": [
            {"jobshaman": "candidate", "ats": "candidate.create", "note": "Name, email, source."},
            {"jobshaman": "application.job.external_id", "ats": "application.create.jobId", "note": "Job mapping držte v middleware."},
            {"jobshaman": "score + readout", "ats": "notes", "note": "Uložit jako review note."},
        ],
        "setup": [
            "V Ashby vytvořte API key s kandidátskými a aplikačními oprávněními.",
            "V JobShamanu nastavte webhook candidate.packet_ready.",
            "Při eventu stáhněte packet a zavolejte candidate.create, potom application.create.",
            "Do notes uložte handshake summary, score a JobShaman URL.",
        ],
        "checklist": ["Candidate is created once", "Application is linked to the right job", "Notes include packet URL"],
        "troubleshooting": ["Duplicate email: attach new application to existing candidate", "Unknown jobId: update mapping table"],
        "links": ["https://developers.ashbyhq.com/reference/candidatecreate", "https://developers.ashbyhq.com/reference/applicationcreate"],
    },
    {
        "id": "lever",
        "name": "Lever",
        "purpose": "Založit opportunity v Leveru a přidat JobShaman readout do notes.",
        "permissions": ["Lever API token", "Opportunities write", "Notes write", "Postings read"],
        "mapping": [
            {"jobshaman": "application.external_id", "ats": "opportunity externalId/custom field", "note": "Idempotentní vazba."},
            {"jobshaman": "job.opportunity_id", "ats": "posting", "note": "Mapujte na Lever posting."},
            {"jobshaman": "handshake.packet_url", "ats": "note", "note": "Odkaz pro review."},
        ],
        "setup": [
            "V Leveru připravte API token.",
            "V JobShamanu vytvořte webhook candidate.packet_ready.",
            "Middleware přes POST /opportunities založí nebo najde kandidáta.",
            "Doplňte note se skóre, stavem a URL packetu.",
        ],
        "checklist": ["Opportunity created", "Posting mapping verified", "Note contains JobShaman source"],
        "troubleshooting": ["Rate limit: retry with backoff", "Duplicate candidate: search by email before create"],
        "links": ["https://hire.lever.co/developer/documentation"],
    },
    {
        "id": "workable",
        "name": "Workable",
        "purpose": "Push kandidáta do Workable pomocí API tokenu a job/candidate workflow.",
        "permissions": ["Workable API token", "Jobs read", "Candidates write"],
        "mapping": [
            {"jobshaman": "candidate", "ats": "candidate", "note": "Name, email, headline, resume URL."},
            {"jobshaman": "job.external_id", "ats": "shortcode/job", "note": "Udržujte mapping JobShaman role -> Workable job."},
            {"jobshaman": "packet.summary", "ats": "comment/note", "note": "Review kontext."},
        ],
        "setup": [
            "Ve Workable vygenerujte API token.",
            "Založte JobShaman API key a webhook.",
            "Po eventu stáhněte packet a pošlete kandidáta na odpovídající job.",
        ],
        "checklist": ["Token works", "Job shortcode is mapped", "Candidate note contains packet URL"],
        "troubleshooting": ["401: revoke and regenerate token", "404 job: verify shortcode and account subdomain"],
        "links": ["https://www.workable.com/developers", "https://help.workable.com/hc/en-us/articles/115015785428-Generating-revoking-access-tokens-for-Workable-s-API"],
    },
    {
        "id": "workday",
        "name": "Workday",
        "purpose": "Enterprise export do Workday přes vendor/partner setup nebo integrační middleware.",
        "permissions": ["Workday integration user", "Candidate import permissions", "Partner or middleware access"],
        "mapping": [
            {"jobshaman": "candidate packet", "ats": "Candidate/Job Application object", "note": "Přes Workday tenant-specific mapping."},
            {"jobshaman": "external_id", "ats": "externalReferenceId", "note": "Držte jako trvalou vazbu."},
        ],
        "setup": [
            "Domluvte s Workday administrátorem integračního uživatele nebo partner connector.",
            "V JobShamanu nastavte API key a webhooky.",
            "Middleware transformuje JobShaman packet do tenant-specific Workday payloadu.",
        ],
        "checklist": ["Integration user can import candidates", "Tenant field mapping is approved", "Retry policy is documented"],
        "troubleshooting": ["Field validation differs per tenant", "Use delivery audit event_id for replay"],
        "links": [],
    },
    {
        "id": "icims",
        "name": "iCIMS",
        "purpose": "Enterprise export do iCIMS přes zákaznický API/partner integration setup.",
        "permissions": ["iCIMS API access", "Candidate/Profile write", "Workflow status permissions"],
        "mapping": [
            {"jobshaman": "candidate", "ats": "Person/Profile", "note": "Name, email, CV, source."},
            {"jobshaman": "application.status", "ats": "workflow status", "note": "Mapovat na schválené stavy iCIMS."},
            {"jobshaman": "packet", "ats": "note/attachment", "note": "Readout jako poznámka nebo link."},
        ],
        "setup": [
            "Požádejte iCIMS admina o API nebo partner-mediated přístup.",
            "V JobShamanu založte API key a webhook endpoint.",
            "Middleware zpracuje eventy a zapisuje kandidáta, application a notes do iCIMS.",
        ],
        "checklist": ["API user has write permissions", "Workflow statuses are mapped", "event_id is stored for replay"],
        "troubleshooting": ["Enterprise tenants vary by module", "Start with readout link before full attachment sync"],
        "links": ["https://www.icims.com/company/newsroom/appsruntheworld2025/"],
    },
]


def _utc_iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _json_loads(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback


class IntegrationDomainService:
    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_api_token() -> str:
        return f"jsh_live_{secrets.token_urlsafe(32)}"

    @staticmethod
    def generate_webhook_secret() -> str:
        return f"whsec_{secrets.token_urlsafe(32)}"

    @staticmethod
    def sign_webhook_payload(secret: str, raw_body: bytes) -> str:
        digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    @staticmethod
    def has_scope(granted: List[str], required: str) -> bool:
        return required in set(granted or [])

    @staticmethod
    async def _company_for_user(user_id: str) -> Dict[str, Any]:
        company = await RealityDomainService.get_company_for_user(user_id)
        if not company or not company.get("id"):
            raise HTTPException(status_code=403, detail="Recruiter account is not connected to a company workspace")
        return company

    @staticmethod
    def _serialize_key(key: IntegrationApiKey) -> Dict[str, Any]:
        return {
            "id": str(key.id),
            "company_id": str(key.company_id),
            "name": key.name,
            "token_prefix": key.token_prefix,
            "scopes": key.scopes or [],
            "created_at": _utc_iso(key.created_at),
            "updated_at": _utc_iso(key.updated_at),
            "last_used_at": _utc_iso(key.last_used_at),
            "expires_at": _utc_iso(key.expires_at),
            "revoked_at": _utc_iso(key.revoked_at),
        }

    @staticmethod
    def _serialize_webhook(webhook: IntegrationWebhook, include_secret: bool = False) -> Dict[str, Any]:
        payload = {
            "id": str(webhook.id),
            "company_id": str(webhook.company_id),
            "url": webhook.url,
            "secret_prefix": webhook.secret[:12],
            "events": webhook.events or [],
            "is_active": webhook.is_active,
            "created_at": _utc_iso(webhook.created_at),
            "updated_at": _utc_iso(webhook.updated_at),
            "last_success_at": _utc_iso(webhook.last_success_at),
            "last_failure_at": _utc_iso(webhook.last_failure_at),
        }
        if include_secret:
            payload["secret"] = webhook.secret
        return payload

    @staticmethod
    def _serialize_delivery(delivery: IntegrationEventDelivery) -> Dict[str, Any]:
        return {
            "id": str(delivery.id),
            "company_id": str(delivery.company_id),
            "webhook_id": str(delivery.webhook_id) if delivery.webhook_id else None,
            "event_id": delivery.event_id,
            "event_type": delivery.event_type,
            "payload": delivery.payload,
            "status": delivery.status,
            "attempts": delivery.attempts,
            "response_status": delivery.response_status,
            "response_body": delivery.response_body,
            "last_error": delivery.last_error,
            "created_at": _utc_iso(delivery.created_at),
            "delivered_at": _utc_iso(delivery.delivered_at),
        }

    @staticmethod
    async def list_api_keys(user_id: str) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(IntegrationApiKey)
                .where(IntegrationApiKey.company_id == uuid.UUID(company["id"]))
                .order_by(IntegrationApiKey.created_at.desc())
            )
            return {"company_id": company["id"], "items": [IntegrationDomainService._serialize_key(item) for item in result.scalars().all()]}

    @staticmethod
    async def create_api_key(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        token = IntegrationDomainService.generate_api_token()
        scopes = [scope for scope in payload.get("scopes", []) if scope in INTEGRATION_SCOPES]
        if not scopes:
            scopes = ["candidates:read", "applications:read", "handshakes:read"]
        expires_at = None
        if payload.get("expires_at"):
            expires_at = datetime.fromisoformat(str(payload["expires_at"]).replace("Z", "+00:00")).replace(tzinfo=None)
        async with AsyncSession(engine) as session:
            key = IntegrationApiKey(
                company_id=uuid.UUID(company["id"]),
                name=str(payload.get("name") or "ATS integration key")[:160],
                token_prefix=token[:18],
                token_hash=IntegrationDomainService.hash_token(token),
                scopes=scopes,
                created_by=uuid.UUID(user_id),
                expires_at=expires_at,
            )
            session.add(key)
            await session.commit()
            await session.refresh(key)
            data = IntegrationDomainService._serialize_key(key)
            data["token"] = token
            return data

    @staticmethod
    async def revoke_api_key(user_id: str, key_id: str) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            key = await session.get(IntegrationApiKey, uuid.UUID(key_id))
            if not key or str(key.company_id) != company["id"]:
                raise HTTPException(status_code=404, detail="API key not found")
            key.revoked_at = datetime.utcnow()
            key.updated_at = datetime.utcnow()
            await session.commit()
            return IntegrationDomainService._serialize_key(key)

    @staticmethod
    async def authenticate_api_key(token: str, required_scope: str) -> IntegrationApiKey:
        if not token or not token.startswith("jsh_live_"):
            raise HTTPException(status_code=401, detail="Invalid integration API token")
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(IntegrationApiKey).where(IntegrationApiKey.token_hash == IntegrationDomainService.hash_token(token)).limit(1)
            )
            key = result.scalar_one_or_none()
            now = datetime.utcnow()
            if not key or key.revoked_at or (key.expires_at and key.expires_at < now):
                raise HTTPException(status_code=401, detail="Integration API token is inactive")
            if not IntegrationDomainService.has_scope(key.scopes or [], required_scope):
                raise HTTPException(status_code=403, detail=f"Missing integration scope: {required_scope}")
            key.last_used_at = now
            key.updated_at = now
            await session.commit()
            return key

    @staticmethod
    async def list_webhooks(user_id: str) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(IntegrationWebhook)
                .where(IntegrationWebhook.company_id == uuid.UUID(company["id"]))
                .order_by(IntegrationWebhook.created_at.desc())
            )
            return {"company_id": company["id"], "items": [IntegrationDomainService._serialize_webhook(item) for item in result.scalars().all()]}

    @staticmethod
    async def create_webhook(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        url = str(payload.get("url") or "").strip()
        if not url.startswith(("https://", "http://localhost", "http://127.0.0.1")):
            raise HTTPException(status_code=422, detail="Webhook URL must be HTTPS outside localhost")
        events = [event for event in payload.get("events", []) if event in WEBHOOK_EVENTS] or ["candidate.packet_ready"]
        async with AsyncSession(engine) as session:
            webhook = IntegrationWebhook(
                company_id=uuid.UUID(company["id"]),
                url=url[:1200],
                secret=IntegrationDomainService.generate_webhook_secret(),
                events=events,
                is_active=bool(payload.get("is_active", True)),
                created_by=uuid.UUID(user_id),
            )
            session.add(webhook)
            await session.commit()
            await session.refresh(webhook)
            return IntegrationDomainService._serialize_webhook(webhook, include_secret=True)

    @staticmethod
    async def update_webhook(user_id: str, webhook_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            webhook = await session.get(IntegrationWebhook, uuid.UUID(webhook_id))
            if not webhook or str(webhook.company_id) != company["id"]:
                raise HTTPException(status_code=404, detail="Webhook not found")
            if "url" in payload:
                url = str(payload.get("url") or "").strip()
                if not url.startswith(("https://", "http://localhost", "http://127.0.0.1")):
                    raise HTTPException(status_code=422, detail="Webhook URL must be HTTPS outside localhost")
                webhook.url = url[:1200]
            if "events" in payload:
                webhook.events = [event for event in payload.get("events", []) if event in WEBHOOK_EVENTS]
            if "is_active" in payload:
                webhook.is_active = bool(payload.get("is_active"))
            webhook.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(webhook)
            return IntegrationDomainService._serialize_webhook(webhook)

    @staticmethod
    async def delete_webhook(user_id: str, webhook_id: str) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            webhook = await session.get(IntegrationWebhook, uuid.UUID(webhook_id))
            if not webhook or str(webhook.company_id) != company["id"]:
                raise HTTPException(status_code=404, detail="Webhook not found")
            webhook.is_active = False
            webhook.updated_at = datetime.utcnow()
            await session.commit()
            return IntegrationDomainService._serialize_webhook(webhook)

    @staticmethod
    async def list_deliveries(user_id: str, limit: int = 50) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(IntegrationEventDelivery)
                .where(IntegrationEventDelivery.company_id == uuid.UUID(company["id"]))
                .order_by(IntegrationEventDelivery.created_at.desc())
                .limit(max(1, min(50, int(limit or 50))))
            )
            return {"company_id": company["id"], "items": [IntegrationDomainService._serialize_delivery(item) for item in result.scalars().all()]}

    @staticmethod
    async def send_test_event(user_id: str, webhook_id: str) -> Dict[str, Any]:
        company = await IntegrationDomainService._company_for_user(user_id)
        async with AsyncSession(engine) as session:
            webhook = await session.get(IntegrationWebhook, uuid.UUID(webhook_id))
            if not webhook or str(webhook.company_id) != company["id"]:
                raise HTTPException(status_code=404, detail="Webhook not found")
            payload = IntegrationDomainService._test_payload(company["id"])
            delivery = IntegrationEventDelivery(
                company_id=uuid.UUID(company["id"]),
                webhook_id=webhook.id,
                event_id=payload["event_id"],
                event_type=payload["type"],
                payload=payload,
                status="pending",
            )
            session.add(delivery)
            await session.commit()
            await session.refresh(delivery)
            await IntegrationDomainService._deliver_webhook(session, webhook, delivery)
            await session.refresh(delivery)
            return IntegrationDomainService._serialize_delivery(delivery)

    @staticmethod
    async def _deliver_webhook(session: AsyncSession, webhook: IntegrationWebhook, delivery: IntegrationEventDelivery) -> None:
        raw = _json(delivery.payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "JobShaman-Integrations/1.0",
            "X-JobShaman-Signature": IntegrationDomainService.sign_webhook_payload(webhook.secret, raw),
            "X-JobShaman-Event-Id": delivery.event_id,
        }
        delivery.attempts += 1
        try:
            req = urllib_request.Request(webhook.url, data=raw, headers=headers, method="POST")
            with urllib_request.urlopen(req, timeout=6) as response:
                body = response.read(4000).decode("utf-8", errors="replace")
                delivery.response_status = int(response.status)
                delivery.response_body = body[:4000]
                delivery.status = "delivered" if 200 <= response.status < 300 else "failed"
        except HTTPError as exc:
            delivery.response_status = int(exc.code)
            delivery.response_body = exc.read(4000).decode("utf-8", errors="replace")
            delivery.status = "failed"
            delivery.last_error = str(exc)
        except (URLError, TimeoutError, OSError) as exc:
            delivery.status = "failed"
            delivery.last_error = str(exc)[:1000]
        now = datetime.utcnow()
        if delivery.status == "delivered":
            delivery.delivered_at = now
            webhook.last_success_at = now
        else:
            webhook.last_failure_at = now
        webhook.updated_at = now
        await session.commit()

    @staticmethod
    def _app_base_url() -> str:
        return os.environ.get("JOBSHAMAN_APP_URL", "https://jobshaman.cz").rstrip("/")

    @staticmethod
    def _api_base_url() -> str:
        return os.environ.get("JOBSHAMAN_API_URL") or os.environ.get("VITE_API_URL") or "https://site--jobshaman--rb4dlj74d5kc.code.run"

    @staticmethod
    async def list_applications(key: IntegrationApiKey, limit: int = 100) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(Handshake)
                .where(Handshake.company_id == key.company_id)
                .order_by(Handshake.updated_at.desc())
                .limit(max(1, min(200, int(limit or 100))))
            )
            items = [await IntegrationDomainService._application_payload(session, item) for item in result.scalars().all()]
            return {"source": "jobshaman", "company_id": str(key.company_id), "items": items}

    @staticmethod
    async def get_application(key: IntegrationApiKey, application_id: str) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            handshake = await IntegrationDomainService._load_company_handshake(session, key.company_id, application_id)
            return await IntegrationDomainService._application_payload(session, handshake, include_packet=True)

    @staticmethod
    async def get_candidate(key: IntegrationApiKey, candidate_id: str) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            candidate_uuid = uuid.UUID(candidate_id)
            exists = await session.execute(
                select(Handshake.id).where(Handshake.company_id == key.company_id, Handshake.user_id == candidate_uuid).limit(1)
            )
            if not exists.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Candidate not found for this company")
            return await IntegrationDomainService._candidate_payload(session, candidate_uuid, key.company_id)

    @staticmethod
    async def get_handshake_packet(key: IntegrationApiKey, handshake_id: str) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            handshake = await IntegrationDomainService._load_company_handshake(session, key.company_id, handshake_id)
            session_payload = await HandshakeDomainService._session_payload(session, handshake)
            events_result = await session.execute(
                select(HandshakeEvent)
                .where(HandshakeEvent.handshake_id == handshake.id)
                .order_by(HandshakeEvent.created_at.asc())
                .limit(200)
            )
            candidate = await IntegrationDomainService._candidate_payload(session, handshake.user_id, key.company_id)
            application = await IntegrationDomainService._application_payload(session, handshake)
            return {
                "external_id": f"jsh_handshake_{handshake.id}",
                "company_id": str(key.company_id),
                "jobshaman_url": f"{IntegrationDomainService._app_base_url()}/recruiter/talent-pool?handshake={handshake.id}",
                "updated_at": handshake.updated_at.isoformat(),
                "source": "jobshaman",
                "schema_version": "jobshaman-handshake-packet-v1",
                "application": application,
                "candidate": candidate,
                "session": session_payload,
                "events": [
                    {
                        "id": str(event.id),
                        "type": event.event_type,
                        "from_status": event.from_status,
                        "to_status": event.to_status,
                        "payload": event.payload,
                        "created_at": event.created_at.isoformat(),
                    }
                    for event in events_result.scalars().all()
                ],
            }

    @staticmethod
    async def _load_company_handshake(session: AsyncSession, company_id: uuid.UUID, handshake_id: str) -> Handshake:
        result = await session.execute(
            select(Handshake).where(Handshake.id == uuid.UUID(handshake_id), Handshake.company_id == company_id).limit(1)
        )
        handshake = result.scalar_one_or_none()
        if not handshake:
            raise HTTPException(status_code=404, detail="Application not found")
        return handshake

    @staticmethod
    async def _application_payload(session: AsyncSession, handshake: Handshake, include_packet: bool = False) -> Dict[str, Any]:
        session_payload = await HandshakeDomainService._session_payload(session, handshake)
        job = await session.get(Job, handshake.opportunity_id) if handshake.opportunity_id else None
        job_payload = {
            "id": str(job.id) if job else handshake.job_id,
            "external_id": f"jsh_job_{job.id}" if job else f"jsh_job_{handshake.job_id}",
            "title": job.title if job else session_payload.get("job_snapshot", {}).get("title"),
        }
        payload = {
            "external_id": f"jsh_application_{handshake.id}",
            "id": str(handshake.id),
            "company_id": str(handshake.company_id),
            "candidate_id": str(handshake.user_id),
            "handshake_id": str(handshake.id),
            "job_id": handshake.job_id,
            "job": job_payload,
            "status": handshake.status,
            "match_score": handshake.match_score_snapshot,
            "jobshaman_url": f"{IntegrationDomainService._app_base_url()}/recruiter/talent-pool?handshake={handshake.id}",
            "updated_at": handshake.updated_at.isoformat(),
            "created_at": handshake.created_at.isoformat(),
            "source": "jobshaman",
        }
        if include_packet:
            payload["packet_url"] = f"{IntegrationDomainService._api_base_url().rstrip('/')} /integrations/v1/handshakes/{handshake.id}/packet".replace(" /", "/")
            payload["session"] = session_payload
        return payload

    @staticmethod
    async def _candidate_payload(session: AsyncSession, candidate_id: uuid.UUID, company_id: uuid.UUID) -> Dict[str, Any]:
        user = await session.get(User, candidate_id)
        profile = await session.get(CandidateProfile, candidate_id)
        cv_result = await session.execute(
            select(CandidateCVDocument)
            .where(CandidateCVDocument.user_id == candidate_id, CandidateCVDocument.is_active == True)  # noqa: E712
            .order_by(CandidateCVDocument.uploaded_at.desc())
            .limit(1)
        )
        cv = cv_result.scalar_one_or_none()
        updated_at = profile.updated_at if profile else (user.created_at if user else datetime.utcnow())
        return {
            "external_id": f"jsh_candidate_{candidate_id}",
            "id": str(candidate_id),
            "company_id": str(company_id),
            "name": profile.full_name if profile and profile.full_name else (user.email if user else ""),
            "email": user.email if user else None,
            "location": profile.location if profile else None,
            "skills": _json_loads(profile.skills if profile else None, []),
            "cv": {
                "id": str(cv.id) if cv else None,
                "file_name": cv.original_name if cv else None,
                "url": cv.file_url if cv else None,
                "content_type": cv.content_type if cv else None,
            },
            "jobshaman_url": f"{IntegrationDomainService._app_base_url()}/recruiter/talent-pool?candidate={candidate_id}",
            "updated_at": updated_at.isoformat(),
            "source": "jobshaman",
        }

    @staticmethod
    def _test_payload(company_id: str) -> Dict[str, Any]:
        now = datetime.utcnow().isoformat()
        event_id = f"evt_test_{uuid.uuid4()}"
        return {
            "event_id": event_id,
            "type": "candidate.packet_ready",
            "created_at": now,
            "source": "jobshaman",
            "company_id": company_id,
            "data": {
                "external_id": f"jsh_application_test_{event_id[-12:]}",
                "candidate": {
                    "external_id": f"jsh_candidate_test_{event_id[-12:]}",
                    "name": "Test Candidate",
                    "email": "candidate@example.com",
                },
                "application": {
                    "external_id": f"jsh_application_test_{event_id[-12:]}",
                    "status": "company_reviewing",
                    "match_score": 87,
                },
                "handshake": {
                    "external_id": f"jsh_handshake_test_{event_id[-12:]}",
                    "packet_url": f"{IntegrationDomainService._api_base_url().rstrip('/')}/integrations/v1/handshakes/test/packet",
                },
            },
        }

    @staticmethod
    def catalog() -> Dict[str, Any]:
        return {
            "source": "jobshaman",
            "schema_version": "jobshaman-integrations-catalog-v1",
            "scopes": sorted(INTEGRATION_SCOPES),
            "events": sorted(WEBHOOK_EVENTS),
            "guides": ATS_GUIDES,
            "sample_payload": IntegrationDomainService._test_payload("company_test"),
        }

    @staticmethod
    def openapi_schema() -> Dict[str, Any]:
        api_base = IntegrationDomainService._api_base_url().rstrip("/")
        return {
            "openapi": "3.1.0",
            "info": {
                "title": "JobShaman Integration API",
                "version": "1.0.0",
                "description": "Company-scoped API for exporting JobShaman applications, candidates and handshake packets into ATS systems.",
            },
            "servers": [{"url": api_base}],
            "components": {
                "securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer"}},
                "schemas": {
                    "Application": {"type": "object", "required": ["external_id", "company_id", "jobshaman_url", "updated_at", "source"]},
                    "Candidate": {"type": "object", "required": ["external_id", "company_id", "jobshaman_url", "updated_at", "source"]},
                    "HandshakePacket": {"type": "object", "required": ["external_id", "company_id", "jobshaman_url", "updated_at", "source", "application", "candidate"]},
                },
            },
            "security": [{"bearerAuth": []}],
            "paths": {
                "/integrations/v1/applications": {"get": {"summary": "List applications", "x-required-scope": "applications:read"}},
                "/integrations/v1/applications/{id}": {"get": {"summary": "Get application", "x-required-scope": "applications:read"}},
                "/integrations/v1/candidates/{id}": {"get": {"summary": "Get candidate", "x-required-scope": "candidates:read"}},
                "/integrations/v1/handshakes/{id}/packet": {"get": {"summary": "Get handshake packet", "x-required-scope": "handshakes:read"}},
                "/integrations/v1/openapi.json": {"get": {"summary": "OpenAPI schema"}},
            },
        }
