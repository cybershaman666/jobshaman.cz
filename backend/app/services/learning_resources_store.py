from __future__ import annotations

from threading import Lock
from typing import Any
from uuid import uuid4

from .jobs_postgres_store import _connect, jobs_postgres_enabled

_schema_ready = False
_lock = Lock()
_TABLE_NAME = "learning_resources"
_ALLOWED_DIFFICULTIES = {"Beginner", "Intermediate", "Advanced"}
_ALLOWED_STATUSES = {"active", "draft", "archived"}


def learning_resources_enabled() -> bool:
    return bool(jobs_postgres_enabled())


def _normalize_skill_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    normalized: list[str] = []
    for item in value:
        tag = str(item or "").strip()
        key = tag.lower()
        if not tag or key in seen:
            continue
        seen.add(key)
        normalized.append(tag)
    return normalized


def _normalize_difficulty(value: Any) -> str:
    raw = str(value or "Beginner").strip()
    return raw if raw in _ALLOWED_DIFFICULTIES else "Beginner"


def _normalize_status(value: Any) -> str:
    raw = str(value or "active").strip().lower()
    return raw if raw in _ALLOWED_STATUSES else "active"


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        parsed = int(float(value))
    except Exception:
        return default
    return parsed


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except Exception:
        return default
    return parsed


def _nullable_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except Exception:
        return None
    return parsed


def _normalize_text(value: Any, default: str = "") -> str:
    return str(value or default).strip()


def _row_to_resource(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "id": str(row.get("id") or ""),
        "title": _normalize_text(row.get("title")),
        "description": _normalize_text(row.get("description")),
        "skill_tags": _normalize_skill_tags(row.get("skill_tags") or []),
        "url": _normalize_text(row.get("url") or row.get("affiliate_url")),
        "provider": _normalize_text(row.get("provider")),
        "duration_hours": _safe_int(row.get("duration_hours"), 0),
        "difficulty": _normalize_difficulty(row.get("difficulty")),
        "price": _safe_float(row.get("price"), 0),
        "currency": _normalize_text(row.get("currency"), "CZK") or "CZK",
        "rating": _safe_float(row.get("rating"), 0),
        "reviews_count": _safe_int(row.get("reviews_count"), 0),
        "created_at": str(row.get("created_at") or ""),
        "is_government_funded": bool(row.get("is_government_funded") or False),
        "funding_amount_czk": _safe_int(row.get("funding_amount_czk"), 0) if row.get("funding_amount_czk") is not None else None,
        "affiliate_url": _normalize_text(row.get("affiliate_url")) or None,
        "location": _normalize_text(row.get("location")) or None,
        "lat": _nullable_float(row.get("lat")),
        "lng": _nullable_float(row.get("lng")),
        "status": _normalize_status(row.get("status")),
        "partner_name": _normalize_text(row.get("partner_name")) or None,
        "partner_id": _normalize_text(row.get("partner_id")) or None,
    }


