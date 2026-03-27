from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ..core import config
from ..services.jobs_postgres_store import _connect, _ensure_schema, _json_dumps, _json_load, jobs_postgres_enabled

_TABLE = config.JOBS_POSTGRES_SIGNAL_OUTPUTS_TABLE


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def signal_boost_store_enabled() -> bool:
    return bool(jobs_postgres_enabled() and _TABLE)


def _ensure_signal_boost_schema() -> None:
    if not signal_boost_store_enabled():
        return
    _ensure_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {_TABLE} (
                id TEXT PRIMARY KEY,
                share_slug TEXT NOT NULL UNIQUE,
                candidate_id TEXT NOT NULL,
                job_id TEXT NOT NULL,
                source_kind TEXT NOT NULL DEFAULT 'imported',
                locale TEXT NOT NULL DEFAULT 'en',
                status TEXT NOT NULL DEFAULT 'draft',
                job_snapshot JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                candidate_snapshot JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                scenario_payload JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                response_payload JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                recruiter_readout JSONB,
                signal_summary JSONB,
                quality_flags JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                analytics JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                published_at TIMESTAMPTZ
            )
            """
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_candidate_id ON {_TABLE} (candidate_id, updated_at DESC)"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_job_id ON {_TABLE} (job_id, updated_at DESC)"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_status ON {_TABLE} (status, published_at DESC)"
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_published_at ON {_TABLE} (published_at DESC)"
        )
        cur.execute(
            f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS recruiter_readout JSONB"
        )


def _normalize_record(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(row, dict) or not row:
        return None
    return {
        "id": str(row.get("id") or "").strip(),
        "share_slug": str(row.get("share_slug") or "").strip(),
        "candidate_id": str(row.get("candidate_id") or "").strip(),
        "job_id": str(row.get("job_id") or "").strip(),
        "source_kind": str(row.get("source_kind") or "imported").strip(),
        "locale": str(row.get("locale") or "en").strip(),
        "status": str(row.get("status") or "draft").strip(),
        "job_snapshot": _json_load(row.get("job_snapshot"), {}),
        "candidate_snapshot": _json_load(row.get("candidate_snapshot"), {}),
        "scenario_payload": _json_load(row.get("scenario_payload"), {}),
        "response_payload": _json_load(row.get("response_payload"), {}),
        "recruiter_readout": _json_load(row.get("recruiter_readout"), None),
        "signal_summary": _json_load(row.get("signal_summary"), None),
        "quality_flags": _json_load(row.get("quality_flags"), {}),
        "analytics": _json_load(row.get("analytics"), {}),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "published_at": row.get("published_at"),
    }


def create_signal_output(record: dict[str, Any]) -> dict[str, Any]:
    if not signal_boost_store_enabled():
        raise RuntimeError("Signal Boost store unavailable")
    _ensure_signal_boost_schema()
    conn = _connect()
    now = _utcnow()
    payload = {
        "id": str(record.get("id") or "").strip(),
        "share_slug": str(record.get("share_slug") or "").strip(),
        "candidate_id": str(record.get("candidate_id") or "").strip(),
        "job_id": str(record.get("job_id") or "").strip(),
        "source_kind": str(record.get("source_kind") or "imported").strip() or "imported",
        "locale": str(record.get("locale") or "en").strip() or "en",
        "status": str(record.get("status") or "draft").strip() or "draft",
        "job_snapshot": _json_dumps(record.get("job_snapshot") or {}),
        "candidate_snapshot": _json_dumps(record.get("candidate_snapshot") or {}),
        "scenario_payload": _json_dumps(record.get("scenario_payload") or {}),
        "response_payload": _json_dumps(record.get("response_payload") or {}),
        "recruiter_readout": _json_dumps(record.get("recruiter_readout")) if record.get("recruiter_readout") is not None else None,
        "signal_summary": _json_dumps(record.get("signal_summary")) if record.get("signal_summary") is not None else None,
        "quality_flags": _json_dumps(record.get("quality_flags") or {}),
        "analytics": _json_dumps(record.get("analytics") or {}),
        "created_at": record.get("created_at") or now,
        "updated_at": record.get("updated_at") or now,
        "published_at": record.get("published_at"),
    }
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {_TABLE} (
                id, share_slug, candidate_id, job_id, source_kind, locale, status,
                job_snapshot, candidate_snapshot, scenario_payload, response_payload,
                recruiter_readout, signal_summary, quality_flags, analytics, created_at, updated_at, published_at
            )
            VALUES (
                %(id)s, %(share_slug)s, %(candidate_id)s, %(job_id)s, %(source_kind)s, %(locale)s, %(status)s,
                %(job_snapshot)s::jsonb, %(candidate_snapshot)s::jsonb, %(scenario_payload)s::jsonb, %(response_payload)s::jsonb,
                %(recruiter_readout)s::jsonb, %(signal_summary)s::jsonb, %(quality_flags)s::jsonb, %(analytics)s::jsonb, %(created_at)s, %(updated_at)s, %(published_at)s
            )
            RETURNING *
            """,
            payload,
        )
        row = cur.fetchone() or {}
    normalized = _normalize_record(row)
    if not normalized:
        raise RuntimeError("Failed to create signal output")
    return normalized


