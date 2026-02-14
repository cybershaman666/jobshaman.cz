from pydantic import BaseModel
from typing import List, Dict, Any

class JobCheckResponse(BaseModel):
    risk_score: float
    is_legal: bool
    reasons: List[str]
    needs_manual_review: bool


class AIGuidedProfileResponse(BaseModel):
    profileUpdates: Dict[str, Any]
    aiProfile: Dict[str, Any]
    cv_ai_text: str
    cv_summary: str
