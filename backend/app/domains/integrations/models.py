from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class IntegrationApiKey(SQLModel, table=True):
    __tablename__ = "integration_api_keys"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    name: str
    token_prefix: str = Field(index=True)
    token_hash: str = Field(unique=True, index=True)
    scopes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_by: Optional[UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


class IntegrationWebhook(SQLModel, table=True):
    __tablename__ = "integration_webhooks"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    url: str
    secret: str
    events: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_active: bool = Field(default=True, index=True)
    created_by: Optional[UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None


class IntegrationEventDelivery(SQLModel, table=True):
    __tablename__ = "integration_event_deliveries"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    company_id: UUID = Field(foreign_key="companies.id", index=True)
    webhook_id: Optional[UUID] = Field(default=None, foreign_key="integration_webhooks.id", index=True)
    event_id: str = Field(unique=True, index=True)
    event_type: str = Field(index=True)
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = Field(default="pending", index=True)
    attempts: int = Field(default=0)
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    last_error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
