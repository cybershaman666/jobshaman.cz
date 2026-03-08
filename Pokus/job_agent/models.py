from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Preferences(BaseModel):
    desired_titles: list[str] = Field(default_factory=list)
    required_keywords: list[str] = Field(default_factory=list)
    optional_keywords: list[str] = Field(default_factory=list)
    excluded_keywords: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    remote_only: bool = False
    min_salary: int | None = None
    contract_types: list[str] = Field(default_factory=list)
    language_codes: list[str] = Field(default_factory=list)
    min_match_score: float = 70.0
    seniority_preferences: list[str] = Field(default_factory=list)
    notes_for_cover_letter: list[str] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    raw_resume: str
    summary: str
    skills: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    desired_titles: list[str] = Field(default_factory=list)


class JobPosting(BaseModel):
    id: str
    source: Literal["jobshaman", "weworkremotely"]
    title: str
    company: str
    location: str | None = None
    remote: bool = False
    url: str | None = None
    apply_url: str | None = None
    description: str = ""
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    contract_type: str | None = None
    language_code: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MatchBreakdown(BaseModel):
    keyword_score: float = 0.0
    title_score: float = 0.0
    location_score: float = 0.0
    salary_score: float = 0.0
    remote_score: float = 0.0
    llm_score: float = 0.0
    penalties: float = 0.0


class JobRecommendation(BaseModel):
    job: JobPosting
    match_score: float
    breakdown: MatchBreakdown
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ApplicationDraft(BaseModel):
    job_id: str
    source: str
    company: str
    title: str
    match_score: float
    subject: str
    message: str
    apply_url: str | None = None


class ApplyResult(BaseModel):
    mode: Literal["dry_run", "submitted", "unsupported"]
    payload: dict[str, Any]
    response: dict[str, Any] | None = None
    notes: list[str] = Field(default_factory=list)

