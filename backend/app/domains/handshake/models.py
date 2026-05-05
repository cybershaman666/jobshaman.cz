from typing import Optional
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from datetime import datetime
from sqlalchemy import Column, JSON

class Handshake(SQLModel, table=True):
    __tablename__ = "handshakes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    job_id: str = Field(index=True)
    opportunity_id: Optional[UUID] = Field(default=None, foreign_key="opportunities.id", index=True)
    company_id: Optional[UUID] = Field(default=None, foreign_key="companies.id")
    legacy_application_id: Optional[str] = Field(default=None)
    candidate_share_id: Optional[UUID] = Field(default=None, foreign_key="candidate_company_shares.id")
    status: str = Field(default="initiated") # initiated, assessment, panel, offer, completed, rejected
    
    current_step: int = Field(default=1)
    match_score_snapshot: float = Field(default=0.0)
    state_version: int = Field(default=1)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None

class HandshakeEvent(SQLModel, table=True):
    __tablename__ = "handshake_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    handshake_id: UUID = Field(foreign_key="handshakes.id", index=True)
    actor_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    actor_type: str = Field(default="system")
    event_type: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class HandshakeMessage(SQLModel, table=True):
    __tablename__ = "handshake_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    handshake_id: UUID = Field(foreign_key="handshakes.id", index=True)
    sender_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    body: str
    attachments: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: Optional[datetime] = None

class SandboxSession(SQLModel, table=True):
    __tablename__ = "sandbox_sessions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    handshake_id: UUID = Field(foreign_key="handshakes.id", index=True)
    opportunity_id: Optional[UUID] = Field(default=None, foreign_key="opportunities.id")
    status: str = Field(default="created")
    assignment_payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    submission_payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None

class SandboxEvaluation(SQLModel, table=True):
    __tablename__ = "sandbox_evaluations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    sandbox_session_id: UUID = Field(foreign_key="sandbox_sessions.id", index=True)
    evaluator_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id")
    score: Optional[float] = None
    evaluation_payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SlotReservation(SQLModel, table=True):
    __tablename__ = "slot_reservations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    scope: str = Field(index=True)  # candidate, company_challenge
    owner_id: UUID = Field(index=True)
    opportunity_id: Optional[UUID] = Field(default=None, foreign_key="opportunities.id", index=True)
    handshake_id: Optional[UUID] = Field(default=None, foreign_key="handshakes.id", index=True)
    status: str = Field(default="reserved", index=True)  # reserved, consumed, released, expired
    reason: str = Field(default="handshake_initiated")
    reserved_at: datetime = Field(default_factory=datetime.utcnow)
    consumed_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    slot_metadata: dict = Field(default_factory=dict, sa_column=Column("metadata", JSON))
