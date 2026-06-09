from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import async_session_factory
from app.domains.identity.models import CandidateProfile
from app.domains.karma.models import (
    CompanyReferral,
    KarmaRedemption,
    ShamanKarmaAccount,
    ShamanKarmaTransaction,
)


KARMA_AWARDS = {
    "company_referral_verified": 100,
    "handshake_completed": 20,
    "quality_profile": 10,
}

REWARD_CATALOG = {
    "candidate_slot": {"cost": 250, "label": "Candidate slot"},
    "profile_boost": {"cost": 150, "label": "Profile boost"},
    "profile_highlight": {"cost": 200, "label": "Profile highlight"},
    "premium_insight": {"cost": 120, "label": "Premium insight"},
    "early_feature_access": {"cost": 300, "label": "Early feature access"},
}


def _as_uuid(value: Any) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _clean(value: Any, limit: int = 500) -> str:
    return " ".join(str(value or "").strip().split())[:limit]


def _tx_to_dict(item: ShamanKarmaTransaction) -> Dict[str, Any]:
    return {
        "id": str(item.id),
        "direction": item.direction,
        "amount": item.amount,
        "sourceType": item.source_type,
        "sourceId": item.source_id,
        "reason": item.reason,
        "metadata": item.transaction_metadata or {},
        "createdAt": item.created_at.isoformat() if item.created_at else None,
    }


def _referral_to_dict(item: CompanyReferral) -> Dict[str, Any]:
    return {
        "id": str(item.id),
        "companyName": item.company_name,
        "websiteUrl": item.website_url,
        "contactEmail": item.contact_email,
        "note": item.note,
        "status": item.status,
        "verificationNote": item.verification_note,
        "verifiedAt": item.verified_at.isoformat() if item.verified_at else None,
        "convertedAt": item.converted_at.isoformat() if item.converted_at else None,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
    }


def _redemption_to_dict(item: KarmaRedemption) -> Dict[str, Any]:
    return {
        "id": str(item.id),
        "rewardType": item.reward_type,
        "karmaCost": item.karma_cost,
        "status": item.status,
        "metadata": item.redemption_metadata or {},
        "fulfilledAt": item.fulfilled_at.isoformat() if item.fulfilled_at else None,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
    }


