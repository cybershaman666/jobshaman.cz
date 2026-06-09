from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class ShamanKarmaAccount(SQLModel, table=True):
    __tablename__ = "shaman_karma_accounts"
    __table_args__ = {"extend_existing": True}

    user_id: UUID = Field(primary_key=True, foreign_key="users.id")
    balance: int = Field(default=0)
    lifetime_earned: int = Field(default=0)
    lifetime_spent: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ShamanKarmaTransaction(SQLModel, table=True):
    __tablename__ = "shaman_karma_transactions"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    direction: str
    amount: int
    source_type: str
    source_id: Optional[str] = Field(default=None)
    reason: str
    transaction_metadata: dict = Field(default_factory=dict, sa_column=Column("metadata", JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CompanyReferral(SQLModel, table=True):
    __tablename__ = "company_referrals"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    company_name: str
    website_url: Optional[str] = None
    contact_email: Optional[str] = None
    note: Optional[str] = None
    status: str = Field(default="submitted", index=True)
    verification_note: Optional[str] = None
    verified_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class KarmaRedemption(SQLModel, table=True):
    __tablename__ = "karma_redemptions"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    reward_type: str
    karma_cost: int
    status: str = Field(default="pending", index=True)
    redemption_metadata: dict = Field(default_factory=dict, sa_column=Column("metadata", JSON))
    fulfilled_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
