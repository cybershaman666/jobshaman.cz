from typing import List, Optional

from pydantic import BaseModel, Field


class WorkHistoryItem(BaseModel):
    role: str = Field(default="", max_length=120)
    company: str = Field(default="", max_length=120)
    duration: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=1200)


class EducationItem(BaseModel):
    school: str = Field(default="", max_length=120)
    degree: str = Field(default="", max_length=120)
    year: str = Field(default="", max_length=40)


class ProfileUpdatesTyped(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=60)
    jobTitle: Optional[str] = Field(default=None, max_length=120)
    skills: List[str] = Field(default_factory=list, max_length=80)
    workHistory: List[WorkHistoryItem] = Field(default_factory=list, max_length=40)
    education: List[EducationItem] = Field(default_factory=list, max_length=40)
    cvText: Optional[str] = Field(default=None, max_length=300)


class AIProfileTyped(BaseModel):
    story: str = Field(default="", max_length=4000)
    hobbies: List[str] = Field(default_factory=list, max_length=80)
    volunteering: List[str] = Field(default_factory=list, max_length=80)
    leadership: List[str] = Field(default_factory=list, max_length=80)
    strengths: List[str] = Field(default_factory=list, max_length=80)
    values: List[str] = Field(default_factory=list, max_length=80)
    inferred_skills: List[str] = Field(default_factory=list, max_length=120)
    awards: List[str] = Field(default_factory=list, max_length=80)
    certifications: List[str] = Field(default_factory=list, max_length=80)
    side_projects: List[str] = Field(default_factory=list, max_length=80)
    motivations: List[str] = Field(default_factory=list, max_length=80)
    work_preferences: List[str] = Field(default_factory=list, max_length=80)


class TokenUsage(BaseModel):
    input: int = 0
    output: int = 0


class AIGenerationMeta(BaseModel):
    prompt_version: str = Field(default="v1", max_length=64)
    model_used: str = Field(default="", max_length=64)
    fallback_used: bool = False
    latency_ms: int = 0
    token_usage: TokenUsage = Field(default_factory=TokenUsage)


class AIGuidedProfileResponseV2(BaseModel):
    profile_updates: ProfileUpdatesTyped = Field(default_factory=ProfileUpdatesTyped)
    ai_profile: AIProfileTyped = Field(default_factory=AIProfileTyped)
    cv_ai_text: str = Field(default="", max_length=20000)
    cv_summary: str = Field(default="", max_length=300)
    meta: AIGenerationMeta = Field(default_factory=AIGenerationMeta)


class AIGuidedProfileAIResult(BaseModel):
    profile_updates: ProfileUpdatesTyped = Field(default_factory=ProfileUpdatesTyped)
    ai_profile: AIProfileTyped = Field(default_factory=AIProfileTyped)
    cv_ai_text: str = Field(default="", max_length=20000)
    cv_summary: str = Field(default="", max_length=300)
