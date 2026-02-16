from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

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


class WorkHistoryItem(BaseModel):
    role: str = ""
    company: str = ""
    duration: str = ""
    description: str = ""


class EducationItem(BaseModel):
    school: str = ""
    degree: str = ""
    year: str = ""


class ProfileUpdatesTyped(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    jobTitle: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    workHistory: List[WorkHistoryItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    cvText: Optional[str] = None


class AIProfileTyped(BaseModel):
    story: str = ""
    hobbies: List[str] = Field(default_factory=list)
    volunteering: List[str] = Field(default_factory=list)
    leadership: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    values: List[str] = Field(default_factory=list)
    inferred_skills: List[str] = Field(default_factory=list)
    awards: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    side_projects: List[str] = Field(default_factory=list)
    motivations: List[str] = Field(default_factory=list)
    work_preferences: List[str] = Field(default_factory=list)


class TokenUsage(BaseModel):
    input: int = 0
    output: int = 0


class AIGenerationMeta(BaseModel):
    prompt_version: str = "v1"
    model_used: str = ""
    fallback_used: bool = False
    latency_ms: int = 0
    token_usage: TokenUsage = Field(default_factory=TokenUsage)


class AIGuidedProfileResponseV2(BaseModel):
    profile_updates: ProfileUpdatesTyped
    ai_profile: AIProfileTyped
    cv_ai_text: str
    cv_summary: str
    meta: AIGenerationMeta