def _ensure_schema() -> None:
    global _schema_ready
    if _schema_ready or not learning_resources_enabled():
        return
    with _lock:
        if _schema_ready:
            return
        conn = _connect()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {_TABLE_NAME} (
                    id TEXT PRIMARY KEY,
                    partner_id TEXT,
                    partner_name TEXT,
                    provider TEXT,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    skill_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
                    url TEXT NOT NULL DEFAULT '',
                    affiliate_url TEXT,
                    duration_hours INTEGER NOT NULL DEFAULT 0,
                    difficulty TEXT NOT NULL DEFAULT 'Beginner',
                    price DOUBLE PRECISION NOT NULL DEFAULT 0,
                    currency TEXT NOT NULL DEFAULT 'CZK',
                    rating DOUBLE PRECISION NOT NULL DEFAULT 0,
                    reviews_count INTEGER NOT NULL DEFAULT 0,
                    is_government_funded BOOLEAN NOT NULL DEFAULT FALSE,
                    funding_amount_czk INTEGER,
                    location TEXT,
                    lat DOUBLE PRECISION,
                    lng DOUBLE PRECISION,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{_TABLE_NAME}_status_created ON {_TABLE_NAME} (status, created_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{_TABLE_NAME}_partner_status ON {_TABLE_NAME} (partner_id, status, created_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{_TABLE_NAME}_rating_created ON {_TABLE_NAME} (rating DESC, reviews_count DESC, created_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{_TABLE_NAME}_skill_tags ON {_TABLE_NAME} USING GIN (skill_tags)"
            )
        _schema_ready = True


def list_learning_resources(
    *,
    skill_name: str | None = None,
    status: str = "active",
    partner_id: str | None = None,
    limit: int = 24,
) -> list[dict[str, Any]]:
    if not learning_resources_enabled():
        return []
    _ensure_schema()
    normalized_status = "all" if str(status or "").strip().lower() == "all" else _normalize_status(status)
    params: list[Any] = []
    where_parts: list[str] = []

    if normalized_status != "all":
        where_parts.append("status = %s")
        params.append(normalized_status)
    if partner_id:
        where_parts.append("partner_id = %s")
        params.append(_normalize_text(partner_id))
    if skill_name:
        where_parts.append("EXISTS (SELECT 1 FROM unnest(skill_tags) AS tag WHERE LOWER(tag) = LOWER(%s))")
        params.append(_normalize_text(skill_name))

    where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    params.append(max(1, min(int(limit or 24), 100)))
    sql = f"""
        SELECT *
        FROM {_TABLE_NAME}
        {where_sql}
        ORDER BY rating DESC, reviews_count DESC, created_at DESC
        LIMIT %s
    """
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall() or []
    return [item for item in (_row_to_resource(row) for row in rows) if item]


def get_partner_learning_resources(partner_id: str) -> list[dict[str, Any]]:
    return list_learning_resources(partner_id=partner_id, status="all", limit=200)


def create_learning_resource(*, company_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not learning_resources_enabled():
        raise RuntimeError("Learning resources store unavailable")
    _ensure_schema()
    resource_id = _normalize_text(payload.get("id")) or str(uuid4())
    row = {
        "id": resource_id,
        "partner_id": _normalize_text(company_id),
        "partner_name": _normalize_text(payload.get("partner_name")),
        "provider": _normalize_text(payload.get("provider")),
        "title": _normalize_text(payload.get("title")),
        "description": _normalize_text(payload.get("description")),
        "skill_tags": _normalize_skill_tags(payload.get("skill_tags") or []),
        "url": _normalize_text(payload.get("url")),
        "affiliate_url": _normalize_text(payload.get("affiliate_url")) or None,
        "duration_hours": _safe_int(payload.get("duration_hours"), 0),
        "difficulty": _normalize_difficulty(payload.get("difficulty")),
        "price": _safe_float(payload.get("price"), 0),
        "currency": _normalize_text(payload.get("currency"), "CZK") or "CZK",
        "rating": _safe_float(payload.get("rating"), 0),
        "reviews_count": _safe_int(payload.get("reviews_count"), 0),
        "is_government_funded": bool(payload.get("is_government_funded") or False),
        "funding_amount_czk": _safe_int(payload.get("funding_amount_czk"), 0) if payload.get("funding_amount_czk") is not None else None,
        "location": _normalize_text(payload.get("location")) or None,
        "lat": _nullable_float(payload.get("lat")),
        "lng": _nullable_float(payload.get("lng")),
        "status": _normalize_status(payload.get("status")),
    }
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {_TABLE_NAME} (
                id, partner_id, partner_name, provider, title, description, skill_tags, url,
                affiliate_url, duration_hours, difficulty, price, currency, rating, reviews_count,
                is_government_funded, funding_amount_czk, location, lat, lng, status
            )
            VALUES (
                %(id)s, %(partner_id)s, %(partner_name)s, %(provider)s, %(title)s, %(description)s, %(skill_tags)s, %(url)s,
                %(affiliate_url)s, %(duration_hours)s, %(difficulty)s, %(price)s, %(currency)s, %(rating)s, %(reviews_count)s,
                %(is_government_funded)s, %(funding_amount_czk)s, %(location)s, %(lat)s, %(lng)s, %(status)s
            )
            RETURNING *
            """,
            row,
        )
        created = cur.fetchone()
    resource = _row_to_resource(created)
    if not resource:
        raise RuntimeError("Failed to create learning resource")
    return resource


def update_learning_resource(*, company_id: str, resource_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    if not learning_resources_enabled():
        raise RuntimeError("Learning resources store unavailable")
    _ensure_schema()
    allowed_fields = {
        "partner_name",
        "provider",
        "title",
        "description",
        "skill_tags",
        "url",
        "affiliate_url",
        "duration_hours",
        "difficulty",
        "price",
        "currency",
        "rating",
        "reviews_count",
        "is_government_funded",
        "funding_amount_czk",
        "location",
        "lat",
        "lng",
        "status",
    }

    normalized: dict[str, Any] = {}
    for key, value in updates.items():
        if key not in allowed_fields:
            continue
        if key == "skill_tags":
            normalized[key] = _normalize_skill_tags(value or [])
        elif key == "difficulty":
            normalized[key] = _normalize_difficulty(value)
        elif key == "status":
            normalized[key] = _normalize_status(value)
        elif key in {"duration_hours", "reviews_count", "funding_amount_czk"}:
            normalized[key] = _safe_int(value, 0) if value is not None else None
        elif key in {"price", "rating"}:
            normalized[key] = _safe_float(value, 0)
        elif key in {"lat", "lng"}:
            normalized[key] = _nullable_float(value)
        elif key in {"affiliate_url", "location", "partner_name", "provider", "title", "description", "url", "currency"}:
            normalized[key] = _normalize_text(value) or (None if key in {"affiliate_url", "location"} else "")
        elif key == "is_government_funded":
            normalized[key] = bool(value)
        else:
            normalized[key] = value

    if not normalized:
        rows = get_partner_learning_resources(company_id)
        existing = next((item for item in rows if item["id"] == resource_id), None)
        if not existing:
            raise KeyError(resource_id)
        return existing

    assignments = [f"{field} = %s" for field in normalized.keys()]
    params = list(normalized.values()) + [_normalize_text(resource_id), _normalize_text(company_id)]
    sql = f"""
        UPDATE {_TABLE_NAME}
        SET {", ".join(assignments)}, updated_at = NOW()
        WHERE id = %s AND partner_id = %s
        RETURNING *
    """
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
    resource = _row_to_resource(row)
    if not resource:
        raise KeyError(resource_id)
    return resource
