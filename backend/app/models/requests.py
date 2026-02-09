import html
import bleach
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Any, Literal

class JobStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern=r"^(draft|active|paused|closed|archived)$")

class JobCheckRequest(BaseModel):
    id: Any = Field(...)
    title: str = Field(..., min_length=1, max_length=500)
    company: str = Field(..., min_length=1, max_length=500)
    location: Optional[str] = Field(None, max_length=500)
    description: str = Field(..., min_length=10, max_length=30000)
    country_code: Optional[str] = Field(None, max_length=5)
    needs_manual_review: bool = False

    @validator("title", "company")
    def sanitize_text(cls, v):
        if not v: raise ValueError("Empty field")
        return html.escape(bleach.clean(v.strip(), tags=[], attributes={}, strip=True))

    @validator("description")
    def validate_desc(cls, v):
        if not v or len(v.strip()) < 10: raise ValueError("Too short")
        allowed = ["p", "br", "strong", "em", "ul", "ol", "li"]
        return bleach.clean(v.strip(), tags=allowed, attributes={}, strip=True)

class CheckoutRequest(BaseModel):
    tier: str = Field(..., pattern=r"^(premium|basic|business|assessment|assessment_bundle|single_assessment|freelance_premium)$")
    userId: str = Field(..., min_length=1)
    successUrl: str = Field(..., pattern=r"^https?://.+")
    cancelUrl: str = Field(..., pattern=r"^https?://.+")

    @validator("successUrl", "cancelUrl")
    def validate_urls(cls, v):
        if not v.startswith(("http://localhost", "https://localhost", "https://jobshaman")):
            raise ValueError("Unauthorized domain")
        return v

class BillingVerificationRequest(BaseModel):
    feature: str
    endpoint: str

class AssessmentInvitationRequest(BaseModel):
    assessment_id: str
    candidate_email: str
    candidate_id: Optional[str] = None
    expires_in_days: int = 30
    metadata: Optional[dict] = None

class AssessmentResultRequest(BaseModel):
    invitation_id: str
    assessment_id: str
    role: str
    difficulty: str
    questions_total: int
    questions_correct: int
    score: float
    time_spent_seconds: int
    answers: dict
    feedback: Optional[str] = None

class JobInteractionRequest(BaseModel):
    job_id: int
    event_type: str = Field(..., pattern=r"^(impression|swipe_left|swipe_right|open_detail|apply_click|save|unsave)$")
    dwell_time_ms: Optional[int] = None
    session_id: Optional[str] = None
    metadata: Optional[dict] = None

class AdminSubscriptionUpdateRequest(BaseModel):
    subscription_id: Optional[str] = None
    target_type: Optional[Literal["company", "user"]] = None
    target_id: Optional[str] = None
    tier: Optional[str] = Field(None, pattern=r"^(free|premium|business|freelance_premium|trial|enterprise|assessment_bundle|single_assessment)$")
    status: Optional[str] = Field(None, pattern=r"^(active|trialing|inactive|canceled)$")
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    cancel_at_period_end: Optional[bool] = None
    set_trial_days: Optional[int] = Field(None, ge=1, le=365)
    set_trial_until: Optional[str] = None
