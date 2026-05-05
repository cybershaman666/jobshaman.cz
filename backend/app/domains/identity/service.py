from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.core.database import engine
from app.core.legacy_supabase import fetch_legacy_jcfpm_latest, fetch_legacy_user_profile, list_legacy_registered_candidates
from app.domains.identity.models import (
    CandidateCVDocument,
    CandidateCompanyShare,
    CandidateIdentitySignal,
    CandidateJcfpmSnapshot,
    CandidateProfile,
    SensitiveAccessLog,
    Notification,
    User,
)
from app.domains.reality.models import Company, CompanyUser
from typing import Optional, Dict, Any
import uuid
import json
import asyncio
from datetime import datetime
from app.domains.recommendation.learning import LifecycleBackprop
from app.services.mistral_client import call_mistral_json
from app.services.embedding_service import EmbeddingService


def _as_uuid(value: Any) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))

class IdentityDomainService:
    SIGNAL_SOURCE_TYPES = {
        "manual_admin",
        "user_statement",
        "user_confirmed_ai",
        "system_calculation",
        "jcfpm_result",
        "derived_rule",
        "behavior_signal",
        "imported_profile",
        "ai_interpretation",
        "company_statement",
        "legacy_migration",
        "admin_override",
    }

    SIGNAL_SENSITIVITY_LEVELS = {"low", "medium", "high", "restricted"}
    SIGNAL_VISIBILITY_SCOPES = {
        "candidate_only",
        "recommendation_internal",
        "candidate_explanation",
        "company_share",
        "admin_only",
    }
    SIGNAL_CONFIRMATION_STATUSES = {"inferred", "suggested", "confirmed", "rejected", "revoked"}
    SHARE_CONSENT_STATUSES = {"active", "revoked", "expired"}
    SHARE_LAYERS = {"profile", "cv", "jcfpm", "identity_signals", "preferences", "portfolio", "handshake"}

    @staticmethod
    async def get_or_create_user_mirror(supabase_id: str, email: str, role: str = "candidate") -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            supabase_uuid = uuid.UUID(str(supabase_id))
            statement = select(User).where(User.supabase_id == supabase_uuid)
            result = await session.execute(statement)
            user = result.scalar_one_or_none()
            
            if not user:
                user = User(supabase_id=supabase_uuid, email=email, role=role)
                session.add(user)
                try:
                    await session.flush()
                except IntegrityError:
                    await session.rollback()
                    result = await session.execute(statement)
                    user = result.scalar_one()

            profile_result = await session.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
            profile = profile_result.scalar_one_or_none()
            if not profile:
                profile = CandidateProfile(user_id=user.id)
                session.add(profile)
                try:
                    await session.flush()
                except IntegrityError:
                    await session.rollback()
                    profile_result = await session.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
                    profile = profile_result.scalar_one()

            if IdentityDomainService._profile_needs_legacy_backfill(profile):
                legacy = await asyncio.to_thread(fetch_legacy_user_profile, str(supabase_id))
                IdentityDomainService._apply_legacy_profile_to_mirror(user, profile, legacy, fallback_email=email)

            await session.commit()
            await session.refresh(user)
            return IdentityDomainService._user_to_dict(user)

    @staticmethod
    def _user_to_dict(user: User) -> Dict[str, Any]:
        return {
            "id": str(user.id),
            "supabase_id": str(user.supabase_id),
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        }

    @staticmethod
    async def get_candidate_profile(user_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = select(CandidateProfile).where(CandidateProfile.user_id == _as_uuid(user_id))
            result = await session.execute(statement)
            profile = result.scalar_one_or_none()
            if profile:
                await IdentityDomainService._ensure_legacy_jcfpm_preferences(session, profile)
            return profile.model_dump() if profile else None

    @staticmethod
    async def list_registered_candidates(
        limit: int = 250,
        exclude_user_id: Optional[str] = None,
        public_view: bool = True,
    ) -> list[Dict[str, Any]]:
        clamped_limit = max(1, min(int(limit or 250), 1000))
        async with AsyncSession(engine) as session:
            statement = (
                select(User, CandidateProfile)
                .join(CandidateProfile, CandidateProfile.user_id == User.id, isouter=True)
                .where(User.role.in_(["candidate", "authenticated"]))
                .limit(clamped_limit)
            )
            if exclude_user_id:
                statement = statement.where(User.id != _as_uuid(exclude_user_id))
            result = await session.execute(statement)
            candidates: list[Dict[str, Any]] = []
            for user, profile in result.all():
                profile = profile or CandidateProfile(user_id=user.id)
                try:
                    skills = json.loads(profile.skills or "[]")
                except json.JSONDecodeError:
                    skills = []
                try:
                    preferences = json.loads(profile.preferences or "{}")
                except json.JSONDecodeError:
                    preferences = {}
                legacy = preferences.get("v2_migration", {}).get("legacy_profile", {}) if isinstance(preferences, dict) else {}
                jcfpm = preferences.get("jcfpm_v1") if isinstance(preferences, dict) else None
                full_name = profile.full_name or user.email.split("@")[0]
                job_title = legacy.get("job_title") or preferences.get("targetRole") if isinstance(preferences, dict) else None
                values = legacy.get("values") if isinstance(legacy.get("values"), list) else []
                public_skills = skills if isinstance(skills, list) else []
                candidates.append({
                    "id": str(user.id),
                    "supabase_id": str(user.supabase_id),
                    "name": full_name,
                    "full_name": full_name,
                    "email": None if public_view else user.email,
                    "role": "candidate",
                    "job_title": job_title or "Uchazeč",
                    "title": job_title or "Uchazeč",
                    "avatar_url": profile.avatar_url,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "experienceYears": 0,
                    "salaryExpectation": 0,
                    "skills": public_skills,
                    "bio": "" if public_view else (profile.bio or ""),
                    "matchScore": 0,
                    "flightRisk": "Low",
                    "values": [] if public_view else values,
                    "location": "" if public_view else (profile.location or ""),
                    "hasJcfpm": bool(jcfpm),
                    "preferences": {} if public_view else (preferences if isinstance(preferences, dict) else {}),
                })

            # 2. Backfill from legacy Supabase if we have room
            exclude_supabase_id = None
            if exclude_user_id:
                current_user = await session.get(User, _as_uuid(exclude_user_id))
                if current_user:
                    exclude_supabase_id = str(current_user.supabase_id)

            legacy_data = await asyncio.to_thread(list_legacy_registered_candidates, limit=clamped_limit)
            local_supabase_ids = {c["supabase_id"] for c in candidates if c.get("supabase_id")}

            for leg in legacy_data:
                sid = leg["supabase_id"]
                if sid in local_supabase_ids or sid == exclude_supabase_id:
                    continue
                if len(candidates) >= clamped_limit:
                    break

                leg_prof = leg.get("profile") or {}
                leg_cand = leg.get("candidate") or {}
                
                full_name = leg_prof.get("full_name") or leg_prof.get("name") or leg_cand.get("full_name") or "Legacy Candidate"
                job_title = leg_cand.get("job_title") or "Uchazeč"
                avatar_url = leg_prof.get("avatar_url") or leg_cand.get("avatar_url")
                location = leg_cand.get("address") or leg_cand.get("location") or ""
                
                candidates.append({
                    "id": f"legacy-{sid}",
                    "supabase_id": sid,
                    "name": full_name,
                    "full_name": full_name,
                    "email": None if public_view else leg_prof.get("email"),
                    "role": "candidate",
                    "job_title": job_title,
                    "title": job_title,
                    "avatar_url": avatar_url,
                    "created_at": leg_prof.get("created_at"),
                    "experienceYears": 0,
                    "salaryExpectation": 0,
                    "skills": leg_cand.get("skills") if isinstance(leg_cand.get("skills"), list) else [],
                    "bio": "" if public_view else (leg_cand.get("story") or leg_cand.get("bio") or ""),
                    "matchScore": 0,
                    "flightRisk": "Low",
                    "values": [] if public_view else (leg_cand.get("values") if isinstance(leg_cand.get("values"), list) else []),
                    "location": "" if public_view else location,
                    "hasJcfpm": False, # We'd need another query for this, skip for listing
                    "preferences": {},
                    "source": "legacy_supabase",
                })

            return candidates

    @staticmethod
    async def _ensure_legacy_jcfpm_preferences(session: AsyncSession, profile: CandidateProfile) -> None:
        try:
            preferences = json.loads(profile.preferences or "{}")
        except json.JSONDecodeError:
            preferences = {}
        if not isinstance(preferences, dict) or preferences.get("jcfpm_v1"):
            return

        user = await session.get(User, profile.user_id)
        if not user or not user.supabase_id:
            return

        legacy_jcfpm = await asyncio.to_thread(fetch_legacy_jcfpm_latest, str(user.supabase_id))
        if not legacy_jcfpm:
            return

        preferences["jcfpm_v1"] = legacy_jcfpm
        if not isinstance(preferences.get("v2_migration"), dict):
            preferences["v2_migration"] = {}
        preferences["v2_migration"].setdefault("legacy_jcfpm", {
            "source": "supabase.jcfpm_results",
            "backfilled_at": datetime.utcnow().isoformat(),
        })
        profile.preferences = json.dumps(preferences, ensure_ascii=False)
        profile.updated_at = datetime.utcnow()
        await session.commit()

    @staticmethod
    def _profile_needs_legacy_backfill(profile: CandidateProfile) -> bool:
        try:
            preferences = json.loads(profile.preferences or "{}")
        except json.JSONDecodeError:
            preferences = {}
        try:
            skills = json.loads(profile.skills or "[]")
        except json.JSONDecodeError:
            skills = []
        if isinstance(preferences, dict) and preferences.get("v2_migration"):
            return False
        return not profile.bio or (not preferences and not skills)

    @staticmethod
    def _apply_legacy_profile_to_mirror(
        user: User,
        profile: CandidateProfile,
        legacy: Dict[str, Any],
        fallback_email: Optional[str] = None,
    ) -> bool:
        legacy_profile = legacy.get("profile") if isinstance(legacy.get("profile"), dict) else {}
        legacy_candidate = legacy.get("candidate") if isinstance(legacy.get("candidate"), dict) else {}
        if not legacy_profile and not legacy_candidate:
            return False

        full_name = (
            legacy_profile.get("full_name")
            or legacy_profile.get("name")
            or legacy_candidate.get("full_name")
            or legacy_candidate.get("name")
        )
        email = legacy_profile.get("email") or fallback_email
        role = legacy_profile.get("role")
        avatar_url = legacy_profile.get("avatar_url") or legacy_candidate.get("avatar_url")
        location = (
            legacy_candidate.get("address")
            or legacy_candidate.get("location")
            or legacy_profile.get("address")
            or legacy_profile.get("location")
        )
        story = legacy_candidate.get("story") or legacy_candidate.get("bio") or legacy_profile.get("bio")
        skills = legacy_candidate.get("skills") if isinstance(legacy_candidate.get("skills"), list) else []
        preferences = legacy_candidate.get("preferences") if isinstance(legacy_candidate.get("preferences"), dict) else {}

        if legacy_profile.get("preferred_country_code"):
            preferences.setdefault("preferredCountryCode", legacy_profile.get("preferred_country_code"))
        if legacy_candidate.get("tax_profile"):
            preferences.setdefault("taxProfile", legacy_candidate.get("tax_profile"))
        if legacy_candidate.get("jhi_preferences"):
            preferences.setdefault("jhiPreferences", legacy_candidate.get("jhi_preferences"))
        legacy_jcfpm = legacy.get("jcfpm") if isinstance(legacy.get("jcfpm"), dict) else {}
        if legacy_jcfpm:
            preferences.setdefault("jcfpm_v1", legacy_jcfpm)

        legacy_payload = {
            "legacy_profile": {
                key: value
                for key, value in {
                    "job_title": legacy_candidate.get("job_title"),
                    "phone": legacy_candidate.get("phone"),
                    "transport_mode": legacy_candidate.get("transport_mode"),
                    "cv_text": legacy_candidate.get("cv_text"),
                    "cv_ai_text": legacy_candidate.get("cv_ai_text"),
                    "cv_url": legacy_candidate.get("cv_url"),
                    "work_history": legacy_candidate.get("work_history"),
                    "education": legacy_candidate.get("education"),
                    "strengths": legacy_candidate.get("strengths"),
                    "values": legacy_candidate.get("values"),
                    "motivations": legacy_candidate.get("motivations"),
                    "work_preferences": legacy_candidate.get("work_preferences"),
                    "inferred_skills": legacy_candidate.get("inferred_skills"),
                    "candidate_profile_id": legacy_candidate.get("id"),
                    "profile_id": legacy_profile.get("id"),
                }.items()
                if value not in (None, "", [], {})
            }
        }
        if legacy_payload["legacy_profile"]:
            preferences.setdefault("v2_migration", legacy_payload)
        if legacy_jcfpm:
            if not isinstance(preferences.get("v2_migration"), dict):
                preferences["v2_migration"] = {}
            preferences["v2_migration"].setdefault("legacy_jcfpm", {
                "source": "supabase.jcfpm_results",
                "backfilled_at": datetime.utcnow().isoformat(),
            })

        if full_name:
            profile.full_name = str(full_name)
        if location:
            profile.location = str(location)
        if story:
            profile.bio = str(story)
        if avatar_url:
            profile.avatar_url = str(avatar_url)
        if skills:
            profile.skills = json.dumps(skills, ensure_ascii=False)
        if preferences:
            profile.preferences = json.dumps(preferences, ensure_ascii=False)
        if email and not user.email:
            user.email = str(email)
        if role in {"candidate", "recruiter", "admin"}:
            user.role = str(role)
        elif user.role == "authenticated":
            user.role = "candidate"
        profile.updated_at = datetime.utcnow()
        return True

    @staticmethod
    async def update_candidate_profile(user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            user_statement = select(User).where(User.id == _as_uuid(user_id))
            user_result = await session.execute(user_statement)
            user = user_result.scalar_one_or_none()
            if not user:
                raise ValueError("User mirror not found")

            profile_statement = select(CandidateProfile).where(CandidateProfile.user_id == user.id)
            profile_result = await session.execute(profile_statement)
            profile = profile_result.scalar_one_or_none()
            if not profile:
                profile = CandidateProfile(user_id=user.id)
                session.add(profile)

            if updates.get("role") in {"candidate", "recruiter", "admin"}:
                user.role = updates["role"]
            if "name" in updates or "full_name" in updates:
                profile.full_name = updates.get("name") or updates.get("full_name")
            if "address" in updates or "location" in updates:
                profile.location = updates.get("address") or updates.get("location")
            if "bio" in updates or "story" in updates:
                profile.bio = updates.get("bio") or updates.get("story")
            if "photo" in updates or "avatar_url" in updates:
                profile.avatar_url = updates.get("photo") or updates.get("avatar_url")
            try:
                preferences = json.loads(profile.preferences or "{}")
            except json.JSONDecodeError:
                preferences = {}
            if "preferences" in updates and isinstance(updates.get("preferences"), dict):
                preferences = {
                    **preferences,
                    **(updates.get("preferences") or {}),
                }
            if "taxProfile" in updates:
                preferences["taxProfile"] = updates.get("taxProfile")
                if isinstance(updates.get("taxProfile"), dict) and updates["taxProfile"].get("countryCode"):
                    preferences["preferredCountryCode"] = updates["taxProfile"].get("countryCode")
            if "jhiPreferences" in updates:
                preferences["jhiPreferences"] = updates.get("jhiPreferences")
            if "coordinates" in updates:
                preferences["coordinates"] = updates.get("coordinates")
            if "transportMode" in updates:
                preferences["transportMode"] = updates.get("transportMode")
            if "preferredCountryCode" in updates:
                preferences["preferredCountryCode"] = updates.get("preferredCountryCode")
            if isinstance(updates.get("authConsent"), dict):
                existing_consent = preferences.get("authConsent") if isinstance(preferences.get("authConsent"), dict) else {}
                preferences["authConsent"] = {
                    **existing_consent,
                    **updates.get("authConsent"),
                }
            profile.preferences = json.dumps(preferences, ensure_ascii=False)

            await session.commit()
            await session.refresh(profile)
            await session.refresh(user)

            return {
                "user": user.model_dump(),
                "profile": profile.model_dump(),
            }

    @staticmethod
    async def list_identity_signals(user_id: str, include_inactive: bool = False) -> list[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = select(CandidateIdentitySignal).where(CandidateIdentitySignal.user_id == _as_uuid(user_id))
            if not include_inactive:
                statement = statement.where(CandidateIdentitySignal.is_active == True)
            statement = statement.order_by(CandidateIdentitySignal.created_at.desc())
            result = await session.execute(statement)
            return [IdentityDomainService._signal_to_dict(signal) for signal in result.scalars().all()]

    @staticmethod
    async def create_identity_signal(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        signal_key = str(payload.get("signal_key") or payload.get("signalKey") or "").strip()
        if not signal_key:
            raise ValueError("signal_key is required")

        source_type = str(payload.get("source_type") or payload.get("sourceType") or "user_statement")
        sensitivity_level = str(payload.get("sensitivity_level") or payload.get("sensitivityLevel") or "medium")
        visibility_scope = str(payload.get("visibility_scope") or payload.get("visibilityScope") or "candidate_only")
        confirmation_status = str(payload.get("confirmation_status") or payload.get("confirmationStatus") or "inferred")
        confidence = float(payload.get("confidence") if payload.get("confidence") is not None else 0.5)

        if source_type not in IdentityDomainService.SIGNAL_SOURCE_TYPES:
            raise ValueError("Invalid source_type")
        if sensitivity_level not in IdentityDomainService.SIGNAL_SENSITIVITY_LEVELS:
            raise ValueError("Invalid sensitivity_level")
        if visibility_scope not in IdentityDomainService.SIGNAL_VISIBILITY_SCOPES:
            raise ValueError("Invalid visibility_scope")
        if confirmation_status not in IdentityDomainService.SIGNAL_CONFIRMATION_STATUSES:
            raise ValueError("Invalid confirmation_status")
        if confidence < 0 or confidence > 1:
            raise ValueError("confidence must be between 0 and 1")

        raw_value = payload.get("signal_value") if "signal_value" in payload else payload.get("signalValue")
        signal_value = raw_value if isinstance(raw_value, dict) else {"value": raw_value}

        async with AsyncSession(engine) as session:
            signal = CandidateIdentitySignal(
                user_id=_as_uuid(user_id),
                signal_key=signal_key,
                signal_value=signal_value,
                source_type=source_type,
                confidence=confidence,
                sensitivity_level=sensitivity_level,
                visibility_scope=visibility_scope,
                confirmation_status=confirmation_status,
                is_user_confirmed=bool(payload.get("is_user_confirmed") or payload.get("isUserConfirmed")),
                interpreter_version=payload.get("interpreter_version") or payload.get("interpreterVersion"),
                prompt_version=payload.get("prompt_version") or payload.get("promptVersion"),
                rule_version=payload.get("rule_version") or payload.get("ruleVersion"),
                input_hash=payload.get("input_hash") or payload.get("inputHash"),
                created_from=payload.get("created_from") or payload.get("createdFrom"),
            )
            session.add(signal)
            await session.commit()
            await session.refresh(signal)
            return IdentityDomainService._signal_to_dict(signal)

    @staticmethod
    def _signal_to_dict(signal: CandidateIdentitySignal) -> Dict[str, Any]:
        return {
            "id": str(signal.id),
            "userId": str(signal.user_id),
            "signalKey": signal.signal_key,
            "signalValue": signal.signal_value,
            "sourceType": signal.source_type,
            "confidence": signal.confidence,
            "sensitivityLevel": signal.sensitivity_level,
            "visibilityScope": signal.visibility_scope,
            "confirmationStatus": signal.confirmation_status,
            "isUserConfirmed": signal.is_user_confirmed,
            "isActive": signal.is_active,
            "interpreterVersion": signal.interpreter_version,
            "promptVersion": signal.prompt_version,
            "ruleVersion": signal.rule_version,
            "inputHash": signal.input_hash,
            "createdFrom": signal.created_from,
            "createdAt": signal.created_at.isoformat(),
            "updatedAt": signal.updated_at.isoformat(),
            "revokedAt": signal.revoked_at.isoformat() if signal.revoked_at else None,
        }

    @staticmethod
    async def create_candidate_company_share(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        company_id = str(payload.get("company_id") or payload.get("companyId") or "").strip()
        if not company_id:
            raise ValueError("company_id is required")

        shared_layers = payload.get("shared_layers") if "shared_layers" in payload else payload.get("sharedLayers")
        if not isinstance(shared_layers, list) or not shared_layers:
            raise ValueError("shared_layers must be a non-empty list")
        normalized_layers = [str(layer).strip() for layer in shared_layers if str(layer).strip()]
        invalid_layers = [layer for layer in normalized_layers if layer not in IdentityDomainService.SHARE_LAYERS]
        if invalid_layers:
            raise ValueError(f"Invalid shared layer: {invalid_layers[0]}")

        shared_fields = payload.get("shared_fields") if "shared_fields" in payload else payload.get("sharedFields")
        if shared_fields is None:
            shared_fields = {}
        if not isinstance(shared_fields, dict):
            raise ValueError("shared_fields must be an object")

        opportunity_id = payload.get("opportunity_id") or payload.get("opportunityId")
        snapshot_payload = payload.get("snapshot_payload") if "snapshot_payload" in payload else payload.get("snapshotPayload")

        async with AsyncSession(engine) as session:
            company_result = await session.execute(select(Company).where(Company.id == _as_uuid(company_id)))
            company = company_result.scalar_one_or_none()
            if not company:
                raise ValueError("Company not found")

            if not isinstance(snapshot_payload, dict):
                snapshot_payload = await IdentityDomainService._build_share_snapshot(
                    session,
                    user_id=_as_uuid(user_id),
                    shared_layers=normalized_layers,
                    shared_fields=shared_fields,
                )

            share = CandidateCompanyShare(
                user_id=_as_uuid(user_id),
                company_id=company.id,
                opportunity_id=_as_uuid(opportunity_id) if opportunity_id else None,
                shared_layers=normalized_layers,
                shared_fields=shared_fields,
                snapshot_payload=snapshot_payload,
                consent_status="active",
            )
            session.add(share)
            await session.commit()
            await session.refresh(share)
            return IdentityDomainService._share_to_dict(share, company_name=company.name)

    @staticmethod
    async def list_candidate_company_shares(user_id: str) -> list[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = (
                select(CandidateCompanyShare, Company.name)
                .join(Company, Company.id == CandidateCompanyShare.company_id)
                .where(CandidateCompanyShare.user_id == _as_uuid(user_id))
                .order_by(CandidateCompanyShare.created_at.desc())
            )
            result = await session.execute(statement)
            return [
                IdentityDomainService._share_to_dict(share, company_name=company_name)
                for share, company_name in result.all()
            ]

    @staticmethod
    async def revoke_candidate_company_share(user_id: str, share_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            result = await session.execute(
                select(CandidateCompanyShare).where(
                    CandidateCompanyShare.id == _as_uuid(share_id),
                    CandidateCompanyShare.user_id == _as_uuid(user_id),
                )
            )
            share = result.scalar_one_or_none()
            if not share:
                return None
            share.consent_status = "revoked"
            share.revoked_at = datetime.utcnow()
            await session.commit()
            await session.refresh(share)
            return IdentityDomainService._share_to_dict(share)

    @staticmethod
    async def list_company_candidate_shares(actor_user_id: str, company_id: str) -> Optional[list[Dict[str, Any]]]:
        async with AsyncSession(engine) as session:
            if not await IdentityDomainService._user_has_company_access(session, _as_uuid(actor_user_id), _as_uuid(company_id)):
                return None
            statement = (
                select(CandidateCompanyShare, User.email)
                .join(User, User.id == CandidateCompanyShare.user_id)
                .where(
                    CandidateCompanyShare.company_id == _as_uuid(company_id),
                    CandidateCompanyShare.consent_status == "active",
                )
                .order_by(CandidateCompanyShare.created_at.desc())
            )
            result = await session.execute(statement)
            return [
                IdentityDomainService._share_to_dict(share, candidate_email=email)
                for share, email in result.all()
            ]

    @staticmethod
    async def get_company_candidate_share(
        actor_user_id: str,
        company_id: str,
        share_id: str,
        access_reason: str = "company_share_view",
    ) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            company_uuid = _as_uuid(company_id)
            actor_uuid = _as_uuid(actor_user_id)
            if not await IdentityDomainService._user_has_company_access(session, actor_uuid, company_uuid):
                return None

            result = await session.execute(
                select(CandidateCompanyShare, User.email)
                .join(User, User.id == CandidateCompanyShare.user_id)
                .where(
                    CandidateCompanyShare.id == _as_uuid(share_id),
                    CandidateCompanyShare.company_id == company_uuid,
                    CandidateCompanyShare.consent_status == "active",
                )
            )
            row = result.one_or_none()
            if not row:
                return None
            share, email = row
            session.add(SensitiveAccessLog(
                actor_user_id=actor_uuid,
                subject_user_id=share.user_id,
                company_id=company_uuid,
                access_reason=access_reason,
                accessed_layer="candidate_company_share",
                accessed_fields=share.shared_layers,
            ))
            await session.commit()
            return IdentityDomainService._share_to_dict(share, candidate_email=email)

    @staticmethod
    async def _user_has_company_access(session: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID) -> bool:
        result = await session.execute(
            select(CompanyUser).where(
                CompanyUser.user_id == user_id,
                CompanyUser.company_id == company_id,
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def _build_share_snapshot(
        session: AsyncSession,
        user_id: uuid.UUID,
        shared_layers: list[str],
        shared_fields: Dict[str, Any],
    ) -> Dict[str, Any]:
        snapshot: Dict[str, Any] = {"layers": shared_layers}

        if "profile" in shared_layers:
            profile_result = await session.execute(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
            profile = profile_result.scalar_one_or_none()
            if profile:
                allowed_profile_fields = shared_fields.get("profile") if isinstance(shared_fields.get("profile"), list) else []
                profile_payload = {
                    "full_name": profile.full_name,
                    "location": profile.location,
                    "bio": profile.bio,
                    "avatar_url": profile.avatar_url,
                }
                snapshot["profile"] = (
                    {key: profile_payload.get(key) for key in allowed_profile_fields if key in profile_payload}
                    if allowed_profile_fields
                    else profile_payload
                )

        if "identity_signals" in shared_layers:
            signal_result = await session.execute(
                select(CandidateIdentitySignal).where(
                    CandidateIdentitySignal.user_id == user_id,
                    CandidateIdentitySignal.is_active == True,
                    CandidateIdentitySignal.visibility_scope == "company_share",
                )
            )
            snapshot["identity_signals"] = [
                IdentityDomainService._signal_to_dict(signal)
                for signal in signal_result.scalars().all()
                if signal.sensitivity_level != "restricted"
            ]

        return snapshot

    @staticmethod
    def _share_to_dict(
        share: CandidateCompanyShare,
        company_name: Optional[str] = None,
        candidate_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        data = {
            "id": str(share.id),
            "userId": str(share.user_id),
            "companyId": str(share.company_id),
            "opportunityId": str(share.opportunity_id) if share.opportunity_id else None,
            "shareVersion": share.share_version,
            "sharedLayers": share.shared_layers,
            "sharedFields": share.shared_fields,
            "snapshotPayload": share.snapshot_payload,
            "consentStatus": share.consent_status,
            "createdAt": share.created_at.isoformat(),
            "revokedAt": share.revoked_at.isoformat() if share.revoked_at else None,
        }
        if company_name is not None:
            data["companyName"] = company_name
        if candidate_email is not None:
            data["candidateEmail"] = candidate_email
        return data

    @staticmethod
    async def list_cv_documents(user_id: str) -> list[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = select(CandidateCVDocument).where(CandidateCVDocument.user_id == _as_uuid(user_id))
            result = await session.execute(statement)
            docs = result.scalars().all()
            return [IdentityDomainService._cv_to_dict(doc) for doc in docs]

    @staticmethod
    async def create_cv_document(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            should_activate = bool(payload.get("isActive") or payload.get("is_active"))
            if should_activate:
                existing_statement = select(CandidateCVDocument).where(CandidateCVDocument.user_id == _as_uuid(user_id))
                existing_result = await session.execute(existing_statement)
                for doc in existing_result.scalars().all():
                    doc.is_active = False

            doc = CandidateCVDocument(
                user_id=_as_uuid(user_id),
                external_asset_id=_as_uuid(payload["externalAssetId"]) if payload.get("externalAssetId") else None,
                file_name=payload.get("fileName") or payload.get("file_name") or "cv",
                original_name=payload.get("originalName") or payload.get("original_name") or payload.get("fileName") or "cv",
                file_url=payload.get("fileUrl") or payload.get("file_url") or "",
                file_size=int(payload.get("fileSize") or payload.get("file_size") or 0),
                content_type=payload.get("contentType") or payload.get("content_type") or "application/octet-stream",
                is_active=should_activate,
                label=payload.get("label"),
                locale=payload.get("locale"),
                parsed_data=json.dumps(payload.get("parsedData") or payload.get("parsed_data") or {}, ensure_ascii=False),
            )
            session.add(doc)
            await session.commit()
            await session.refresh(doc)
            return IdentityDomainService._cv_to_dict(doc)

    @staticmethod
    async def update_cv_document(user_id: str, cv_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = select(CandidateCVDocument).where(
                CandidateCVDocument.id == _as_uuid(cv_id),
                CandidateCVDocument.user_id == _as_uuid(user_id),
            )
            result = await session.execute(statement)
            doc = result.scalar_one_or_none()
            if not doc:
                return None

            if "isActive" in payload or "is_active" in payload:
                is_active = bool(payload.get("isActive") if "isActive" in payload else payload.get("is_active"))
                if is_active:
                    existing_statement = select(CandidateCVDocument).where(CandidateCVDocument.user_id == _as_uuid(user_id))
                    existing_result = await session.execute(existing_statement)
                    for existing_doc in existing_result.scalars().all():
                        existing_doc.is_active = False
                doc.is_active = is_active
            if "label" in payload:
                doc.label = payload.get("label")
            if "locale" in payload:
                doc.locale = payload.get("locale")
            if "externalAssetId" in payload:
                doc.external_asset_id = _as_uuid(payload["externalAssetId"]) if payload.get("externalAssetId") else None
            if "fileUrl" in payload or "file_url" in payload:
                doc.file_url = payload.get("fileUrl") or payload.get("file_url") or doc.file_url
            if "parsedData" in payload or "parsed_data" in payload:
                doc.parsed_data = json.dumps(payload.get("parsedData") or payload.get("parsed_data") or {}, ensure_ascii=False)
                from datetime import datetime
                doc.parsed_at = datetime.utcnow()

            await session.commit()
            await session.refresh(doc)
            return IdentityDomainService._cv_to_dict(doc)

    @staticmethod
    async def delete_cv_document(user_id: str, cv_id: str) -> bool:
        async with AsyncSession(engine) as session:
            statement = select(CandidateCVDocument).where(
                CandidateCVDocument.id == _as_uuid(cv_id),
                CandidateCVDocument.user_id == _as_uuid(user_id),
            )
            result = await session.execute(statement)
            doc = result.scalar_one_or_none()
            if not doc:
                return False
            await session.delete(doc)
            await session.commit()
            return True

    @staticmethod
    def _cv_to_dict(doc: CandidateCVDocument) -> Dict[str, Any]:
        try:
            parsed_data = json.loads(doc.parsed_data or "{}")
        except json.JSONDecodeError:
            parsed_data = {}
        return {
            "id": str(doc.id),
            "userId": str(doc.user_id),
            "externalAssetId": str(doc.external_asset_id) if doc.external_asset_id else None,
            "fileName": doc.file_name,
            "originalName": doc.original_name,
            "fileUrl": doc.file_url,
            "fileSize": doc.file_size,
            "contentType": doc.content_type,
            "isActive": doc.is_active,
            "label": doc.label,
            "locale": doc.locale,
            "parsedData": parsed_data,
            "uploadedAt": doc.uploaded_at.isoformat(),
            "lastUsed": doc.last_used.isoformat() if doc.last_used else None,
            "parsedAt": doc.parsed_at.isoformat() if doc.parsed_at else None,
        }

    @staticmethod
    async def create_jcfpm_snapshot(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            snapshot = CandidateJcfpmSnapshot(
                user_id=_as_uuid(user_id),
                schema_version=payload.get("schema_version") or "jcfpm-v1",
                responses=json.dumps(payload.get("responses") or {}, ensure_ascii=False),
                item_ids=json.dumps(payload.get("item_ids") or [], ensure_ascii=False),
                variant_seed=payload.get("variant_seed"),
                dimension_scores=json.dumps(payload.get("dimension_scores") or [], ensure_ascii=False),
                percentile_summary=json.dumps(payload.get("percentile_summary") or {}, ensure_ascii=False),
                archetype=json.dumps(payload.get("archetype") or {}, ensure_ascii=False),
                confidence=int(payload.get("confidence") or 0),
                snapshot_payload=json.dumps(payload, ensure_ascii=False),
            )
            session.add(snapshot)
            await session.commit()
            
            # Extract archetype data for learning loop
            archetype_data = payload.get("archetype") or {}
            archetype_name = archetype_data.get("name") or archetype_data.get("id") or "unknown"
            
            await LifecycleBackprop.process_jcfpm_snapshot(
                user_id=user_id,
                archetype=archetype_name,
                dimension_scores=payload.get("dimension_scores") or {}
            )
            
            await session.refresh(snapshot)
            return IdentityDomainService._jcfpm_to_dict(snapshot)

    @staticmethod
    async def get_latest_jcfpm_snapshot(user_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = (
                select(CandidateJcfpmSnapshot)
                .where(CandidateJcfpmSnapshot.user_id == _as_uuid(user_id))
                .order_by(CandidateJcfpmSnapshot.created_at.desc())
                .limit(1)
            )
            result = await session.execute(statement)
            snapshot = result.scalar_one_or_none()
            return IdentityDomainService._jcfpm_to_dict(snapshot) if snapshot else None

    @staticmethod
    def _jcfpm_to_dict(snapshot: CandidateJcfpmSnapshot) -> Dict[str, Any]:
        try:
            payload = json.loads(snapshot.snapshot_payload or "{}")
        except json.JSONDecodeError:
            payload = {}
        payload.setdefault("id", str(snapshot.id))
        payload.setdefault("created_at", snapshot.created_at.isoformat())
        return payload

    @staticmethod
    async def list_notifications(user_id: str, limit: int = 50) -> list[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = (
                select(Notification)
                .where(Notification.user_id == _as_uuid(user_id))
                .order_by(Notification.created_at.desc())
                .limit(limit)
            )
            result = await session.execute(statement)
            return [n.model_dump() for n in result.scalars().all()]

    @staticmethod
    async def create_notification(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        async with AsyncSession(engine) as session:
            notification = Notification(
                user_id=_as_uuid(user_id),
                title=payload["title"],
                content=payload["content"],
                type=payload.get("type", "info"),
                link=payload.get("link"),
            )
            session.add(notification)
            await session.commit()
            await session.refresh(notification)
            return notification.model_dump()

    @staticmethod
    async def mark_notification_read(user_id: str, notification_id: str) -> bool:
        async with AsyncSession(engine) as session:
            statement = select(Notification).where(
                Notification.id == _as_uuid(notification_id),
                Notification.user_id == _as_uuid(user_id),
            )
            result = await session.execute(statement)
            notification = result.scalar_one_or_none()
            if notification:
                notification.is_read = True
                await session.commit()
                return True
            return False

    @staticmethod
    async def mark_all_notifications_read(user_id: str) -> int:
        async with AsyncSession(engine) as session:
            from sqlalchemy import update
            statement = (
                update(Notification)
                .where(Notification.user_id == _as_uuid(user_id), Notification.is_read == False)
                .values(is_read=True)
            )
            result = await session.execute(statement)
            await session.commit()
            return result.rowcount

    @staticmethod
    async def process_ritual_completion(user_id: str, steps: list[dict[str, str]], language: str = "cs") -> dict[str, Any]:
        """
        Processes the CyberShaman ritual completion:
        1. AI interpretation of the narrative story
        2. Archetype extraction for weight tuning
        3. Profile update (bio/story)
        4. Identity Signal creation
        5. Embedding refresh
        """
        # --- 1. AI Interpretation ---
        answers_text = "\n\n".join([f"[{s['id']}] {s['text']}" for s in steps])
        prompt = f"""
Analyze these ritual answers from a job seeker and extract their professional identity profile.
Language: {language}

Return STRICT JSON with the following schema:
{{
  "bio": "A poetic but professional narrative summary (approx 200-300 chars) in {language}",
  "archetype": "One of: BUDOVATEL, PRUZKUMNIK, STRAZCE, VIZIONAR",
  "inferred_skills": ["List of extracted professional skills"],
  "values": ["List of core values identified"],
  "motivations": ["What drives this person"]
}}

Archetype Guidelines:
- BUDOVATEL (Builder): Focus on craftsmanship, creation, and precision. (e.g., Welder, Developer, Architect)
- PRUZKUMNIK (Explorer): Focus on learning, new experiences, and growth. (e.g., Junior roles, Researchers, Travelers)
- STRAZCE (Guardian): Focus on responsibility, safety, care, and reliability. (e.g., Bus Driver, Nurse, Accountant)
- VIZIONAR (Visionary): Focus on impact, future, and inspiring others. (e.g., Teacher, Leader, Designer)

Ritual Answers:
{answers_text}
        """

        try:
            ai_data, _ = call_mistral_json(prompt)
        except Exception as exc:
            raise ValueError(f"AI interpretation failed: {exc}")

        archetype = str(ai_data.get("archetype") or "BUDOVATEL").upper()
        if archetype not in ["BUDOVATEL", "PRUZKUMNIK", "STRAZCE", "VIZIONAR"]:
            archetype = "BUDOVATEL"

        # --- 2. Update Weights ---
        await LifecycleBackprop.process_ritual_archetype(user_id, archetype)

        # --- 3. Update Profile & Store Signals ---
        async with AsyncSession(engine) as session:
            profile_stmt = select(CandidateProfile).where(CandidateProfile.user_id == _as_uuid(user_id))
            profile_result = await session.execute(profile_stmt)
            profile = profile_result.scalar_one()
            
            profile.bio = ai_data.get("bio")
            
            # Store archetype as a signal
            await IdentityDomainService.create_identity_signal(user_id, {
                "signal_key": "ritual_archetype",
                "signal_value": {"archetype": archetype},
                "source_type": "ai_interpretation",
                "confidence": 0.9,
                "visibility_scope": "recommendation_internal"
            })
            
            # Store motivations as signals
            for motivation in ai_data.get("motivations") or []:
                await IdentityDomainService.create_identity_signal(user_id, {
                    "signal_key": "ritual_motivation",
                    "signal_value": {"value": motivation},
                    "source_type": "ai_interpretation",
                    "confidence": 0.7,
                    "visibility_scope": "candidate_explanation"
                })

            # Update preferences to mark onboarding as complete
            try:
                preferences = json.loads(profile.preferences or "{}")
            except:
                preferences = {}
            
            onboarding = preferences.get("candidate_onboarding_v2", {})
            onboarding["completed_at"] = datetime.utcnow().isoformat()
            onboarding["archetype"] = archetype
            preferences["candidate_onboarding_v2"] = onboarding
            profile.preferences = json.dumps(preferences, ensure_ascii=False)
            
            profile.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(profile)

        # --- 4. Refresh Embedding ---
        # Get signals to include them in the embedding
        signals = await IdentityDomainService.list_identity_signals(user_id)
        # In a real async environment, we might fire and forget this or use a background task
        # But for the ritual completion, we want it ready for the next marketplace load.
        await EmbeddingService.embed_candidate_profile(
            user_id=user_id,
            profile=profile.model_dump(),
            signals=signals,
            preferences=preferences
        )

        return {
            "status": "success",
            "archetype": archetype,
            "ai_profile": ai_data,
            "profile_updates": {
                "bio": profile.bio,
                "story": profile.bio,
                "preferences": preferences
            },
            "meta": {
                "model_used": "mistral-small-latest",
                "archetype": archetype
            }
        }
