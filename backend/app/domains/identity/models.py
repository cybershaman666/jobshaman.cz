from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from sqlalchemy import Column, JSON

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    supabase_id: UUID = Field(unique=True, index=True)
    email: str = Field(unique=True)
    role: str = Field(default="candidate")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None

    profile: Optional["CandidateProfile"] = Relationship(back_populates="user")

class CandidateProfile(SQLModel, table=True):
    __tablename__ = "candidate_profiles_v2"

    user_id: UUID = Field(primary_key=True, foreign_key="users.id")
    full_name: Optional[str] = None
    location: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    skills: str = Field(default="[]") # JSON as string for simplicity with SQLModel
    preferences: str = Field(default="{}")
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional[User] = Relationship(back_populates="profile")

class CandidateIdentitySignal(SQLModel, table=True):
    __tablename__ = "candidate_identity_signals"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    signal_key: str = Field(index=True)
    signal_value: dict = Field(default_factory=dict, sa_column=Column(JSON))
    source_type: str
    confidence: float = Field(default=0.5)
    sensitivity_level: str = Field(default="medium")
    visibility_scope: str = Field(default="candidate_only")
    confirmation_status: str = Field(default="inferred")
    is_user_confirmed: bool = Field(default=False)
    is_active: bool = Field(default=True, index=True)
    interpreter_version: Optional[str] = None
    prompt_version: Optional[str] = None
    rule_version: Optional[str] = None
    input_hash: Optional[str] = None
    created_from: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = None

class CandidateCompanyShare(SQLModel, table=True):
    __tablename__ = "candidate_company_shares"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    opportunity_id: Optional[UUID] = Field(default=None, foreign_key="opportunities.id")
    share_version: int = Field(default=1)
    shared_layers: list = Field(default_factory=list, sa_column=Column(JSON))
    shared_fields: dict = Field(default_factory=dict, sa_column=Column(JSON))
    snapshot_payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    consent_status: str = Field(default="active", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = None

class SensitiveAccessLog(SQLModel, table=True):
    __tablename__ = "sensitive_access_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    actor_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)
    subject_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)
    company_id: Optional[UUID] = Field(default=None, foreign_key="companies.id", index=True)
    access_reason: str
    accessed_layer: str
    accessed_fields: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CandidateCVDocument(SQLModel, table=True):
    __tablename__ = "candidate_cv_documents"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    external_asset_id: Optional[UUID] = Field(default=None, foreign_key="media_assets.id")
    file_name: str
    original_name: str
    file_url: str
    file_size: int = 0
    content_type: str = "application/octet-stream"
    is_active: bool = Field(default=False, index=True)
    label: Optional[str] = None
    locale: Optional[str] = None
    parsed_data: str = Field(default="{}")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: Optional[datetime] = None
    parsed_at: Optional[datetime] = None

class CandidateJcfpmSnapshot(SQLModel, table=True):
    __tablename__ = "candidate_jcfpm_snapshots"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    schema_version: str = Field(default="jcfpm-v1")
    responses: str = Field(default="{}")
    item_ids: str = Field(default="[]")
    variant_seed: Optional[str] = None
    dimension_scores: str = Field(default="[]")
    percentile_summary: str = Field(default="{}")
    archetype: str = Field(default="{}")
    confidence: int = Field(default=0)
    snapshot_payload: str = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    title: str
    content: str
    type: str = Field(default="info") # match, handshake, system
    link: Optional[str] = None
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
