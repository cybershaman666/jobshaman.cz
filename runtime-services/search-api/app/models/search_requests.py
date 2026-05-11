from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal


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
    def normalize_radius(cls, value):
        if value is None:
            return None
        try:
            parsed = float(value)
        except Exception:
            return None
        if parsed <= 0:
            return None
        return parsed

    @validator("page_size", pre=True)
    def normalize_page_size(cls, value):
        if value is None:
            return 50
        try:
            parsed = int(value)
        except Exception:
            return 50
        return max(1, min(200, parsed))


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
    def normalize_radius(cls, value):
        if value is None:
            return None
        try:
            parsed = float(value)
        except Exception:
            return None
        if parsed <= 0:
            return None
        return parsed

    @validator("page_size", pre=True)
    def normalize_page_size(cls, value):
        if value is None:
            return 50
        try:
            parsed = int(value)
        except Exception:
            return 50
        return max(1, min(200, parsed))
