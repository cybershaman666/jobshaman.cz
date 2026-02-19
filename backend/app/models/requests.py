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

class JobAnalyzeRequest(BaseModel):
    description: str = Field(..., min_length=20, max_length=30000)
    job_id: Optional[str] = Field(default=None, max_length=64)
    title: Optional[str] = Field(default=None, max_length=500)
    language: Optional[str] = Field(default="cs", max_length=8)

class AIExecuteRequest(BaseModel):
    action: str = Field(..., min_length=1, max_length=64)
    params: Optional[dict] = None

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
    request_id: Optional[str] = None
    signal_value: Optional[float] = None
    scroll_depth: Optional[float] = Field(default=None, ge=0, le=100)
    scoring_version: Optional[str] = None
    model_version: Optional[str] = None
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


class AdminUserDigestUpdateRequest(BaseModel):
    daily_digest_enabled: Optional[bool] = None
    daily_digest_push_enabled: Optional[bool] = None
    daily_digest_time: Optional[str] = None
    daily_digest_timezone: Optional[str] = None


class PushSubscribeRequest(BaseModel):
    subscription: dict
    user_agent: Optional[str] = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class AIGuidedProfileStep(BaseModel):
    id: str
    text: str


class AIGuidedProfileRequest(BaseModel):
    steps: List[AIGuidedProfileStep]
    language: Optional[str] = "cs"
    existingProfile: Optional[dict] = None


class AIGuidedProfileRequestV2(BaseModel):
    steps: List[AIGuidedProfileStep] = Field(default_factory=list, max_length=6)
    language: Optional[str] = Field(default="cs", max_length=8)
    existingProfile: Optional[dict] = None
    prompt_version: Optional[str] = Field(default=None, max_length=64)

    @validator("steps")
    def validate_non_empty_steps(cls, steps):
        if len(steps) > 6:
            raise ValueError("At most 6 steps are allowed")
        valid_steps = [s for s in steps if (getattr(s, "text", "") or "").strip()]
        if not valid_steps:
            raise ValueError("At least one non-empty step is required")
        return steps


class HybridJobSearchRequest(BaseModel):
    search_term: str = Field(default="", max_length=200)
    page: int = Field(default=0, ge=0)
    page_size: int = Field(default=50, ge=1, le=1000)
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    radius_km: Optional[float] = Field(default=None, ge=0, le=300)
    filter_city: Optional[str] = Field(default=None, max_length=120)
    filter_contract_types: Optional[List[str]] = None
    filter_benefits: Optional[List[str]] = None
    filter_min_salary: Optional[int] = Field(default=None, ge=0)
    filter_date_posted: Optional[str] = Field(default="all", max_length=10)
    filter_experience_levels: Optional[List[str]] = None
    filter_country_codes: Optional[List[str]] = None
    exclude_country_codes: Optional[List[str]] = None
    filter_language_codes: Optional[List[str]] = None

    @validator("radius_km", pre=True)
    def normalize_radius(cls, v):
        if v is None:
            return None
        try:
            value = float(v)
        except Exception:
            return None
        if value <= 0:
            return None
        return value

    @validator("page_size", pre=True)
    def normalize_page_size(cls, v):
        if v is None:
            return 50
        try:
            value = int(v)
        except Exception:
            return 50
        return max(1, min(200, value))


class HybridJobSearchV2Request(BaseModel):
    search_term: str = Field(default="", max_length=200)
    page: int = Field(default=0, ge=0)
    page_size: int = Field(default=50, ge=1, le=1000)
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    radius_km: Optional[float] = Field(default=None, ge=0, le=300)
    filter_city: Optional[str] = Field(default=None, max_length=120)
    filter_contract_types: Optional[List[str]] = None
    filter_benefits: Optional[List[str]] = None
    filter_min_salary: Optional[int] = Field(default=None, ge=0)
    filter_date_posted: Optional[str] = Field(default="all", max_length=10)
    filter_experience_levels: Optional[List[str]] = None
    filter_country_codes: Optional[List[str]] = None
    exclude_country_codes: Optional[List[str]] = None
    filter_language_codes: Optional[List[str]] = None
    sort_mode: Literal["default", "newest", "jhi_desc", "jhi_asc", "recommended"] = "default"
    debug: bool = False

    @validator("radius_km", pre=True)
    def normalize_radius(cls, v):
        if v is None:
            return None
        try:
            value = float(v)
        except Exception:
            return None
        if value <= 0:
            return None
        return value

    @validator("page_size", pre=True)
    def normalize_page_size(cls, v):
        if v is None:
            return 50
        try:
            value = int(v)
        except Exception:
            return 50
        return max(1, min(200, value))
