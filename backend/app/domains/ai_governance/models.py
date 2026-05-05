from typing import Optional, List, Dict
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from datetime import datetime

class RecommendationLog(SQLModel, table=True):
    __tablename__ = "recommendation_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    job_id: UUID = Field(index=True)
    match_score: float
    signals: str = Field(default="[]") # JSON signals as string
    narrative: str # Explanation narrative for the user
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Audit fields
    algorithm_version: str = Field(default="v2.0.0")
    governance_status: str = Field(default="logged") # logged, reviewed, flagged
