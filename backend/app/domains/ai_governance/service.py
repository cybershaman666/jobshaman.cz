from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import engine
from app.domains.ai_governance.models import RecommendationLog
from typing import List, Optional, Dict, Any
import uuid
import json


def _stable_job_uuid(job_id: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"jobs_nf:{job_id}")

class AIGovernanceService:
    @staticmethod
    async def log_recommendation(user_id: str, job_id: str, score: float, signals: List[str], narrative: str):
        async with AsyncSession(engine) as session:
            log = RecommendationLog(
                user_id=uuid.UUID(user_id),
                job_id=_stable_job_uuid(job_id),
                match_score=score,
                signals=json.dumps(signals),
                narrative=narrative
            )
            session.add(log)
            await session.commit()
            return log.id

    @staticmethod
    async def get_explanation(user_id: str, job_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSession(engine) as session:
            statement = (
                select(RecommendationLog)
                .where(RecommendationLog.user_id == uuid.UUID(user_id))
                .where(RecommendationLog.job_id == _stable_job_uuid(job_id))
                .order_by(RecommendationLog.created_at.desc())
                .limit(1)
            )
            result = await session.execute(statement)
            log = result.scalar_one_or_none()
            return log.model_dump() if log else None
