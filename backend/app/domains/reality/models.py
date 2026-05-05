from typing import Optional, List
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from sqlalchemy import Column, JSON

class Company(SQLModel, table=True):
    __tablename__ = "companies"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    domain: Optional[str] = Field(unique=True, default=None)
    industry: Optional[str] = None
    tone: Optional[str] = None
    philosophy: Optional[str] = None
    address: Optional[str] = None
    legal_address: Optional[str] = None
    values_json: str = Field(default="[]")
    profile_data: str = Field(default="{}")
    logo_url: Optional[str] = None
    hero_image: Optional[str] = None
    narrative: Optional[str] = None
    website_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    jobs: List["Job"] = Relationship(back_populates="company")

class Job(SQLModel, table=True):
    __tablename__ = "opportunities"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id")
    title: str
    summary: Optional[str] = None
    description: Optional[str] = None
    salary_from: Optional[int] = None
    salary_to: Optional[int] = None
    currency: str = Field(default="CZK")
    work_model: str = Field(default="Hybrid")
    location: Optional[str] = None
    skills_required: str = Field(default="[]")
    is_active: bool = Field(default=True)
    status: str = Field(default="published", index=True)
    source_kind: str = Field(default="native_challenge")
    challenge_format: str = Field(default="standard")
    assessment_tasks: list = Field(default_factory=list, sa_column=Column(JSON))
    handshake_blueprint_v1: dict = Field(default_factory=dict, sa_column=Column(JSON))
    capacity_policy: dict = Field(default_factory=dict, sa_column=Column(JSON))
    editor_state: dict = Field(default_factory=dict, sa_column=Column(JSON))
    published_at: Optional[datetime] = None
    created_by: Optional[UUID] = Field(default=None, foreign_key="users.id")
    updated_by: Optional[UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    company: Optional[Company] = Relationship(back_populates="jobs")

class CompanyUser(SQLModel, table=True):
    __tablename__ = "company_users"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    role: str = Field(default="owner")
    created_at: datetime = Field(default_factory=datetime.utcnow)
