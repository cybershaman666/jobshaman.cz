from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.core.database import engine
from app.domains.recommendation.models import PersonalizedWeights
from datetime import datetime

class LifecycleBackprop:
    # Learning rates for different events
    LR = {
        "jcfpm_init": 0.15,
        "initiated": 0.05,
        "assessment": 0.08,
        "passed": 0.10,
        "rejected": 0.15,
        "offer": 0.20,
        "user_dropped_out": 0.12,
    }

    @staticmethod
    async def get_user_weights(user_id: str) -> PersonalizedWeights:
        async with AsyncSession(engine) as session:
            stmt = select(PersonalizedWeights).where(PersonalizedWeights.user_id == UUID(user_id))
            result = await session.execute(stmt)
            weights = result.scalar_one_or_none()
            if not weights:
                # Fallback to defaults
                weights = PersonalizedWeights(user_id=UUID(user_id))
            return weights

    @staticmethod
    async def process_handshake_event(user_id: str, job_id: str, event_type: str, from_status: Optional[str], to_status: Optional[str]):
        """
        Adjusts personalized weights based on handshake progression.
        """
        async with AsyncSession(engine) as session:
            stmt = select(PersonalizedWeights).where(PersonalizedWeights.user_id == UUID(user_id))
            result = await session.execute(stmt)
            weights = result.scalar_one_or_none()
            
            if not weights:
                weights = PersonalizedWeights(user_id=UUID(user_id))
                session.add(weights)
            
            # Gradients based on transitions
            # H = alpha*S + beta*E + gamma*G + delta*V - lambda*R
            
            if to_status == "assessment":
                # User initiated and got to assessment -> slight positive for values/growth
                weights.delta_values += LifecycleBackprop.LR["initiated"] * 0.5
                weights.gamma_growth += LifecycleBackprop.LR["initiated"] * 0.3
            
            elif to_status == "passed" or to_status == "panel":
                # User passed assessment -> strong positive for skill match
                weights.alpha_skill += LifecycleBackprop.LR["passed"] * 1.0
                
            elif to_status == "rejected" and from_status == "assessment":
                # User failed assessment -> negative for skill match
                weights.alpha_skill -= LifecycleBackprop.LR["rejected"] * 1.0
                # We overestimated skills, increase reliance on growth/values instead
                weights.gamma_growth += LifecycleBackprop.LR["rejected"] * 0.5
                
            elif to_status == "offer":
                # Total success, validate all positive components
                weights.alpha_skill += LifecycleBackprop.LR["offer"] * 0.5
                weights.delta_values += LifecycleBackprop.LR["offer"] * 0.5
            
            elif to_status == "rejected" and event_type == "candidate_withdrew":
                # User dropped out -> negative for values/risk
                weights.delta_values -= LifecycleBackprop.LR["user_dropped_out"] * 0.8
                weights.lambda_risk += LifecycleBackprop.LR["user_dropped_out"] * 0.8

            # Ensure weights don't go negative or explode
            weights.alpha_skill = max(0.1, min(1.0, weights.alpha_skill))
            weights.beta_evidence = max(0.05, min(0.5, weights.beta_evidence))
            weights.gamma_growth = max(0.05, min(0.8, weights.gamma_growth))
            weights.delta_values = max(0.1, min(1.0, weights.delta_values))
            weights.lambda_risk = max(0.1, min(1.0, weights.lambda_risk))

            weights.updated_at = datetime.utcnow()
            weights.source_event = f"handshake_{to_status}"
            
            await session.commit()

    @staticmethod
    async def process_ritual_archetype(user_id: str, archetype: str):
        """
        Adjusts weights based on the narrative archetype extracted from the ritual.
        """
        async with AsyncSession(engine) as session:
            stmt = select(PersonalizedWeights).where(PersonalizedWeights.user_id == UUID(user_id))
            result = await session.execute(stmt)
            weights = result.scalar_one_or_none()
            
            if not weights:
                weights = PersonalizedWeights(user_id=UUID(user_id))
                session.add(weights)

            # Heuristic mapping for CyberShaman Ritual archetypes
            arch = archetype.upper()
            if "BUDOVATEL" in arch or "BUILDER" in arch:
                weights.alpha_skill = 0.45    # Values skills highly
                weights.gamma_growth = 0.22   # Moderate growth
                weights.delta_values = 0.20   # Lower value priority
            elif "PRUZKUMNIK" in arch or "EXPLORER" in arch:
                weights.gamma_growth = 0.35   # High growth focus
                weights.alpha_skill = 0.25    # Lower skill priority (wants to learn)
                weights.lambda_risk = 0.20    # Risk tolerant
            elif "STRAZCE" in arch or "GUARDIAN" in arch:
                weights.delta_values = 0.40   # Values alignment first
                weights.lambda_risk = 0.45    # Risk averse
                weights.gamma_growth = 0.10   # Low growth focus
            elif "VIZIONAR" in arch or "VISIONARY" in arch:
                weights.delta_values = 0.35   # Values/Meaning
                weights.gamma_growth = 0.30   # High growth/Future
                weights.alpha_skill = 0.25
                weights.beta_evidence = 0.10  # Less focused on proof, more on vision

            weights.updated_at = datetime.utcnow()
            weights.source_event = f"ritual_{archetype.lower()}"
            
            await session.commit()

    @staticmethod
    async def process_jcfpm_snapshot(user_id: str, archetype: str, dimension_scores: Dict[str, Any]):
        """
        Initializes or significantly adjusts weights based on psychometric profile.
        """
        async with AsyncSession(engine) as session:
            stmt = select(PersonalizedWeights).where(PersonalizedWeights.user_id == UUID(user_id))
            result = await session.execute(stmt)
            weights = result.scalar_one_or_none()
            
            if not weights:
                weights = PersonalizedWeights(user_id=UUID(user_id))
                session.add(weights)
                
            # Example heuristic mapping from archetype to weights
            archetype_lower = archetype.lower()
            if "explorer" in archetype_lower or "creator" in archetype_lower:
                weights.gamma_growth += 0.15
                weights.lambda_risk -= 0.10
            elif "guardian" in archetype_lower or "stabilizer" in archetype_lower:
                weights.lambda_risk += 0.15
                weights.gamma_growth -= 0.05
            
            # Normalize constraints
            weights.gamma_growth = max(0.05, min(0.8, weights.gamma_growth))
            weights.lambda_risk = max(0.1, min(1.0, weights.lambda_risk))

            weights.updated_at = datetime.utcnow()
            weights.source_event = "jcfpm_init"
            
            await session.commit()