class ShamanKarmaService:
    @staticmethod
    async def _ensure_account(session: AsyncSession, user_id: uuid.UUID) -> ShamanKarmaAccount:
        account = await session.get(ShamanKarmaAccount, user_id)
        if account:
            return account
        account = ShamanKarmaAccount(user_id=user_id)
        session.add(account)
        await session.flush()
        return account

    @staticmethod
    async def award_once(
        user_id: str,
        award_key: str,
        source_type: str,
        source_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        amount = KARMA_AWARDS.get(award_key)
        if not amount:
            raise ValueError("Unsupported Karma award.")
        uid = _as_uuid(user_id)
        async with async_session_factory() as session:
            existing = await session.execute(
                select(ShamanKarmaTransaction).where(
                    ShamanKarmaTransaction.user_id == uid,
                    ShamanKarmaTransaction.direction == "earn",
                    ShamanKarmaTransaction.source_type == source_type,
                    ShamanKarmaTransaction.source_id == str(source_id),
                )
            )
            if existing.scalar_one_or_none():
                return False

            account = await ShamanKarmaService._ensure_account(session, uid)
            account.balance += amount
            account.lifetime_earned += amount
            account.updated_at = datetime.utcnow()
            session.add(ShamanKarmaTransaction(
                user_id=uid,
                direction="earn",
                amount=amount,
                source_type=source_type,
                source_id=str(source_id),
                reason=award_key,
                transaction_metadata=metadata or {},
            ))
            await session.commit()
            return True

    @staticmethod
    async def maybe_award_quality_profile(user_id: str) -> bool:
        uid = _as_uuid(user_id)
        async with async_session_factory() as session:
            profile = await session.get(CandidateProfile, uid)
            if not profile:
                return False
            score = 0
            if _clean(profile.full_name, 120):
                score += 1
            if _clean(profile.location, 180):
                score += 1
            if len(_clean(profile.bio, 1000)) >= 80:
                score += 1
            try:
                import json
                skills = json.loads(profile.skills or "[]")
            except Exception:
                skills = []
            if isinstance(skills, list) and len([item for item in skills if _clean(item, 80)]) >= 3:
                score += 1
            if score < 4:
                return False
        return await ShamanKarmaService.award_once(
            user_id,
            "quality_profile",
            "quality_profile",
            user_id,
            {"profile_quality_score": score},
        )

    @staticmethod
    async def create_company_referral(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        company_name = _clean(payload.get("companyName") or payload.get("company_name"), 180)
        if len(company_name) < 2:
            raise ValueError("Company name is required.")
        uid = _as_uuid(user_id)
        async with async_session_factory() as session:
            referral = CompanyReferral(
                user_id=uid,
                company_name=company_name,
                website_url=_clean(payload.get("websiteUrl") or payload.get("website_url"), 300) or None,
                contact_email=_clean(payload.get("contactEmail") or payload.get("contact_email"), 180) or None,
                note=_clean(payload.get("note"), 1200) or None,
            )
            session.add(referral)
            await session.commit()
            await session.refresh(referral)
            return _referral_to_dict(referral)

    @staticmethod
    async def list_company_referrals(user_id: str) -> List[Dict[str, Any]]:
        uid = _as_uuid(user_id)
        async with async_session_factory() as session:
            result = await session.execute(
                select(CompanyReferral)
                .where(CompanyReferral.user_id == uid)
                .order_by(CompanyReferral.created_at.desc())
            )
            return [_referral_to_dict(item) for item in result.scalars().all()]

    @staticmethod
    async def verify_company_referral(referral_id: str, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
        async with async_session_factory() as session:
            referral = await session.get(CompanyReferral, _as_uuid(referral_id))
            if not referral:
                return None
            if referral.status == "submitted":
                referral.status = "verified"
                referral.verified_at = datetime.utcnow()
                referral.updated_at = datetime.utcnow()
                referral.verification_note = _clean(note, 1000) or None
                await session.commit()
                user_id = str(referral.user_id)
            else:
                user_id = str(referral.user_id)
        if user_id:
            await ShamanKarmaService.award_once(
                user_id,
                "company_referral_verified",
                "company_referral",
                referral_id,
                {"referral_id": referral_id},
            )
        async with async_session_factory() as session:
            refreshed = await session.get(CompanyReferral, _as_uuid(referral_id))
            return _referral_to_dict(refreshed) if refreshed else None

    @staticmethod
    async def redeem(user_id: str, reward_type: str) -> Dict[str, Any]:
        reward = REWARD_CATALOG.get(str(reward_type or ""))
        if not reward:
            raise ValueError("Unsupported Karma reward.")
        uid = _as_uuid(user_id)
        cost = int(reward["cost"])
        async with async_session_factory() as session:
            account = await ShamanKarmaService._ensure_account(session, uid)
            if account.balance < cost:
                raise ValueError("Not enough Shaman Karma.")
            now = datetime.utcnow()
            account.balance -= cost
            account.lifetime_spent += cost
            account.updated_at = now
            redemption = KarmaRedemption(
                user_id=uid,
                reward_type=str(reward_type),
                karma_cost=cost,
                status="fulfilled",
                fulfilled_at=now,
                redemption_metadata={"label": reward["label"]},
            )
            session.add(redemption)
            await session.flush()
            session.add(ShamanKarmaTransaction(
                user_id=uid,
                direction="spend",
                amount=cost,
                source_type="karma_redemption",
                source_id=str(redemption.id),
                reason=f"redeem_{reward_type}",
                transaction_metadata={"reward_type": reward_type},
            ))
            await session.commit()
            await session.refresh(redemption)
            return _redemption_to_dict(redemption)

    @staticmethod
    async def get_available_bonus_slots(user_id: str, session: Optional[AsyncSession] = None) -> int:
        uid = _as_uuid(user_id)

        async def _count(active_session: AsyncSession) -> int:
            result = await active_session.execute(
                select(KarmaRedemption).where(
                    KarmaRedemption.user_id == uid,
                    KarmaRedemption.reward_type == "candidate_slot",
                    KarmaRedemption.status == "fulfilled",
                )
            )
            count = 0
            for item in result.scalars().all():
                metadata = item.redemption_metadata or {}
                if not metadata.get("consumed_at"):
                    count += 1
            return count

        if session is not None:
            return await _count(session)
        async with async_session_factory() as owned_session:
            return await _count(owned_session)

    @staticmethod
    async def consume_bonus_slot(user_id: str, session: AsyncSession, handshake_id: uuid.UUID) -> Optional[str]:
        uid = _as_uuid(user_id)
        result = await session.execute(
            select(KarmaRedemption)
            .where(
                KarmaRedemption.user_id == uid,
                KarmaRedemption.reward_type == "candidate_slot",
                KarmaRedemption.status == "fulfilled",
            )
            .order_by(KarmaRedemption.created_at.asc())
        )
        for item in result.scalars().all():
            metadata = item.redemption_metadata or {}
            if metadata.get("consumed_at"):
                continue
            item.redemption_metadata = {
                **metadata,
                "consumed_at": datetime.utcnow().isoformat(),
                "handshake_id": str(handshake_id),
            }
            item.updated_at = datetime.utcnow()
            return str(item.id)
        return None

    @staticmethod
    async def release_bonus_slot(session: AsyncSession, redemption_id: str) -> None:
        if not redemption_id:
            return
        item = await session.get(KarmaRedemption, _as_uuid(redemption_id))
        if not item or item.reward_type != "candidate_slot":
            return
        metadata = dict(item.redemption_metadata or {})
        metadata.pop("consumed_at", None)
        metadata.pop("handshake_id", None)
        metadata["released_at"] = datetime.utcnow().isoformat()
        item.redemption_metadata = metadata
        item.updated_at = datetime.utcnow()

    @staticmethod
    async def get_account_summary(user_id: str) -> Dict[str, Any]:
        await ShamanKarmaService.maybe_award_quality_profile(user_id)
        uid = _as_uuid(user_id)
        async with async_session_factory() as session:
            account = await ShamanKarmaService._ensure_account(session, uid)
            tx_result = await session.execute(
                select(ShamanKarmaTransaction)
                .where(ShamanKarmaTransaction.user_id == uid)
                .order_by(ShamanKarmaTransaction.created_at.desc())
                .limit(12)
            )
            redemption_result = await session.execute(
                select(KarmaRedemption)
                .where(KarmaRedemption.user_id == uid)
                .order_by(KarmaRedemption.created_at.desc())
                .limit(20)
            )
            referrals = await ShamanKarmaService.list_company_referrals(str(uid))
            bonus_slots = await ShamanKarmaService.get_available_bonus_slots(str(uid), session)
            return {
                "balance": account.balance,
                "lifetimeEarned": account.lifetime_earned,
                "lifetimeSpent": account.lifetime_spent,
                "nextSlotCost": REWARD_CATALOG["candidate_slot"]["cost"],
                "bonusSlotsAvailable": bonus_slots,
                "catalog": [
                    {"rewardType": key, "cost": value["cost"], "label": value["label"]}
                    for key, value in REWARD_CATALOG.items()
                ],
                "transactions": [_tx_to_dict(item) for item in tx_result.scalars().all()],
                "redemptions": [_redemption_to_dict(item) for item in redemption_result.scalars().all()],
                "referrals": referrals,
            }