def update_signal_output(
    *,
    output_id: str,
    candidate_id: str,
    patch: dict[str, Any],
) -> dict[str, Any] | None:
    if not signal_boost_store_enabled():
        raise RuntimeError("Signal Boost store unavailable")
    _ensure_signal_boost_schema()
    normalized_output_id = str(output_id or "").strip()
    normalized_candidate_id = str(candidate_id or "").strip()
    if not normalized_output_id or not normalized_candidate_id:
        return None
    existing = get_signal_output_by_id(output_id=normalized_output_id, candidate_id=normalized_candidate_id)
    if not existing:
        return None

    merged = {
        **existing,
        **patch,
        "job_snapshot": patch.get("job_snapshot", existing.get("job_snapshot") or {}),
        "candidate_snapshot": patch.get("candidate_snapshot", existing.get("candidate_snapshot") or {}),
        "scenario_payload": patch.get("scenario_payload", existing.get("scenario_payload") or {}),
        "response_payload": patch.get("response_payload", existing.get("response_payload") or {}),
        "recruiter_readout": patch.get("recruiter_readout", existing.get("recruiter_readout")),
        "signal_summary": patch.get("signal_summary", existing.get("signal_summary")),
        "quality_flags": patch.get("quality_flags", existing.get("quality_flags") or {}),
        "analytics": patch.get("analytics", existing.get("analytics") or {}),
        "updated_at": patch.get("updated_at") or _utcnow(),
    }
    if merged.get("status") == "published" and not merged.get("published_at"):
        merged["published_at"] = merged.get("updated_at")

    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE {_TABLE}
            SET source_kind = %(source_kind)s,
                locale = %(locale)s,
                status = %(status)s,
                job_snapshot = %(job_snapshot)s::jsonb,
                candidate_snapshot = %(candidate_snapshot)s::jsonb,
                scenario_payload = %(scenario_payload)s::jsonb,
                response_payload = %(response_payload)s::jsonb,
                recruiter_readout = %(recruiter_readout)s::jsonb,
                signal_summary = %(signal_summary)s::jsonb,
                quality_flags = %(quality_flags)s::jsonb,
                analytics = %(analytics)s::jsonb,
                updated_at = %(updated_at)s,
                published_at = %(published_at)s
            WHERE id = %(id)s AND candidate_id = %(candidate_id)s
            RETURNING *
            """,
            {
                "id": normalized_output_id,
                "candidate_id": normalized_candidate_id,
                "source_kind": str(merged.get("source_kind") or "imported").strip() or "imported",
                "locale": str(merged.get("locale") or "en").strip() or "en",
                "status": str(merged.get("status") or "draft").strip() or "draft",
                "job_snapshot": _json_dumps(merged.get("job_snapshot") or {}),
                "candidate_snapshot": _json_dumps(merged.get("candidate_snapshot") or {}),
                "scenario_payload": _json_dumps(merged.get("scenario_payload") or {}),
                "response_payload": _json_dumps(merged.get("response_payload") or {}),
                "recruiter_readout": _json_dumps(merged.get("recruiter_readout")) if merged.get("recruiter_readout") is not None else None,
                "signal_summary": _json_dumps(merged.get("signal_summary")) if merged.get("signal_summary") is not None else None,
                "quality_flags": _json_dumps(merged.get("quality_flags") or {}),
                "analytics": _json_dumps(merged.get("analytics") or {}),
                "updated_at": merged.get("updated_at"),
                "published_at": merged.get("published_at"),
            },
        )
        row = cur.fetchone() or {}
    return _normalize_record(row)


def get_signal_output_by_id(*, output_id: str, candidate_id: str | None = None) -> dict[str, Any] | None:
    if not signal_boost_store_enabled():
        return None
    normalized_output_id = str(output_id or "").strip()
    if not normalized_output_id:
        return None
    _ensure_signal_boost_schema()
    conn = _connect()
    sql = f"SELECT * FROM {_TABLE} WHERE id = %s"
    params: list[Any] = [normalized_output_id]
    if candidate_id:
        sql += " AND candidate_id = %s"
        params.append(str(candidate_id or "").strip())
    sql += " LIMIT 1"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone() or {}
    return _normalize_record(row)


def get_signal_output_by_share_slug(*, share_slug: str, include_draft: bool = False) -> dict[str, Any] | None:
    if not signal_boost_store_enabled():
        return None
    normalized_slug = str(share_slug or "").strip()
    if not normalized_slug:
        return None
    _ensure_signal_boost_schema()
    conn = _connect()
    sql = f"SELECT * FROM {_TABLE} WHERE share_slug = %s"
    params: list[Any] = [normalized_slug]
    if not include_draft:
        sql += " AND status = %s"
        params.append("published")
    sql += " LIMIT 1"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone() or {}
    return _normalize_record(row)


def get_latest_signal_output_for_job(*, candidate_id: str, job_id: str) -> dict[str, Any] | None:
    if not signal_boost_store_enabled():
        return None
    normalized_candidate_id = str(candidate_id or "").strip()
    normalized_job_id = str(job_id or "").strip()
    if not normalized_candidate_id or not normalized_job_id:
        return None
    _ensure_signal_boost_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT *
            FROM {_TABLE}
            WHERE candidate_id = %s
              AND job_id = %s
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 1
            """,
            (normalized_candidate_id, normalized_job_id),
        )
        row = cur.fetchone() or {}
    return _normalize_record(row)


