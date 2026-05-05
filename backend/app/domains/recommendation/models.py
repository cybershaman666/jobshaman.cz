from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from datetime import datetime
from sqlalchemy import Column, JSON

class PersonalizedWeights(SQLModel, table=True):
    __tablename__ = "recommendation_personalized_weights"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True, unique=True)
    
    alpha_skill: float = Field(default=0.38)
    beta_evidence: float = Field(default=0.18)
    gamma_growth: float = Field(default=0.18)
    delta_values: float = Field(default=0.26)
    lambda_risk: float = Field(default=0.32)
    calibration: float = Field(default=8.0)
    
    source_event: str = Field(default="system_default")
    meta_payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
