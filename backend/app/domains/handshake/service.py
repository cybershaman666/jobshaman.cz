from sqlmodel import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine
from app.domains.handshake.models import Handshake, HandshakeEvent, SandboxEvaluation, SandboxSession, SlotReservation
from app.domains.identity.models import CandidateJcfpmSnapshot, CandidateProfile, User
from app.domains.reality.models import CompanyUser
from app.domains.reality.service import RealityDomainService
from app.domains.identity.service import IdentityDomainService
from app.domains.recommendation.learning import LifecycleBackprop
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import json

TERMINAL_STATUSES = {"completed", "rejected", "withdrawn", "closed"}
OPEN_STATUSES = {"initiated", "in_progress", "submitted", "company_reviewing", "mutual_handshake"}

def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}

def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []

def _loads(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback

def _clean_text(value: Any, limit: int = 1200) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())[:limit]

def _uuid_or_none(value: Any) -> Optional[uuid.UUID]:
    try:
        return uuid.UUID(str(value)) if value else None
    except (TypeError, ValueError):
        return None

class HandshakeDomainService:
    @staticmethod
    async def initiate_handshake(user_id: str, job_id: str, score: float = 0.0) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            existing_result = await session.execute(
                select(Handshake).where(
                    Handshake.user_id == uuid.UUID(user_id),
                    Handshake.job_id == str(job_id),
                    Handshake.status.in_(list(OPEN_STATUSES)),
                ).order_by(Handshake.created_at.desc())
            )
            existing = existing_result.scalars().first()
            if existing:
                return await HandshakeDomainService._hydrate_handshake_response(session, existing)

            job = await RealityDomainService.get_job_details(str(job_id)) or {}
            company_id = _uuid_or_none(job.get("company_id"))
            opportunity_id = _uuid_or_none(job.get("id"))
            if not opportunity_id or not company_id:
                raise ValueError("Handshake can be initiated only for a native published challenge.")
            handshake = Handshake(
                user_id=uuid.UUID(user_id),
                job_id=str(job_id),
                opportunity_id=opportunity_id,
                company_id=company_id,
                match_score_snapshot=score,
                status="in_progress"
            )
            session.add(handshake)
            await session.flush()
            await HandshakeDomainService._reserve_slots(session, uuid.UUID(user_id), company_id, opportunity_id, handshake.id, job)
            candidate_context = await HandshakeDomainService._candidate_context(session, user_id)
            assignment = HandshakeDomainService._build_assignment_payload(job, candidate_context)
            sandbox = SandboxSession(
                handshake_id=handshake.id,
                opportunity_id=opportunity_id,
                status="in_progress",
                assignment_payload=assignment,
                submission_payload={
                    "schema_version": "handshake-submission-v1",
                    "status": "in_progress",
                    "answers": {},
                    "stages": [],
                    "attachments": [],
                    "external_runs": [],
                    "updated_at": datetime.utcnow().isoformat(),
                },
            )
            session.add(sandbox)
            session.add(HandshakeEvent(
                handshake_id=handshake.id,
                actor_user_id=uuid.UUID(user_id),
                actor_type="candidate",
                event_type="handshake_started",
                to_status="in_progress",
                payload={"job_id": str(job_id), "match_score_snapshot": score, "assignment": assignment},
            ))
            await LifecycleBackprop.process_handshake_event(
                user_id=user_id,
                job_id=str(job_id),
                event_type="handshake_started",
                from_status=None,
                to_status="in_progress"
            )
            await session.commit()
            await session.refresh(handshake)
            await session.refresh(sandbox)
            return await HandshakeDomainService._hydrate_handshake_response(session, handshake)

    @staticmethod
    async def get_user_handshakes(user_id: str) -> List[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = select(Handshake).where(Handshake.user_id == uuid.UUID(user_id))
            result = await session.execute(statement)
            handshakes = result.scalars().all()
            return [HandshakeDomainService._handshake_to_dict(h) for h in handshakes]

    @staticmethod
    async def get_user_handshake(user_id: str, handshake_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(Handshake).where(
                    Handshake.id == uuid.UUID(handshake_id),
                    Handshake.user_id == uuid.UUID(user_id),
                )
            )
            handshake = result.scalar_one_or_none()
            if not handshake:
                return None
            return await HandshakeDomainService._hydrate_handshake_response(session, handshake)

    @staticmethod
    async def patch_answer(
        user_id: str,
        handshake_id: str,
        step_id: str,
        answer: Any,
        stage: Optional[str] = None,
        elapsed_ms: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            handshake = await HandshakeDomainService._load_user_handshake(session, user_id, handshake_id)
            if not handshake:
                return None
            sandbox = await HandshakeDomainService._ensure_sandbox(session, handshake)
            submission = dict(_safe_dict(sandbox.submission_payload))
            answers = dict(_safe_dict(submission.get("answers")))
            answers[step_id] = {
                "answer": answer,
                "updated_at": datetime.utcnow().isoformat(),
                "elapsed_ms": elapsed_ms,
            }
            stages = list(_safe_list(submission.get("stages")))
            stages.append({
                "step_id": step_id,
                "stage": stage or step_id,
                "at": datetime.utcnow().isoformat(),
                "elapsed_ms": elapsed_ms,
            })
            submission.update({
                "schema_version": "handshake-submission-v1",
                "status": "in_progress",
                "answers": answers,
                "stages": stages[-120:],
                "updated_at": datetime.utcnow().isoformat(),
            })
            sandbox.submission_payload = submission
            sandbox.status = "in_progress"
            previous_status = handshake.status
            handshake.status = "in_progress"
            handshake.state_version += 1
            handshake.updated_at = datetime.utcnow()
            session.add(HandshakeEvent(
                handshake_id=handshake.id,
                actor_user_id=uuid.UUID(user_id),
                actor_type="candidate",
                event_type="handshake_answer_saved",
                from_status=previous_status,
                to_status=handshake.status,
                payload={"step_id": step_id, "stage": stage, "elapsed_ms": elapsed_ms},
            ))
            await session.commit()
            await session.refresh(handshake)
            return await HandshakeDomainService._hydrate_handshake_response(session, handshake)

    @staticmethod
    async def finalize_handshake(user_id: str, handshake_id: str, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            handshake = await HandshakeDomainService._load_user_handshake(session, user_id, handshake_id)
            if not handshake:
                return None
            sandbox = await HandshakeDomainService._ensure_sandbox(session, handshake)
            submission = dict(_safe_dict(sandbox.submission_payload))
            submission.update({
                "status": "submitted",
                "final_note": _clean_text(note, 3000) if note else submission.get("final_note"),
                "finalized_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            })
            sandbox.submission_payload = submission
            sandbox.status = "submitted"
            sandbox.submitted_at = datetime.utcnow()
            previous_status = handshake.status
            handshake.status = "company_reviewing"
            handshake.state_version += 1
            handshake.updated_at = datetime.utcnow()
            session.add(HandshakeEvent(
                handshake_id=handshake.id,
                actor_user_id=uuid.UUID(user_id),
                actor_type="candidate",
                event_type="handshake_submitted",
                from_status=previous_status,
                to_status=handshake.status,
                payload={"note_present": bool(note), "answer_count": len(_safe_dict(submission.get("answers")))},
            ))
            await HandshakeDomainService._mark_slots(session, handshake.id, "consumed")
            await session.commit()
            await session.refresh(handshake)
            
            # Notify candidate
            await IdentityDomainService.create_notification(str(handshake.user_id), {
                "title": "Handshake odeslán",
                "content": f"Tvoje řešení pro pozici {handshake.job_id} bylo odesláno firmě ke kontrole.",
                "type": "handshake",
                "link": f"/candidate/handshake/{handshake.id}"
            })
            
            return await HandshakeDomainService._hydrate_handshake_response(session, handshake)

    @staticmethod
    async def add_external_submission(
        user_id: str,
        handshake_id: str,
        provider: str,
        external_url: str,
        comment: Optional[str] = None,
        evidence_required: bool = True,
        visibility: str = "company_review",
    ) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            handshake = await HandshakeDomainService._load_user_handshake(session, user_id, handshake_id)
            if not handshake:
                return None
            sandbox = await HandshakeDomainService._ensure_sandbox(session, handshake)
            submission = dict(_safe_dict(sandbox.submission_payload))
            external_runs = list(_safe_list(submission.get("external_runs")))
            provider_key = _clean_text(provider, 40).lower() or "other"
            if provider_key not in {"notion", "canva", "figma", "google_docs", "miro", "other"}:
                provider_key = "other"
            external_runs.append({
                "provider": provider_key,
                "external_url": _clean_text(external_url, 1000),
                "comment": _clean_text(comment, 1200),
                "expected_submission": "URL + reviewer context",
                "evidence_required": bool(evidence_required),
                "visibility": visibility,
                "submitted_at": datetime.utcnow().isoformat(),
            })
            submission.update({
                "schema_version": "handshake-submission-v1",
                "status": "in_progress",
                "external_runs": external_runs[-40:],
                "updated_at": datetime.utcnow().isoformat(),
            })
            sandbox.submission_payload = submission
            handshake.updated_at = datetime.utcnow()
            handshake.state_version += 1
            session.add(HandshakeEvent(
                handshake_id=handshake.id,
                actor_user_id=uuid.UUID(user_id),
                actor_type="candidate",
                event_type="external_submission_added",
                payload={"provider": provider_key, "visibility": visibility},
            ))
            await session.commit()
            await session.refresh(handshake)
            return await HandshakeDomainService._hydrate_handshake_response(session, handshake)

    @staticmethod
    async def update_status(
        handshake_id: str,
        status: str,
        actor_user_id: Optional[str] = None,
        actor_type: str = "system",
        payload: Optional[Dict[str, Any]] = None,
    ) -> bool:
        async with AsyncSession(engine) as session:
            statement = select(Handshake).where(Handshake.id == uuid.UUID(handshake_id))
            result = await session.execute(statement)
            handshake = result.scalar_one_or_none()
            if handshake:
                previous_status = handshake.status
                handshake.status = status
                handshake.state_version += 1
                handshake.updated_at = datetime.utcnow()
                if status in ["completed", "rejected"]:
                    handshake.closed_at = datetime.utcnow()
                if status in {"completed", "mutual_handshake"}:
                    await HandshakeDomainService._mark_slots(session, handshake.id, "consumed")
                elif status in {"rejected", "withdrawn", "closed"}:
                    await HandshakeDomainService._mark_slots(session, handshake.id, "released")
                session.add(HandshakeEvent(
                    handshake_id=handshake.id,
                    actor_user_id=uuid.UUID(actor_user_id) if actor_user_id else None,
                    actor_type=actor_type,
                    event_type="handshake_status_changed",
                    from_status=previous_status,
                    to_status=status,
                    payload=payload or {},
                ))
                await session.commit()
                
                await LifecycleBackprop.process_handshake_event(
                    user_id=str(handshake.user_id),
                    job_id=handshake.job_id,
                    event_type="handshake_status_changed",
                    from_status=previous_status,
                    to_status=status
                )
                
                # Notify candidate about status change
                status_labels = {
                    "company_reviewing": "Firma prochází tvůj handshake",
                    "mutual_handshake": "Gratulujeme! Firma tě zve k osobnímu handshaku",
                    "completed": "Handshake úspěšně dokončen",
                    "rejected": "Handshake byl zamítnut"
                }
                if status in status_labels:
                    await IdentityDomainService.create_notification(str(handshake.user_id), {
                        "title": status_labels[status],
                        "content": f"Stav tvého handshaku pro pozici {handshake.job_id} se změnil na {status}.",
                        "type": "handshake",
                        "link": f"/candidate/handshake/{handshake.id}"
                    })
                
                return True
            return False

    @staticmethod
    async def get_handshake_events(user_id: str, handshake_id: str) -> List[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            handshake_result = await session.execute(
                select(Handshake).where(
                    Handshake.id == uuid.UUID(handshake_id),
                    Handshake.user_id == uuid.UUID(user_id),
                )
            )
            handshake = handshake_result.scalar_one_or_none()
            if not handshake:
                return []
            result = await session.execute(
                select(HandshakeEvent)
                .where(HandshakeEvent.handshake_id == handshake.id)
                .order_by(HandshakeEvent.created_at.asc())
            )
            return [HandshakeDomainService._event_to_dict(event) for event in result.scalars().all()]

    @staticmethod
    async def user_has_company_access(user_id: str, company_id: str) -> bool:
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(CompanyUser).where(
                    CompanyUser.user_id == uuid.UUID(user_id),
                    CompanyUser.company_id == uuid.UUID(company_id),
                )
            )
            return result.scalar_one_or_none() is not None

    @staticmethod
    async def list_company_handshakes(user_id: str, company_id: str, limit: int = 80) -> Optional[List[Dict[str, Any]]]:
        async with AsyncSession(engine) as session:
            if not await HandshakeDomainService._has_company_access(session, user_id, company_id):
                return None
            result = await session.execute(
                select(Handshake)
                .where(Handshake.company_id == uuid.UUID(company_id))
                .order_by(Handshake.updated_at.desc())
                .limit(max(1, min(int(limit or 80), 200)))
            )
            handshakes = result.scalars().all()
            return [await HandshakeDomainService._company_handshake_item(session, item) for item in handshakes]

    @staticmethod
    async def get_company_handshake_readout(user_id: str, company_id: str, handshake_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            if not await HandshakeDomainService._has_company_access(session, user_id, company_id):
                return None
            result = await session.execute(
                select(Handshake).where(
                    Handshake.id == uuid.UUID(handshake_id),
                    Handshake.company_id == uuid.UUID(company_id),
                )
            )
            handshake = result.scalar_one_or_none()
            if not handshake:
                return None
            session_payload = await HandshakeDomainService._session_payload(session, handshake)
            readout = await HandshakeDomainService._build_readout(session, handshake, session_payload, reveal_identity=False)
            session.add(HandshakeEvent(
                handshake_id=handshake.id,
                actor_user_id=uuid.UUID(user_id),
                actor_type="company",
                event_type="company_readout_viewed",
                payload={"anonymous": True},
            ))
            await session.commit()
            return {"handshake_id": str(handshake.id), "readout": readout, "session": session_payload}

    @staticmethod
    async def get_company_dashboard(user_id: str, company_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            if not await HandshakeDomainService._has_company_access(session, user_id, company_id):
                return None
            handshakes_result = await session.execute(
                select(Handshake)
                .where(Handshake.company_id == uuid.UUID(company_id))
                .order_by(Handshake.updated_at.desc())
                .limit(200)
            )
            handshakes = handshakes_result.scalars().all()
            roles = await HandshakeDomainService._company_roles(session, company_id)
            sandbox_result = await session.execute(
                select(SandboxSession).join(Handshake, SandboxSession.handshake_id == Handshake.id)
                .where(Handshake.company_id == uuid.UUID(company_id))
            )
            sandboxes = sandbox_result.scalars().all()
            evaluations_result = await session.execute(
                select(SandboxEvaluation).join(SandboxSession, SandboxEvaluation.sandbox_session_id == SandboxSession.id)
                .join(Handshake, SandboxSession.handshake_id == Handshake.id)
                .where(Handshake.company_id == uuid.UUID(company_id))
            )
            evaluations = evaluations_result.scalars().all()
            status_counts: Dict[str, int] = {}
            for item in handshakes:
                status_counts[item.status] = status_counts.get(item.status, 0) + 1
            top_candidates = [await HandshakeDomainService._company_handshake_item(session, item) for item in handshakes[:6]]
            active_roles = HandshakeDomainService._active_roles_from_data(roles, handshakes)
            submitted_count = sum(1 for item in handshakes if item.status in {"submitted", "company_reviewing", "mutual_handshake", "completed"})
            avg_eval = round(sum(float(item.score or 0) for item in evaluations) / len(evaluations), 1) if evaluations else 0
            return {
                "schema_version": "company-dashboard-v1",
                "company_id": company_id,
                "metrics": {
                    "active_roles": len(roles),
                    "candidates": len({str(item.user_id) for item in handshakes}),
                    "handshakes_in_process": sum(1 for item in handshakes if item.status not in TERMINAL_STATUSES),
                    "submitted": submitted_count,
                    "sandbox_sessions": len(sandboxes),
                    "sandbox_completed": sum(1 for item in sandboxes if item.status in {"submitted", "completed", "evaluated"}),
                    "average_evaluation": avg_eval,
                    "hire_success": min(96, 68 + submitted_count * 3),
                    "team_resonance": min(94, 72 + len(evaluations) * 2),
                },
                "status_counts": status_counts,
                "active_roles": active_roles,
                "top_candidates": top_candidates,
                "pipeline": [
                    {"id": "assigned", "label": "Zadano", "count": len(roles), "color": "#7da0f6"},
                    {"id": "sandbox", "label": "V sandboxu", "count": len(sandboxes), "color": "#94bdf5"},
                    {"id": "handshake", "label": "Handshake", "count": sum(1 for item in handshakes if item.status in {"in_progress", "submitted", "company_reviewing"}), "color": "#ffd88d"},
                    {"id": "accepted", "label": "Přijato", "count": status_counts.get("mutual_handshake", 0) + status_counts.get("completed", 0), "color": "#99d7b2"},
                ],
                "resonance": HandshakeDomainService._resonance_from_evaluations(evaluations),
                "composition": HandshakeDomainService._composition_from_roles(roles),
                "radar_metrics": HandshakeDomainService._radar_metrics(evaluations),
                "tip": "Dashboard zatím počítá jen z V2 handshaků. Jakmile kandidáti projdou sandboxem, doporučení se zpřesní podle jejich výstupů.",
            }

    @staticmethod
    def _handshake_to_dict(handshake: Handshake) -> Dict[str, Any]:
        return {
            "id": str(handshake.id),
            "userId": str(handshake.user_id),
            "jobId": handshake.job_id,
            "opportunityId": str(handshake.opportunity_id) if handshake.opportunity_id else None,
            "companyId": str(handshake.company_id) if handshake.company_id else None,
            "legacyApplicationId": handshake.legacy_application_id,
            "candidateShareId": str(handshake.candidate_share_id) if handshake.candidate_share_id else None,
            "status": handshake.status,
            "currentStep": handshake.current_step,
            "matchScoreSnapshot": handshake.match_score_snapshot,
            "stateVersion": handshake.state_version,
            "createdAt": handshake.created_at.isoformat(),
            "updatedAt": handshake.updated_at.isoformat(),
            "closedAt": handshake.closed_at.isoformat() if handshake.closed_at else None,
        }

    @staticmethod
    async def _load_user_handshake(session: AsyncSession, user_id: str, handshake_id: str) -> Optional[Handshake]:
        result = await session.execute(
            select(Handshake).where(
                Handshake.id == uuid.UUID(handshake_id),
                Handshake.user_id == uuid.UUID(user_id),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _ensure_sandbox(session: AsyncSession, handshake: Handshake) -> SandboxSession:
        result = await session.execute(
            select(SandboxSession)
            .where(SandboxSession.handshake_id == handshake.id)
            .order_by(SandboxSession.created_at.desc())
        )
        sandbox = result.scalars().first()
        if sandbox:
            return sandbox
        job = await RealityDomainService.get_job_details(handshake.job_id) or {}
        candidate_context = await HandshakeDomainService._candidate_context(session, str(handshake.user_id))
        sandbox = SandboxSession(
            handshake_id=handshake.id,
            opportunity_id=handshake.opportunity_id,
            status="in_progress",
            assignment_payload=HandshakeDomainService._build_assignment_payload(job, candidate_context),
            submission_payload={"schema_version": "handshake-submission-v1", "status": "in_progress", "answers": {}, "stages": [], "attachments": []},
        )
        session.add(sandbox)
        await session.flush()
        return sandbox

    @staticmethod
    async def _reserve_slots(
        session: AsyncSession,
        user_id: uuid.UUID,
        company_id: uuid.UUID,
        opportunity_id: uuid.UUID,
        handshake_id: uuid.UUID,
        job: Dict[str, Any],
    ) -> None:
        capacity = _safe_dict(job.get("capacity_policy"))
        payload = _safe_dict(job.get("payload_json"))
        if not capacity:
            capacity = _safe_dict(payload.get("capacity_policy"))
        candidate_limit = int(capacity.get("candidate_active_limit") or 5)
        company_limit = int(capacity.get("max_active_handshakes") or capacity.get("company_slots_total") or 25)

        candidate_count = await session.execute(
            select(SlotReservation).where(
                SlotReservation.scope == "candidate",
                SlotReservation.owner_id == user_id,
                SlotReservation.status == "reserved",
            )
        )
        if len(candidate_count.scalars().all()) >= candidate_limit:
            raise ValueError("Candidate has no available handshake slots.")

        company_count = await session.execute(
            select(SlotReservation).where(
                SlotReservation.scope == "company_challenge",
                SlotReservation.owner_id == company_id,
                SlotReservation.opportunity_id == opportunity_id,
                SlotReservation.status == "reserved",
            )
        )
        if len(company_count.scalars().all()) >= company_limit:
            raise ValueError("Company challenge has no available handshake slots.")

        session.add(SlotReservation(
            scope="candidate",
            owner_id=user_id,
            opportunity_id=opportunity_id,
            handshake_id=handshake_id,
            status="reserved",
            slot_metadata={"limit": candidate_limit},
        ))
        session.add(SlotReservation(
            scope="company_challenge",
            owner_id=company_id,
            opportunity_id=opportunity_id,
            handshake_id=handshake_id,
            status="reserved",
            slot_metadata={"limit": company_limit},
        ))
        session.add(HandshakeEvent(
            handshake_id=handshake_id,
            actor_user_id=user_id,
            actor_type="system",
            event_type="slots_reserved",
            payload={"candidate_limit": candidate_limit, "company_limit": company_limit},
        ))

    @staticmethod
    async def _mark_slots(session: AsyncSession, handshake_id: uuid.UUID, status: str) -> None:
        result = await session.execute(
            select(SlotReservation).where(
                SlotReservation.handshake_id == handshake_id,
                SlotReservation.status == "reserved",
            )
        )
        now = datetime.utcnow()
        for reservation in result.scalars().all():
            reservation.status = status
            if status == "consumed":
                reservation.consumed_at = now
            elif status in {"released", "expired"}:
                reservation.released_at = now

    @staticmethod
    async def _hydrate_handshake_response(session: AsyncSession, handshake: Handshake) -> Dict[str, Any]:
        return {
            "status": handshake.status,
            "handshake_id": str(handshake.id),
            "session": await HandshakeDomainService._session_payload(session, handshake),
            "application": HandshakeDomainService._handshake_to_dict(handshake),
        }

    @staticmethod
    async def _session_payload(session: AsyncSession, handshake: Handshake) -> Dict[str, Any]:
        sandbox = await HandshakeDomainService._ensure_sandbox(session, handshake)
        assignment = _safe_dict(sandbox.assignment_payload)
        submission = _safe_dict(sandbox.submission_payload)
        job_snapshot = _safe_dict(assignment.get("job_snapshot"))
        blueprint = _safe_dict(assignment.get("blueprint"))
        candidate_context = _safe_dict(assignment.get("candidate_context"))
        return {
            "schema_version": "handshake-session-v1",
            "id": str(handshake.id),
            "application_id": str(handshake.id),
            "candidate_id": str(handshake.user_id),
            "job_id": handshake.job_id,
            "company_id": str(handshake.company_id) if handshake.company_id else None,
            "status": submission.get("status") or ("submitted" if handshake.status in {"submitted", "company_reviewing"} else handshake.status),
            "started_at": handshake.created_at.isoformat(),
            "updated_at": handshake.updated_at.isoformat(),
            "finalized_at": submission.get("finalized_at"),
            "source": "v2_native_handshake",
            "job_snapshot": job_snapshot,
            "blueprint": blueprint,
            "candidate_context": candidate_context,
            "answers": _safe_dict(submission.get("answers")),
            "stages": _safe_list(submission.get("stages")),
            "attachments": _safe_list(submission.get("attachments")),
            "external_tools": _safe_list(assignment.get("external_tools")),
            "assessment_tasks": _safe_list(assignment.get("assessment_tasks")),
            "slot_reservations": await HandshakeDomainService._slot_snapshot(session, handshake.id),
            "external_runs": _safe_list(submission.get("external_runs")),
            "final_note": submission.get("final_note"),
            "sandbox": {
                "id": str(sandbox.id),
                "status": sandbox.status,
                "assignment_payload": assignment,
                "submission_payload": submission,
                "submitted_at": sandbox.submitted_at.isoformat() if sandbox.submitted_at else None,
            },
        }

    @staticmethod
    def _build_assignment_payload(job: Dict[str, Any], candidate_context: Dict[str, Any]) -> Dict[str, Any]:
        payload = _safe_dict(job.get("payload_json"))
        ai_analysis = _safe_dict(job.get("ai_analysis"))
        blueprint = _safe_dict(job.get("handshake_blueprint_v1")) or _safe_dict(payload.get("handshake_blueprint_v1")) or HandshakeDomainService._default_blueprint(job)
        assessment_tasks = _safe_list(job.get("assessment_tasks")) or _safe_list(payload.get("assessment_tasks"))
        jcfpm_context = _safe_dict(candidate_context.get("jcfpm"))
        jcfpm_completed = bool(jcfpm_context.get("completed"))
        if not jcfpm_completed:
            jcfpm_task = {
                "id": "jcfpm_profile",
                "type": "jcfpm_profile",
                "phase": "review",
                "title": "JCFPM pracovní profil",
                "prompt": "Dokončete krátký JCFPM profil. Výsledek se použije v assessment readoutu a nebude se opakovat, pokud jej už máte hotový.",
                "instructions": "JCFPM pomáhá firmě číst pracovní styl, hodnoty a způsob rozhodování vedle praktického úkolu.",
                "timebox_minutes": 8,
                "required": True,
                "reuse_existing": True,
            }
            if not any(_safe_dict(task).get("id") == "jcfpm_profile" for task in assessment_tasks):
                assessment_tasks = [*assessment_tasks, jcfpm_task]
            steps = _safe_list(blueprint.get("steps"))
            if steps and not any(_safe_dict(step).get("id") == "jcfpm_profile" for step in steps):
                review_index = next((index for index, step in enumerate(steps) if _safe_dict(step).get("type") == "results_summary"), len(steps))
                steps.insert(review_index, {
                    "id": "jcfpm_profile",
                    "type": "jcfpm_profile",
                    "title": "JCFPM",
                    "prompt": jcfpm_task["prompt"],
                    "required": True,
                    "phase": "review",
                })
                blueprint = {**blueprint, "steps": steps}
        blueprint = {
            **blueprint,
            "jcfpm_policy": {
                "include_in_results": True,
                "required_if_missing": True,
                "reuse_existing": True,
                "candidate_has_completed": jcfpm_completed,
            },
        }
        return {
            "schema_version": "handshake-assignment-v1",
            "blueprint": blueprint,
            "assessment_tasks": assessment_tasks,
            "candidate_context": candidate_context,
            "job_snapshot": {
                "id": job.get("id"),
                "title": _clean_text(job.get("title"), 220),
                "company": _clean_text(job.get("company_name") or job.get("company"), 220),
                "location": _clean_text(job.get("location"), 220),
                "description_excerpt": _clean_text(job.get("description") or ai_analysis.get("summary"), 1400),
                "source_kind": job.get("source_kind"),
            },
            "external_tools": [
                {
                    "id": "native_text",
                    "kind": "native_text",
                    "label": "Jobshaman structured answer",
                    "status": "available",
                },
                {
                    "id": "native_file",
                    "kind": "native_file",
                    "label": "Jobshaman file upload",
                    "status": "available",
                },
                {
                    "id": "external_link",
                    "kind": "external_link",
                    "label": "External tool link/embed",
                    "status": "available",
                    "providers": ["notion", "canva", "figma", "google_docs", "miro", "other"],
                },
            ],
        }

    @staticmethod
    async def _slot_snapshot(session: AsyncSession, handshake_id: uuid.UUID) -> List[Dict[str, Any]]:
        result = await session.execute(
            select(SlotReservation).where(SlotReservation.handshake_id == handshake_id)
        )
        return [
            {
                "id": str(item.id),
                "scope": item.scope,
                "owner_id": str(item.owner_id),
                "opportunity_id": str(item.opportunity_id) if item.opportunity_id else None,
                "status": item.status,
                "reserved_at": item.reserved_at.isoformat(),
                "consumed_at": item.consumed_at.isoformat() if item.consumed_at else None,
                "released_at": item.released_at.isoformat() if item.released_at else None,
                "metadata": _safe_dict(item.slot_metadata),
            }
            for item in result.scalars().all()
        ]

    @staticmethod
    def _default_blueprint(job: Dict[str, Any]) -> Dict[str, Any]:
        title = _clean_text(job.get("title"), 180) or "Role challenge"
        description = _clean_text(job.get("description") or job.get("summary"), 1600)
        return {
            "schema_version": "handshake-blueprint-v1",
            "id": f"v2-blueprint-{job.get('id') or 'native'}",
            "name": f"{title} handshake",
            "roleFamily": "operations",
            "role_family": "operations",
            "tone": "precision",
            "overview": "Praktický handshake nad reálným kontextem role.",
            "company_goal": _clean_text(job.get("role_summary") or description, 1000),
            "scenario": {
                "title": title,
                "context": description,
                "core_problem": _clean_text(job.get("challenge_format") or job.get("role_summary") or description, 1000),
                "failure_pattern": "Nejasné předpoklady, slabé zdůvodnění a málo konkrétní další krok.",
            },
            "deliverables": [
                "Popiš, jak chápeš situaci a co je podle tebe podstatné.",
                "Navrhni první konkrétní krok a důkaz, podle kterého poznáš, že funguje.",
                "Pojmenuj největší riziko nebo neznámou.",
            ],
            "constraints": ["Buď konkrétní.", "Pojmenuj předpoklady.", "Neopisuj CV."],
            "rubric": [
                {"id": "evidence", "label": "Práce s důkazy", "weight": 30},
                {"id": "judgment", "label": "Úsudek a priority", "weight": 30},
                {"id": "execution", "label": "Praktičnost řešení", "weight": 25},
                {"id": "communication", "label": "Srozumitelnost", "weight": 15},
            ],
            "steps": [
                {
                    "id": "problem_frame",
                    "type": "context",
                    "title": "Porozumění situaci",
                    "prompt": "Jak rozumíš zadání a co je podle tebe nejdůležitější?",
                    "helper": "Drž se role, firmy a konkrétního problému.",
                    "required": True,
                    "uiVariant": "story_field",
                },
                {
                    "id": "first_step",
                    "type": "work_sample",
                    "title": "První krok",
                    "prompt": "Jaký první krok bys udělal/a a proč?",
                    "helper": "Přidej důkaz, metodu nebo rozhodovací kritérium.",
                    "required": True,
                    "uiVariant": "workspace",
                },
                {
                    "id": "risk_and_unknowns",
                    "type": "reflection",
                    "title": "Rizika a neznámé",
                    "prompt": "Co by se mohlo pokazit a co bys potřeboval/a ověřit?",
                    "helper": "Dobrá odpověď umí říct i co ještě neví.",
                    "required": True,
                    "uiVariant": "signal_matrix",
                },
            ],
            "scheduleEnabled": True,
            "updated_at": datetime.utcnow().isoformat(),
        }

    @staticmethod
    async def _candidate_context(session: AsyncSession, user_id: str) -> Dict[str, Any]:
        uid = uuid.UUID(user_id)
        user_result = await session.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        profile_result = await session.execute(select(CandidateProfile).where(CandidateProfile.user_id == uid))
        profile = profile_result.scalar_one_or_none()
        jcfpm_result = await session.execute(
            select(CandidateJcfpmSnapshot)
            .where(CandidateJcfpmSnapshot.user_id == uid)
            .order_by(CandidateJcfpmSnapshot.created_at.desc())
            .limit(1)
        )
        jcfpm = jcfpm_result.scalar_one_or_none()
        preferences = _loads(profile.preferences if profile else None, {})
        legacy_jcfpm = _safe_dict(preferences.get("jcfpm_v1"))
        dimension_scores = _loads(jcfpm.dimension_scores if jcfpm else None, legacy_jcfpm.get("dimension_scores") or [])
        archetype = _loads(jcfpm.archetype if jcfpm else None, legacy_jcfpm.get("archetype") or {})
        return {
            "id": user_id,
            "name": _clean_text(profile.full_name if profile else user.email if user else "", 180),
            "email": _clean_text(user.email if user else "", 240),
            "location": _clean_text(profile.location if profile else "", 180),
            "skills": _loads(profile.skills if profile else None, []),
            "jcfpm": {
                "completed": bool(dimension_scores),
                "dimension_scores": dimension_scores,
                "archetype": archetype,
                "confidence": jcfpm.confidence if jcfpm else legacy_jcfpm.get("confidence"),
            },
        }

    @staticmethod
    async def _has_company_access(session: AsyncSession, user_id: str, company_id: str) -> bool:
        result = await session.execute(
            select(CompanyUser).where(
                CompanyUser.user_id == uuid.UUID(user_id),
                CompanyUser.company_id == uuid.UUID(company_id),
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def _company_roles(session: AsyncSession, company_id: str) -> List[Dict[str, Any]]:
        try:
            result = await session.execute(
                text(
                    """
                    SELECT id, title, company, company_id, status, is_active, role_summary, challenge_format, created_at
                    FROM jobs_nf
                    WHERE company_id = :company_id
                      AND COALESCE(is_active, true) = true
                      AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                    ORDER BY COALESCE(created_at, now()) DESC
                    LIMIT 80
                    """
                ),
                {"company_id": company_id},
            )
            return [dict(row._mapping) for row in result.fetchall()]
        except Exception:
            return []

    @staticmethod
    def _active_roles_from_data(roles: List[Dict[str, Any]], handshakes: List[Handshake]) -> List[Dict[str, Any]]:
        counts: Dict[str, int] = {}
        for item in handshakes:
            counts[item.job_id] = counts.get(item.job_id, 0) + 1
        return [
            {
                "id": str(role.get("id")),
                "title": role.get("challenge_format") or role.get("title") or "Výzva",
                "team": role.get("company") or "Tým",
                "candidates": counts.get(str(role.get("id")), 0),
                "status": "Handshake" if counts.get(str(role.get("id")), 0) else "Zadáno",
                "accent": ["#dceafe", "#fff0da", "#def7ea", "#f3e8ff", "#dbeafe"][index % 5],
            }
            for index, role in enumerate(roles[:6])
        ]

    @staticmethod
    async def _company_handshake_item(session: AsyncSession, handshake: Handshake) -> Dict[str, Any]:
        profile_result = await session.execute(select(CandidateProfile).where(CandidateProfile.user_id == handshake.user_id))
        profile = profile_result.scalar_one_or_none()
        session_payload = await HandshakeDomainService._session_payload(session, handshake)
        answers = _safe_dict(session_payload.get("answers"))
        score = min(98, max(52, 58 + len(answers) * 9 + int(handshake.match_score_snapshot or 0)))
        return {
            "id": str(handshake.id),
            "handshake_id": str(handshake.id),
            "candidate_id": str(handshake.user_id),
            "candidate_name": profile.full_name if profile and profile.full_name else f"Kandidát {str(handshake.user_id)[-4:]}",
            "candidateName": profile.full_name if profile and profile.full_name else f"Kandidát {str(handshake.user_id)[-4:]}",
            "headline": _clean_text(_safe_dict(session_payload.get("candidate_context")).get("job_title") or "Kandidát v handshake", 160),
            "job_id": handshake.job_id,
            "status": handshake.status,
            "score": score,
            "matchPercent": score,
            "updated_at": handshake.updated_at.isoformat(),
            "submitted_at": session_payload.get("finalized_at"),
        }

    @staticmethod
    async def _build_readout(session: AsyncSession, handshake: Handshake, session_payload: Dict[str, Any], reveal_identity: bool = False) -> Dict[str, Any]:
        profile_result = await session.execute(select(CandidateProfile).where(CandidateProfile.user_id == handshake.user_id))
        profile = profile_result.scalar_one_or_none()
        answers = _safe_dict(session_payload.get("answers"))
        evidence = []
        for step_id, entry in answers.items():
            data = _safe_dict(entry)
            answer = data.get("answer", entry)
            evidence.append({
                "id": step_id,
                "title": " ".join(part.capitalize() for part in str(step_id).replace("-", "_").split("_")),
                "body": _clean_text(answer, 1800),
                "source": "handshake_answer",
                "updated_at": data.get("updated_at"),
                "elapsed_ms": data.get("elapsed_ms"),
            })
        score = min(100, 55 + len(evidence) * 10)
        alias = f"Signal {str(handshake.user_id).replace('-', '')[-4:].upper()}"
        return {
            "schema_version": "recruiter-readout-v1",
            "handshake_id": str(handshake.id),
            "job_id": handshake.job_id,
            "company_id": str(handshake.company_id) if handshake.company_id else None,
            "anonymous_first": not reveal_identity,
            "identity": {
                "locked": not reveal_identity,
                "alias": alias,
                "name": profile.full_name if reveal_identity and profile else None,
                "email": None,
                "avatar_url": profile.avatar_url if reveal_identity and profile else None,
                "reveal_reason": "identity_revealed" if reveal_identity else "anonymous_first_readout",
            },
            "headline": f"{alias}: praktický výstup připravený k review",
            "summary": "Kandidát dokončil nativní Jobshaman handshake. Readout zvýrazňuje kvalitu úsudku, konkrétnost a práci s rizikem bez odhalení identity.",
            "scorecards": [
                {"key": "evidence", "label": "Práce s důkazy", "score": score},
                {"key": "judgment", "label": "Úsudek", "score": max(50, score - 4)},
                {"key": "execution", "label": "Praktičnost", "score": max(50, score - 8)},
            ],
            "strengths": ["Strukturovaná odpověď", "Viditelný rozhodovací postup"] if evidence else ["Handshake zahájen"],
            "risks": [] if evidence else ["Zatím chybí dokončené odpovědi"],
            "jcfpm_summary": _safe_dict(_safe_dict(session_payload.get("candidate_context")).get("jcfpm")),
            "evidence_sections": evidence,
            "recommended_next_step": "Projít výstup s hiring manažerem a rozhodnout, zda kandidáta posunout do mutual handshake.",
        }

    @staticmethod
    def _resonance_from_evaluations(evaluations: List[SandboxEvaluation]) -> List[Dict[str, Any]]:
        base = 70 + min(15, len(evaluations) * 2)
        return [
            {"id": "cognitive_style", "label": "Kognitivní styl", "value": min(94, base + 8)},
            {"id": "culture", "label": "Hodnoty a kultura", "value": min(92, base + 4)},
            {"id": "pace", "label": "Pracovní tempo", "value": min(90, base + 1)},
            {"id": "communication", "label": "Komunikační styl", "value": min(96, base + 10)},
            {"id": "motivation", "label": "Motivace", "value": min(91, base + 5)},
        ]

    @staticmethod
    def _composition_from_roles(roles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        total = max(1, len(roles))
        return [
            {"id": "visionaries", "label": "Vizionáři", "value": 28 if total else 0, "color": "#7da9f5"},
            {"id": "architects", "label": "Architekti", "value": 25, "color": "#88cfe0"},
            {"id": "realizers", "label": "Realizátoři", "value": 22, "color": "#9dd7b6"},
            {"id": "analysts", "label": "Analytici", "value": 15, "color": "#ffd88d"},
            {"id": "innovators", "label": "Inovátoři", "value": 10, "color": "#f0a0c2"},
        ]

    @staticmethod
    def _radar_metrics(evaluations: List[SandboxEvaluation]) -> List[Dict[str, Any]]:
        bump = min(10, len(evaluations))
        return [
            {"label": "Systémové myšlení", "teamValue": 72 + bump, "benchmarkValue": 86},
            {"label": "Technologická adaptabilita", "teamValue": 66 + bump, "benchmarkValue": 82},
            {"label": "Kognitivní flexe", "teamValue": 63 + bump, "benchmarkValue": 80},
            {"label": "Sociální inteligence", "teamValue": 70 + bump, "benchmarkValue": 79},
            {"label": "Strategické uvažování", "teamValue": 64 + bump, "benchmarkValue": 81},
            {"label": "Odolnost ve stresu", "teamValue": 61 + bump, "benchmarkValue": 76},
        ]

    @staticmethod
    def _event_to_dict(event: HandshakeEvent) -> Dict[str, Any]:
        return {
            "id": str(event.id),
            "handshakeId": str(event.handshake_id),
            "actorUserId": str(event.actor_user_id) if event.actor_user_id else None,
            "actorType": event.actor_type,
            "eventType": event.event_type,
            "fromStatus": event.from_status,
            "toStatus": event.to_status,
            "payload": event.payload,
            "createdAt": event.created_at.isoformat(),
        }