def get_latest_published_signal_output_for_candidate_job(*, candidate_id: str, job_id: str) -> dict[str, Any] | None:
    if not signal_boost_store_enabled():
        return None
    normalized_candidate_id = str(candidate_id or "").strip()
    normalized_job_id = str(job_id or "").strip()
    if not normalized_candidate_id or not normalized_job_id:
        return None
    _ensure_signal_boost_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT *
            FROM {_TABLE}
            WHERE candidate_id = %s
              AND job_id = %s
              AND status = %s
            ORDER BY updated_at DESC, published_at DESC, created_at DESC
            LIMIT 1
            """,
            (normalized_candidate_id, normalized_job_id, "published"),
        )
        row = cur.fetchone() or {}
    return _normalize_record(row)


def list_recent_signal_outputs_for_candidate(*, candidate_id: str, limit: int = 12) -> list[dict[str, Any]]:
    if not signal_boost_store_enabled():
        return []
    normalized_candidate_id = str(candidate_id or "").strip()
    if not normalized_candidate_id:
        return []
    _ensure_signal_boost_schema()
    conn = _connect()
    row_limit = max(1, min(int(limit or 12), 50))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT *
            FROM {_TABLE}
            WHERE candidate_id = %s
              AND status = %s
            ORDER BY updated_at DESC, published_at DESC
            LIMIT %s
            """,
            (normalized_candidate_id, "published", row_limit),
        )
        rows = cur.fetchall() or []
    return [item for item in (_normalize_record(row) for row in rows) if item]


def record_signal_output_event(*, output_id: str, event_type: str, increment: int = 1) -> dict[str, Any] | None:
    if not signal_boost_store_enabled():
        return None
    _ensure_signal_boost_schema()
    normalized_output_id = str(output_id or "").strip()
    normalized_event = str(event_type or "").strip().lower()
    if not normalized_output_id or not normalized_event:
        return None
    existing = get_signal_output_by_id(output_id=normalized_output_id)
    if not existing:
        return None
    analytics = dict(existing.get("analytics") or {})
    analytics[normalized_event] = max(0, int(analytics.get(normalized_event) or 0)) + max(1, int(increment or 1))
    analytics[f"last_{normalized_event}_at"] = _utcnow().isoformat()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE {_TABLE}
            SET analytics = %s::jsonb,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (_json_dumps(analytics), normalized_output_id),
        )
        row = cur.fetchone() or {}
    return _normalize_record(row)


