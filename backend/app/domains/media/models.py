from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class MediaAsset(SQLModel, table=True):
    __tablename__ = "media_assets"
    __table_args__ = {"extend_existing": True}

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    owner_user_id: Optional[UUID] = Field(default=None, foreign_key="users.id", index=True)
    company_id: Optional[UUID] = Field(default=None, foreign_key="companies.id", index=True)
    kind: str
    usage: Optional[str] = None
    visibility: str = Field(default="private")
    title: Optional[str] = None
    caption: Optional[str] = None
    original_name: str
    file_name: str
    content_type: str = Field(default="application/octet-stream")
    size_bytes: int = Field(default=0)
    storage_provider: str = Field(default="local")
    storage_bucket: Optional[str] = None
    object_key: str
    upload_status: str = Field(default="pending")
    metadata_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_at: Optional[datetime] = None