def get_signal_boost_analytics_summary(*, days: int = 30, limit: int = 8) -> dict[str, Any]:
    if not signal_boost_store_enabled():
        return {
            "enabled": False,
            "window_days": max(1, int(days or 30)),
            "summary": {},
            "top_outputs": [],
        }

    _ensure_signal_boost_schema()
    conn = _connect()
    window_days = max(1, int(days or 30))
    row_limit = max(1, min(int(limit or 8), 20))

    with conn.cursor() as cur:
        cur.execute(
            f"""
            WITH windowed AS (
                SELECT *
                FROM {_TABLE}
                WHERE published_at IS NOT NULL
                  AND published_at >= NOW() - (%s || ' days')::interval
            )
            SELECT
                COUNT(*)::int AS published_outputs,
                COALESCE(SUM(COALESCE((analytics ->> 'view')::int, 0)), 0)::int AS total_views,
                COALESCE(SUM(COALESCE((analytics ->> 'share_copy')::int, 0)), 0)::int AS total_share_copies,
                COALESCE(SUM(COALESCE((analytics ->> 'recruiter_cta_click')::int, 0)), 0)::int AS total_recruiter_cta_clicks,
                COALESCE(SUM(COALESCE((analytics ->> 'open_original_listing')::int, 0)), 0)::int AS total_open_original_listing,
                COALESCE(SUM(CASE WHEN source_kind = 'imported' THEN 1 ELSE 0 END), 0)::int AS imported_outputs,
                COALESCE(SUM(CASE WHEN source_kind = 'native' THEN 1 ELSE 0 END), 0)::int AS native_outputs
            FROM windowed
            """,
            (str(window_days),),
        )
        summary_row = cur.fetchone() or {}

        cur.execute(
            f"""
            SELECT
                id,
                share_slug,
                source_kind,
                published_at,
                job_snapshot,
                candidate_snapshot,
                COALESCE((analytics ->> 'view')::int, 0) AS views,
                COALESCE((analytics ->> 'share_copy')::int, 0) AS share_copies,
                COALESCE((analytics ->> 'recruiter_cta_click')::int, 0) AS recruiter_cta_clicks,
                COALESCE((analytics ->> 'open_original_listing')::int, 0) AS open_original_listing
            FROM {_TABLE}
            WHERE published_at IS NOT NULL
              AND published_at >= NOW() - (%s || ' days')::interval
            ORDER BY COALESCE((analytics ->> 'view')::int, 0) DESC, published_at DESC
            LIMIT %s
            """,
            (str(window_days), row_limit),
        )
        top_rows = cur.fetchall() or []

    published_outputs = int(summary_row.get("published_outputs") or 0)
    total_views = int(summary_row.get("total_views") or 0)
    total_share_copies = int(summary_row.get("total_share_copies") or 0)
    total_recruiter_cta_clicks = int(summary_row.get("total_recruiter_cta_clicks") or 0)
    total_open_original_listing = int(summary_row.get("total_open_original_listing") or 0)

    def _rate(numerator: int, denominator: int) -> float:
        if denominator <= 0:
            return 0.0
        return round((float(numerator) / float(denominator)) * 100.0, 2)

    top_outputs: list[dict[str, Any]] = []
    for row in top_rows:
        job_snapshot = _json_load(row.get("job_snapshot"), {})
        candidate_snapshot = _json_load(row.get("candidate_snapshot"), {})
        views = int(row.get("views") or 0)
        share_copies = int(row.get("share_copies") or 0)
        recruiter_cta_clicks = int(row.get("recruiter_cta_clicks") or 0)
        top_outputs.append(
            {
                "id": str(row.get("id") or "").strip(),
                "share_slug": str(row.get("share_slug") or "").strip(),
                "source_kind": str(row.get("source_kind") or "").strip() or "imported",
                "published_at": row.get("published_at"),
                "title": str(job_snapshot.get("title") or "").strip(),
                "company": str(job_snapshot.get("company") or "").strip(),
                "candidate_name": str(candidate_snapshot.get("name") or "").strip() or "JobShaman member",
                "views": views,
                "share_copies": share_copies,
                "recruiter_cta_clicks": recruiter_cta_clicks,
                "open_original_listing": int(row.get("open_original_listing") or 0),
                "view_to_cta_rate": _rate(recruiter_cta_clicks, views),
            }
        )

    return {
        "enabled": True,
        "window_days": window_days,
        "summary": {
            "published_outputs": published_outputs,
            "total_views": total_views,
            "total_share_copies": total_share_copies,
            "total_recruiter_cta_clicks": total_recruiter_cta_clicks,
            "total_open_original_listing": total_open_original_listing,
            "imported_outputs": int(summary_row.get("imported_outputs") or 0),
            "native_outputs": int(summary_row.get("native_outputs") or 0),
            "views_per_output": round((float(total_views) / float(published_outputs)), 2) if published_outputs else 0.0,
            "share_copy_rate": _rate(total_share_copies, published_outputs),
            "share_open_rate": _rate(total_views, published_outputs),
            "recruiter_cta_rate": _rate(total_recruiter_cta_clicks, total_views),
            "original_open_rate": _rate(total_open_original_listing, total_views),
        },
        "top_outputs": top_outputs,
    }
