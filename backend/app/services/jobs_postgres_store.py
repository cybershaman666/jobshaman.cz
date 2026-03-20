from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from ..core import config

_conn = None
_schema_ready = False
_lock = Lock()


def jobs_postgres_enabled() -> bool:
    return bool(config.JOBS_POSTGRES_ENABLED and config.JOBS_POSTGRES_URL)


def jobs_postgres_main_enabled() -> bool:
    return bool(jobs_postgres_enabled() and config.JOBS_POSTGRES_SERVE_MAIN)


def _inject_local_venv_site_packages() -> list[str]:
    added: list[str] = []
    current_file = Path(__file__).resolve()
    backend_dir = current_file.parents[2]
    repo_root = current_file.parents[4]
    candidates = (
        backend_dir / "venv",
        repo_root / ".venv",
    )

    for venv_dir in candidates:
        lib_dir = venv_dir / "lib"
        if not lib_dir.exists():
            continue
        for site_packages in sorted(lib_dir.glob("python*/site-packages"), reverse=True):
            site_packages_str = str(site_packages)
            if site_packages.is_dir() and site_packages_str not in sys.path:
                sys.path.insert(0, site_packages_str)
                added.append(site_packages_str)
    return added


def _load_psycopg():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except Exception as exc:
        added_paths = _inject_local_venv_site_packages()
        try:
            import psycopg
            from psycopg.rows import dict_row
        except Exception:
            searched = ", ".join(added_paths) if added_paths else "no local venv site-packages found"
            raise RuntimeError(
                "Jobs Postgres runtime is not available. Install backend dependencies including "
                "psycopg[binary]. "
                f"Interpreter: {sys.executable}. "
                f"Checked local venv paths: {searched}."
            ) from exc
        return psycopg, dict_row
    return psycopg, dict_row


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_main_source_kind(doc: dict[str, Any]) -> str:
    raw_kind = str(doc.get("source_kind") or "").strip().lower()
    if raw_kind in {"native", "external", "imported"}:
        return "external" if raw_kind == "imported" else raw_kind
    source = str(doc.get("source") or "").strip().lower()
    if "jobshaman" in source:
        return "native"
    company_id = str(doc.get("company_id") or "").strip()
    return "native" if company_id else "external"


def _jobs_main_cutoff_sql() -> tuple[str, tuple[Any, ...]]:
    now = _utcnow()
    imported_cutoff = now - timedelta(days=max(1, int(config.JOBS_POSTGRES_IMPORTED_RETENTION_DAYS or 15)))
    native_cutoff = now - timedelta(days=max(1, int(config.JOBS_POSTGRES_NATIVE_RETENTION_DAYS or 30)))
    clause = """
        (
            (COALESCE(source_kind, 'native') = 'native' AND scraped_at >= %s)
            OR
            (COALESCE(source_kind, 'native') <> 'native' AND scraped_at >= %s)
        )
    """
    return clause, (native_cutoff, imported_cutoff)


def _connect():
    global _conn
    if _conn is not None:
        return _conn
    if not jobs_postgres_enabled():
        raise RuntimeError("JOBS_POSTGRES_URL missing or Jobs Postgres disabled")
    psycopg, dict_row = _load_psycopg()
    conn = psycopg.connect(
        config.JOBS_POSTGRES_URL,
        autocommit=True,
        row_factory=dict_row,
        sslmode=config.JOBS_POSTGRES_SSLMODE or "require",
    )
    _conn = conn
    return conn


def _ensure_schema() -> None:
    global _schema_ready
    if _schema_ready or not jobs_postgres_enabled():
        return
    with _lock:
        if _schema_ready:
            return
        conn = _connect()
        with conn.cursor() as cur:
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {config.JOBS_POSTGRES_JOBS_TABLE} (
                    id TEXT PRIMARY KEY,
                    company_id TEXT,
                    posted_by TEXT,
                    recruiter_id TEXT,
                    title TEXT NOT NULL,
                    company TEXT NOT NULL,
                    location TEXT NOT NULL,
                    description TEXT NOT NULL,
                    role_summary TEXT,
                    first_reply_prompt TEXT,
                    company_truth_hard TEXT,
                    company_truth_fail TEXT,
                    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
                    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
                    contract_type TEXT,
                    salary_from INTEGER,
                    salary_to INTEGER,
                    salary_timeframe TEXT,
                    currency TEXT,
                    salary_currency TEXT,
                    work_type TEXT,
                    work_model TEXT,
                    source TEXT,
                    source_kind TEXT NOT NULL DEFAULT 'native',
                    url TEXT,
                    education_level TEXT,
                    lat DOUBLE PRECISION,
                    lng DOUBLE PRECISION,
                    country_code TEXT,
                    language_code TEXT,
                    legality_status TEXT NOT NULL DEFAULT 'legal',
                    verification_notes TEXT,
                    ai_analysis JSONB,
                    open_dialogues_count INTEGER,
                    dialogue_capacity_limit INTEGER,
                    reaction_window_hours INTEGER,
                    reaction_window_days INTEGER,
                    status TEXT NOT NULL DEFAULT 'active',
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    challenge_format TEXT,
                    payload_json JSONB NOT NULL DEFAULT '{{}}'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    scraped_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                f"ALTER TABLE {config.JOBS_POSTGRES_JOBS_TABLE} ADD COLUMN IF NOT EXISTS posted_by TEXT"
            )
            cur.execute(
                f"ALTER TABLE {config.JOBS_POSTGRES_JOBS_TABLE} ADD COLUMN IF NOT EXISTS recruiter_id TEXT"
            )
            cur.execute(
                f"ALTER TABLE {config.JOBS_POSTGRES_JOBS_TABLE} ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{{}}'::jsonb"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBS_TABLE}_scraped_at ON {config.JOBS_POSTGRES_JOBS_TABLE} (scraped_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBS_TABLE}_status_active ON {config.JOBS_POSTGRES_JOBS_TABLE} (status, is_active)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBS_TABLE}_legality_status ON {config.JOBS_POSTGRES_JOBS_TABLE} (legality_status)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBS_TABLE}_country_code ON {config.JOBS_POSTGRES_JOBS_TABLE} (country_code)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBS_TABLE}_company_id ON {config.JOBS_POSTGRES_JOBS_TABLE} (company_id)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBS_TABLE}_source_kind ON {config.JOBS_POSTGRES_JOBS_TABLE} (source_kind)"
            )
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE} (
                    cache_key TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    search_term TEXT NOT NULL DEFAULT '',
                    filter_city TEXT NOT NULL DEFAULT '',
                    country_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
                    exclude_country_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
                    page INTEGER NOT NULL DEFAULT 1,
                    result_count INTEGER NOT NULL DEFAULT 0,
                    payload_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                    fetched_at TIMESTAMPTZ NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE}_expires_at ON {config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE} (expires_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE}_fetched_at ON {config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE} (fetched_at DESC)"
            )
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {config.JOBS_POSTGRES_JOBSPY_TABLE} (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL DEFAULT 'jobspy',
                    source_site TEXT,
                    title TEXT,
                    company TEXT,
                    location TEXT,
                    city TEXT,
                    state TEXT,
                    country TEXT,
                    country_code TEXT,
                    job_type TEXT,
                    interval TEXT,
                    min_amount DOUBLE PRECISION,
                    max_amount DOUBLE PRECISION,
                    currency TEXT,
                    job_url TEXT,
                    description TEXT,
                    is_remote BOOLEAN NOT NULL DEFAULT FALSE,
                    lat DOUBLE PRECISION,
                    lng DOUBLE PRECISION,
                    geocode_source TEXT,
                    search_term TEXT,
                    google_search_term TEXT,
                    location_query TEXT,
                    search_location_query TEXT,
                    queried_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
                    hours_old INTEGER,
                    query_hash TEXT,
                    search_blob TEXT,
                    raw_payload_json JSONB,
                    payload_json JSONB NOT NULL,
                    scraped_at TIMESTAMPTZ NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBSPY_TABLE}_scraped_at ON {config.JOBS_POSTGRES_JOBSPY_TABLE} (scraped_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBSPY_TABLE}_expires_at ON {config.JOBS_POSTGRES_JOBSPY_TABLE} (expires_at DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBSPY_TABLE}_country_code ON {config.JOBS_POSTGRES_JOBSPY_TABLE} (country_code)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{config.JOBS_POSTGRES_JOBSPY_TABLE}_source_site ON {config.JOBS_POSTGRES_JOBSPY_TABLE} (source_site)"
            )
        _schema_ready = True


def _json_load(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return fallback
    return fallback


def _json_default(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return str(value)


def _json_dumps(value: Any) -> str:
    return json.dumps(value, default=_json_default)


def _coerce_timestamp(value: Any, *, default: datetime | None = None) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except Exception:
            pass
    return default or _utcnow()


def _coerce_json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        parsed = _json_load(value, [])
        if isinstance(parsed, list):
            return parsed
    return []


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except Exception:
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except Exception:
        return None


def upsert_external_cache_snapshot(
    *,
    cache_key: str,
    provider: str,
    search_term: str,
    filter_city: str,
    country_codes: list[str] | None,
    exclude_country_codes: list[str] | None,
    page: int,
    jobs: list[dict[str, Any]],
    fetched_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> bool:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_WRITE_EXTERNAL:
        return False
    _ensure_schema()
    conn = _connect()
    now = fetched_at or _utcnow()
    expiry = expires_at or (now + timedelta(seconds=900))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE}
                (cache_key, provider, search_term, filter_city, country_codes, exclude_country_codes, page, result_count, payload_json, fetched_at, expires_at, updated_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s::jsonb, %s, %s, %s)
            ON CONFLICT (cache_key) DO UPDATE SET
                provider = EXCLUDED.provider,
                search_term = EXCLUDED.search_term,
                filter_city = EXCLUDED.filter_city,
                country_codes = EXCLUDED.country_codes,
                exclude_country_codes = EXCLUDED.exclude_country_codes,
                page = EXCLUDED.page,
                result_count = EXCLUDED.result_count,
                payload_json = EXCLUDED.payload_json,
                fetched_at = EXCLUDED.fetched_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                cache_key,
                provider,
                str(search_term or "").strip(),
                str(filter_city or "").strip(),
                _json_dumps([code.strip().upper() for code in (country_codes or []) if code and code.strip()]),
                _json_dumps([code.strip().upper() for code in (exclude_country_codes or []) if code and code.strip()]),
                max(1, int(page or 1)),
                len(jobs),
                _json_dumps([dict(item) for item in jobs if isinstance(item, dict)]),
                now,
                expiry,
                now,
            ),
        )
    return True


def read_external_cache_jobs(
    *,
    limit_rows: int = 120,
) -> list[dict[str, Any]]:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_SERVE_EXTERNAL:
        return []
    _ensure_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT payload_json
            FROM {config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE}
            WHERE expires_at >= %s
            ORDER BY fetched_at DESC
            LIMIT %s
            """,
            (_utcnow(), max(1, int(limit_rows or 120))),
        )
        rows = cur.fetchall() or []
    jobs: list[dict[str, Any]] = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), [])
        if isinstance(payload, list):
            jobs.extend([dict(item) for item in payload if isinstance(item, dict)])
    return jobs


def upsert_jobs_documents(documents: list[dict[str, Any]]) -> dict[str, int]:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_WRITE_MAIN:
        return {"imported_count": 0, "upserted_count": 0, "matched_count": 0}
    _ensure_schema()
    if not documents:
        return {"imported_count": 0, "upserted_count": 0, "matched_count": 0}
    ids = [str(doc.get("id") or "") for doc in documents if str(doc.get("id") or "").strip()]
    if not ids:
        return {"imported_count": 0, "upserted_count": 0, "matched_count": 0}
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id FROM {config.JOBS_POSTGRES_JOBS_TABLE} WHERE id = ANY(%s)",
            (ids,),
        )
        existing_ids = {str((row or {}).get("id") or "") for row in (cur.fetchall() or [])}
        cur.executemany(
            f"""
            INSERT INTO {config.JOBS_POSTGRES_JOBS_TABLE}
                (id, company_id, posted_by, recruiter_id, title, company, location, description, role_summary, first_reply_prompt, company_truth_hard, company_truth_fail, benefits, tags, contract_type, salary_from, salary_to, salary_timeframe, currency, salary_currency, work_type, work_model, source, source_kind, url, education_level, lat, lng, country_code, language_code, legality_status, verification_notes, ai_analysis, open_dialogues_count, dialogue_capacity_limit, reaction_window_hours, reaction_window_days, status, is_active, challenge_format, payload_json, created_at, scraped_at, updated_at)
            VALUES (%(id)s, %(company_id)s, %(posted_by)s, %(recruiter_id)s, %(title)s, %(company)s, %(location)s, %(description)s, %(role_summary)s, %(first_reply_prompt)s, %(company_truth_hard)s, %(company_truth_fail)s, %(benefits)s::jsonb, %(tags)s::jsonb, %(contract_type)s, %(salary_from)s, %(salary_to)s, %(salary_timeframe)s, %(currency)s, %(salary_currency)s, %(work_type)s, %(work_model)s, %(source)s, %(source_kind)s, %(url)s, %(education_level)s, %(lat)s, %(lng)s, %(country_code)s, %(language_code)s, %(legality_status)s, %(verification_notes)s, %(ai_analysis)s::jsonb, %(open_dialogues_count)s, %(dialogue_capacity_limit)s, %(reaction_window_hours)s, %(reaction_window_days)s, %(status)s, %(is_active)s, %(challenge_format)s, %(payload_json)s::jsonb, %(created_at)s, %(scraped_at)s, %(updated_at)s)
            ON CONFLICT (id) DO UPDATE SET
                company_id = EXCLUDED.company_id,
                posted_by = EXCLUDED.posted_by,
                recruiter_id = EXCLUDED.recruiter_id,
                title = EXCLUDED.title,
                company = EXCLUDED.company,
                location = EXCLUDED.location,
                description = EXCLUDED.description,
                role_summary = EXCLUDED.role_summary,
                first_reply_prompt = EXCLUDED.first_reply_prompt,
                company_truth_hard = EXCLUDED.company_truth_hard,
                company_truth_fail = EXCLUDED.company_truth_fail,
                benefits = EXCLUDED.benefits,
                tags = EXCLUDED.tags,
                contract_type = EXCLUDED.contract_type,
                salary_from = EXCLUDED.salary_from,
                salary_to = EXCLUDED.salary_to,
                salary_timeframe = EXCLUDED.salary_timeframe,
                currency = EXCLUDED.currency,
                salary_currency = EXCLUDED.salary_currency,
                work_type = EXCLUDED.work_type,
                work_model = EXCLUDED.work_model,
                source = EXCLUDED.source,
                source_kind = EXCLUDED.source_kind,
                url = EXCLUDED.url,
                education_level = EXCLUDED.education_level,
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                country_code = EXCLUDED.country_code,
                language_code = EXCLUDED.language_code,
                legality_status = EXCLUDED.legality_status,
                verification_notes = EXCLUDED.verification_notes,
                ai_analysis = EXCLUDED.ai_analysis,
                open_dialogues_count = EXCLUDED.open_dialogues_count,
                dialogue_capacity_limit = EXCLUDED.dialogue_capacity_limit,
                reaction_window_hours = EXCLUDED.reaction_window_hours,
                reaction_window_days = EXCLUDED.reaction_window_days,
                status = EXCLUDED.status,
                is_active = EXCLUDED.is_active,
                challenge_format = EXCLUDED.challenge_format,
                payload_json = EXCLUDED.payload_json,
                created_at = EXCLUDED.created_at,
                scraped_at = EXCLUDED.scraped_at,
                updated_at = EXCLUDED.updated_at
            """,
            [
                {
                    "source_kind": _normalize_main_source_kind(doc),
                    "id": str(doc.get("id") or ""),
                    "company_id": doc.get("company_id"),
                    "posted_by": doc.get("posted_by"),
                    "recruiter_id": doc.get("recruiter_id"),
                    "title": str(doc.get("title") or ""),
                    "company": str(doc.get("company") or ""),
                    "location": str(doc.get("location") or ""),
                    "description": str(doc.get("description") or ""),
                    "role_summary": doc.get("role_summary"),
                    "first_reply_prompt": doc.get("first_reply_prompt"),
                    "company_truth_hard": doc.get("company_truth_hard"),
                    "company_truth_fail": doc.get("company_truth_fail"),
                    "benefits": _json_dumps(_coerce_json_list(doc.get("benefits"))),
                    "tags": _json_dumps(_coerce_json_list(doc.get("tags"))),
                    "contract_type": doc.get("contract_type"),
                    "salary_from": _coerce_int(doc.get("salary_from")),
                    "salary_to": _coerce_int(doc.get("salary_to")),
                    "salary_timeframe": doc.get("salary_timeframe"),
                    "currency": doc.get("currency"),
                    "salary_currency": doc.get("salary_currency"),
                    "work_type": doc.get("work_type"),
                    "work_model": doc.get("work_model"),
                    "source": doc.get("source"),
                    "url": doc.get("url"),
                    "education_level": doc.get("education_level"),
                    "lat": _coerce_float(doc.get("lat")),
                    "lng": _coerce_float(doc.get("lng")),
                    "country_code": doc.get("country_code"),
                    "language_code": doc.get("language_code"),
                    "legality_status": str(doc.get("legality_status") or "legal"),
                    "verification_notes": doc.get("verification_notes"),
                    "ai_analysis": _json_dumps(doc.get("ai_analysis") or {}),
                    "open_dialogues_count": _coerce_int(doc.get("open_dialogues_count")),
                    "dialogue_capacity_limit": _coerce_int(doc.get("dialogue_capacity_limit")),
                    "reaction_window_hours": _coerce_int(doc.get("reaction_window_hours")),
                    "reaction_window_days": _coerce_int(doc.get("reaction_window_days")),
                    "status": str(doc.get("status") or "active"),
                    "is_active": bool(doc.get("is_active", True)),
                    "challenge_format": doc.get("challenge_format"),
                    "payload_json": _json_dumps(doc),
                    "created_at": _coerce_timestamp(doc.get("created_at")),
                    "scraped_at": _coerce_timestamp(doc.get("scraped_at"), default=_coerce_timestamp(doc.get("created_at"))),
                    "updated_at": _coerce_timestamp(doc.get("updated_at"), default=_utcnow()),
                }
                for doc in documents
                if str(doc.get("id") or "").strip()
            ],
        )
    imported_count = len(ids)
    matched_count = len(existing_ids)
    upserted_count = max(0, imported_count - matched_count)
    return {
        "imported_count": imported_count,
        "upserted_count": upserted_count,
        "matched_count": matched_count,
    }


def read_recent_jobs(*, limit: int = 500, days: int = 30) -> list[dict[str, Any]]:
    if not jobs_postgres_main_enabled():
        return []
    _ensure_schema()
    conn = _connect()
    cutoff = _utcnow() - timedelta(days=max(1, int(days or 30)))
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT payload_json
            FROM {config.JOBS_POSTGRES_JOBS_TABLE}
            WHERE scraped_at >= %s
              AND COALESCE(status, 'active') = 'active'
              AND COALESCE(legality_status, 'legal') = 'legal'
              AND {cutoff_sql}
            ORDER BY scraped_at DESC
            LIMIT %s
            """,
            (cutoff, *cutoff_params, max(1, int(limit or 500))),
        )
        rows = cur.fetchall() or []
    jobs: list[dict[str, Any]] = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), {})
        if isinstance(payload, dict):
            jobs.append(dict(payload))
    return jobs


def query_jobs_for_hybrid_search(
    *,
    limit: int = 300,
    cutoff_iso: str | None = None,
    country_codes: list[str] | None = None,
    language_codes: list[str] | None = None,
    min_salary: int | None = None,
) -> list[dict[str, Any]]:
    if not jobs_postgres_main_enabled():
        return []
    _ensure_schema()
    conn = _connect()
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    where_parts = [
        "COALESCE(legality_status, 'legal') = 'legal'",
        "COALESCE(status, 'active') = 'active'",
        cutoff_sql.strip(),
    ]
    params: list[Any] = list(cutoff_params)
    if cutoff_iso:
        where_parts.append("scraped_at >= %s")
        params.append(_coerce_timestamp(cutoff_iso))
    normalized_country_codes = [str(code or "").strip().upper() for code in (country_codes or []) if str(code or "").strip()]
    if normalized_country_codes:
        where_parts.append("UPPER(COALESCE(country_code, '')) = ANY(%s)")
        params.append(normalized_country_codes)
    normalized_language_codes = [str(code or "").strip().lower() for code in (language_codes or []) if str(code or "").strip()]
    if normalized_language_codes:
        where_parts.append("LOWER(COALESCE(language_code, '')) = ANY(%s)")
        params.append(normalized_language_codes)
    if min_salary:
        where_parts.append("COALESCE(salary_from, 0) >= %s")
        params.append(int(min_salary))
    where_sql = " AND ".join(where_parts)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT payload_json
            FROM {config.JOBS_POSTGRES_JOBS_TABLE}
            WHERE {where_sql}
            ORDER BY scraped_at DESC
            LIMIT %s
            """,
            [*params, max(1, int(limit or 300))],
        )
        rows = cur.fetchall() or []
    jobs: list[dict[str, Any]] = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), {})
        if isinstance(payload, dict):
            jobs.append(dict(payload))
    return jobs


def count_active_main_jobs() -> int:
    if not jobs_postgres_main_enabled():
        return 0
    _ensure_schema()
    conn = _connect()
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*) AS total_count
            FROM {config.JOBS_POSTGRES_JOBS_TABLE}
            WHERE COALESCE(legality_status, 'legal') = 'legal'
              AND COALESCE(status, 'active') = 'active'
              AND COALESCE(is_active, TRUE) = TRUE
              AND {cutoff_sql}
            """,
            cutoff_params,
        )
        row = cur.fetchone() or {}
    return max(0, int((row or {}).get("total_count") or 0))


def get_job_by_id(job_id: Any) -> dict[str, Any] | None:
    if not jobs_postgres_main_enabled():
        return None
    normalized_id = str(job_id or "").strip()
    if not normalized_id:
        return None
    _ensure_schema()
    conn = _connect()
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT payload_json FROM {config.JOBS_POSTGRES_JOBS_TABLE} WHERE id = %s AND {cutoff_sql} LIMIT 1",
            (normalized_id, *cutoff_params),
        )
        row = cur.fetchone() or {}
    payload = _json_load((row or {}).get("payload_json"), {})
    if isinstance(payload, dict) and payload:
        return dict(payload)
    return None


def get_job_by_url(url: Any) -> dict[str, Any] | None:
    if not jobs_postgres_main_enabled():
        return None
    normalized_url = str(url or "").strip()
    if not normalized_url:
        return None
    _ensure_schema()
    conn = _connect()
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT payload_json FROM {config.JOBS_POSTGRES_JOBS_TABLE} WHERE url = %s AND {cutoff_sql} ORDER BY scraped_at DESC LIMIT 1",
            (normalized_url, *cutoff_params),
        )
        row = cur.fetchone() or {}
    payload = _json_load((row or {}).get("payload_json"), {})
    if isinstance(payload, dict) and payload:
        return dict(payload)
    return None


def list_company_jobs(*, company_id: str, limit: int = 200) -> list[dict[str, Any]]:
    if not jobs_postgres_main_enabled():
        return []
    normalized_company_id = str(company_id or "").strip()
    if not normalized_company_id:
        return []
    _ensure_schema()
    conn = _connect()
    cutoff_sql, cutoff_params = _jobs_main_cutoff_sql()
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT payload_json
            FROM {config.JOBS_POSTGRES_JOBS_TABLE}
            WHERE company_id = %s
              AND {cutoff_sql}
            ORDER BY scraped_at DESC
            LIMIT %s
            """,
            (normalized_company_id, *cutoff_params, max(1, int(limit or 200))),
        )
        rows = cur.fetchall() or []
    out: list[dict[str, Any]] = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), {})
        if isinstance(payload, dict):
            out.append(dict(payload))
    return out


def update_job_fields(job_id: Any, patch: dict[str, Any]) -> bool:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_WRITE_MAIN:
        return False
    normalized_id = str(job_id or "").strip()
    if not normalized_id or not isinstance(patch, dict) or not patch:
        return False
    existing = get_job_by_id(normalized_id)
    if not existing:
        return False
    merged = dict(existing)
    merged.update(patch)
    backfill_jobs_from_documents([merged])
    return True


def delete_job_by_id(job_id: Any) -> bool:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_WRITE_MAIN:
        return False
    normalized_id = str(job_id or "").strip()
    if not normalized_id:
        return False
    _ensure_schema()
    conn = _connect()
    with conn.cursor() as cur:
        cur.execute(
            f"DELETE FROM {config.JOBS_POSTGRES_JOBS_TABLE} WHERE id = %s",
            (normalized_id,),
        )
        deleted = cur.rowcount or 0
    return bool(deleted)


def prune_expired_main_jobs() -> dict[str, int]:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_WRITE_MAIN:
        return {"deleted": 0}
    _ensure_schema()
    conn = _connect()
    native_cutoff = _utcnow() - timedelta(days=max(1, int(config.JOBS_POSTGRES_NATIVE_RETENTION_DAYS or 30)))
    imported_cutoff = _utcnow() - timedelta(days=max(1, int(config.JOBS_POSTGRES_IMPORTED_RETENTION_DAYS or 15)))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            DELETE FROM {config.JOBS_POSTGRES_JOBS_TABLE}
            WHERE
                (COALESCE(source_kind, 'native') = 'native' AND scraped_at < %s)
                OR
                (COALESCE(source_kind, 'native') <> 'native' AND scraped_at < %s)
            """,
            (native_cutoff, imported_cutoff),
        )
        deleted = cur.rowcount or 0
    return {"deleted": int(deleted)}


def upsert_jobspy_documents(documents: list[dict[str, Any]]) -> dict[str, int]:
    if not jobs_postgres_enabled():
        return {"imported_count": 0, "upserted_count": 0, "matched_count": 0}
    _ensure_schema()
    if not documents:
        return {"imported_count": 0, "upserted_count": 0, "matched_count": 0}
    conn = _connect()
    ids = [str(doc.get("_id") or "") for doc in documents if str(doc.get("_id") or "").strip()]
    existing_ids: set[str] = set()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id FROM {config.JOBS_POSTGRES_JOBSPY_TABLE} WHERE id = ANY(%s)",
            (ids,),
        )
        existing_ids = {str((row or {}).get("id") or "") for row in (cur.fetchall() or [])}
        cur.executemany(
            f"""
            INSERT INTO {config.JOBS_POSTGRES_JOBSPY_TABLE}
                (id, provider, source_site, title, company, location, city, state, country, country_code, job_type, interval, min_amount, max_amount, currency, job_url, description, is_remote, lat, lng, geocode_source, search_term, google_search_term, location_query, search_location_query, queried_sites, hours_old, query_hash, search_blob, raw_payload_json, payload_json, scraped_at, expires_at, updated_at)
            VALUES (%(id)s, %(provider)s, %(source_site)s, %(title)s, %(company)s, %(location)s, %(city)s, %(state)s, %(country)s, %(country_code)s, %(job_type)s, %(interval)s, %(min_amount)s, %(max_amount)s, %(currency)s, %(job_url)s, %(description)s, %(is_remote)s, %(lat)s, %(lng)s, %(geocode_source)s, %(search_term)s, %(google_search_term)s, %(location_query)s, %(search_location_query)s, %(queried_sites)s::jsonb, %(hours_old)s, %(query_hash)s, %(search_blob)s, %(raw_payload_json)s::jsonb, %(payload_json)s::jsonb, %(scraped_at)s, %(expires_at)s, %(updated_at)s)
            ON CONFLICT (id) DO UPDATE SET
                provider = EXCLUDED.provider,
                source_site = EXCLUDED.source_site,
                title = EXCLUDED.title,
                company = EXCLUDED.company,
                location = EXCLUDED.location,
                city = EXCLUDED.city,
                state = EXCLUDED.state,
                country = EXCLUDED.country,
                country_code = EXCLUDED.country_code,
                job_type = EXCLUDED.job_type,
                interval = EXCLUDED.interval,
                min_amount = EXCLUDED.min_amount,
                max_amount = EXCLUDED.max_amount,
                currency = EXCLUDED.currency,
                job_url = EXCLUDED.job_url,
                description = EXCLUDED.description,
                is_remote = EXCLUDED.is_remote,
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                geocode_source = EXCLUDED.geocode_source,
                search_term = EXCLUDED.search_term,
                google_search_term = EXCLUDED.google_search_term,
                location_query = EXCLUDED.location_query,
                search_location_query = EXCLUDED.search_location_query,
                queried_sites = EXCLUDED.queried_sites,
                hours_old = EXCLUDED.hours_old,
                query_hash = EXCLUDED.query_hash,
                search_blob = EXCLUDED.search_blob,
                raw_payload_json = EXCLUDED.raw_payload_json,
                payload_json = EXCLUDED.payload_json,
                scraped_at = EXCLUDED.scraped_at,
                expires_at = EXCLUDED.expires_at,
                updated_at = EXCLUDED.updated_at
            """,
            [
                {
                    "id": str(doc.get("_id") or ""),
                    "provider": str(doc.get("provider") or "jobspy"),
                    "source_site": doc.get("source_site"),
                    "title": doc.get("title"),
                    "company": doc.get("company"),
                    "location": doc.get("location"),
                    "city": doc.get("city"),
                    "state": doc.get("state"),
                    "country": doc.get("country"),
                    "country_code": doc.get("country_code"),
                    "job_type": doc.get("job_type"),
                    "interval": doc.get("interval"),
                    "min_amount": doc.get("min_amount"),
                    "max_amount": doc.get("max_amount"),
                    "currency": doc.get("currency"),
                    "job_url": doc.get("job_url"),
                    "description": doc.get("description"),
                    "is_remote": bool(doc.get("is_remote")),
                    "lat": doc.get("lat"),
                    "lng": doc.get("lng"),
                    "geocode_source": doc.get("geocode_source"),
                    "search_term": doc.get("search_term"),
                    "google_search_term": doc.get("google_search_term"),
                    "location_query": doc.get("location_query"),
                    "search_location_query": doc.get("search_location_query"),
                    "queried_sites": _json_dumps(doc.get("queried_sites") or []),
                    "hours_old": doc.get("hours_old"),
                    "query_hash": doc.get("query_hash"),
                    "search_blob": doc.get("search_blob"),
                    "raw_payload_json": _json_dumps(doc.get("raw_payload") or {}),
                    "payload_json": _json_dumps(doc),
                    "scraped_at": doc.get("scraped_at"),
                    "expires_at": doc.get("expires_at"),
                    "updated_at": doc.get("updated_at"),
                }
                for doc in documents
                if str(doc.get("_id") or "").strip()
            ],
        )
    matched_count = len(existing_ids)
    imported_count = len(ids)
    upserted_count = max(0, imported_count - matched_count)
    return {
        "imported_count": imported_count,
        "upserted_count": upserted_count,
        "matched_count": matched_count,
    }


def search_jobspy_documents(
    *,
    page: int = 0,
    page_size: int = 24,
    search_term: str = "",
    location: str = "",
    source_sites: list[str] | None = None,
    country_codes: list[str] | None = None,
    exclude_country_codes: list[str] | None = None,
    fresh_cutoff: datetime | None = None,
) -> dict[str, Any]:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_SERVE_EXTERNAL:
        return {"jobs": [], "total_count": 0, "has_more": False, "collection": config.JOBS_POSTGRES_JOBSPY_TABLE}
    _ensure_schema()
    conn = _connect()
    where_parts = ["expires_at > %s", "scraped_at >= %s"]
    params: list[Any] = [_utcnow(), fresh_cutoff or (_utcnow() - timedelta(days=21))]

    normalized_search = str(search_term or "").strip().lower()
    normalized_location = str(location or "").strip().lower()
    normalized_sites = [site.strip().lower() for site in (source_sites or []) if site and site.strip()]
    normalized_country_codes = [code.strip().upper() for code in (country_codes or []) if code and code.strip()]
    normalized_excluded_country_codes = [code.strip().upper() for code in (exclude_country_codes or []) if code and code.strip()]

    if normalized_search:
        where_parts.append("COALESCE(search_blob, '') ILIKE %s")
        params.append(f"%{normalized_search}%")
    if normalized_location:
        where_parts.append("COALESCE(location, '') ILIKE %s")
        params.append(f"%{normalized_location}%")
    if normalized_sites:
        where_parts.append("LOWER(COALESCE(source_site, '')) = ANY(%s)")
        params.append(normalized_sites)
    if normalized_country_codes:
        where_parts.append("UPPER(COALESCE(country_code, '')) = ANY(%s)")
        params.append(normalized_country_codes)
    if normalized_excluded_country_codes:
        where_parts.append("NOT (UPPER(COALESCE(country_code, '')) = ANY(%s))")
        params.append(normalized_excluded_country_codes)

    where_sql = " AND ".join(where_parts)
    offset = max(0, page) * max(1, page_size)
    limit = max(1, min(100, page_size))
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) AS count FROM {config.JOBS_POSTGRES_JOBSPY_TABLE} WHERE {where_sql}",
            params,
        )
        count_row = cur.fetchone() or {}
        total_count = int(count_row.get("count") or 0)
        cur.execute(
            f"""
            SELECT payload_json
            FROM {config.JOBS_POSTGRES_JOBSPY_TABLE}
            WHERE {where_sql}
            ORDER BY scraped_at DESC, updated_at DESC
            OFFSET %s LIMIT %s
            """,
            [*params, offset, limit],
        )
        rows = cur.fetchall() or []
    jobs = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), {})
        if isinstance(payload, dict):
            jobs.append(dict(payload))
    return {
        "jobs": jobs,
        "total_count": total_count,
        "has_more": (max(0, page) + 1) * limit < total_count,
        "collection": config.JOBS_POSTGRES_JOBSPY_TABLE,
    }


def read_recent_jobspy_documents(*, limit: int = 800, fresh_cutoff: datetime | None = None) -> list[dict[str, Any]]:
    if not jobs_postgres_enabled() or not config.JOBS_POSTGRES_SERVE_EXTERNAL:
        return []
    _ensure_schema()
    conn = _connect()
    cutoff = fresh_cutoff or (_utcnow() - timedelta(days=21))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT payload_json
            FROM {config.JOBS_POSTGRES_JOBSPY_TABLE}
            WHERE expires_at > %s
              AND scraped_at >= %s
            ORDER BY scraped_at DESC, updated_at DESC
            LIMIT %s
            """,
            (_utcnow(), cutoff, max(1, min(5000, int(limit or 800)))),
        )
        rows = cur.fetchall() or []
    jobs: list[dict[str, Any]] = []
    for row in rows:
        payload = _json_load((row or {}).get("payload_json"), {})
        if isinstance(payload, dict):
            jobs.append(dict(payload))
    return jobs


def backfill_jobspy_from_documents(documents: list[dict[str, Any]]) -> dict[str, int]:
    return upsert_jobspy_documents(documents)


def backfill_jobs_from_documents(documents: list[dict[str, Any]]) -> dict[str, int]:
    return upsert_jobs_documents(documents)


def get_jobs_postgres_health() -> dict[str, Any]:
    info: dict[str, Any] = {
        "enabled": jobs_postgres_enabled(),
        "url_configured": bool(config.JOBS_POSTGRES_URL),
        "jobs_table": config.JOBS_POSTGRES_JOBS_TABLE,
        "external_cache_table": config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE,
        "jobspy_table": config.JOBS_POSTGRES_JOBSPY_TABLE,
        "serve_main": bool(config.JOBS_POSTGRES_SERVE_MAIN),
        "write_main": bool(config.JOBS_POSTGRES_WRITE_MAIN),
        "native_retention_days": int(config.JOBS_POSTGRES_NATIVE_RETENTION_DAYS),
        "imported_retention_days": int(config.JOBS_POSTGRES_IMPORTED_RETENTION_DAYS),
    }
    if not jobs_postgres_enabled():
        return info
    try:
        _ensure_schema()
        conn = _connect()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
            cur.execute(f"SELECT COUNT(*) AS count FROM {config.JOBS_POSTGRES_JOBS_TABLE}")
            jobs_count = int((cur.fetchone() or {}).get("count") or 0)
            cur.execute(f"SELECT COUNT(*) AS count FROM {config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE}")
            external_count = int((cur.fetchone() or {}).get("count") or 0)
            cur.execute(f"SELECT COUNT(*) AS count FROM {config.JOBS_POSTGRES_JOBSPY_TABLE}")
            jobspy_count = int((cur.fetchone() or {}).get("count") or 0)
        info.update({
            "ok": True,
            "counts": {
                "jobs": jobs_count,
                "external_cache": external_count,
                "jobspy": jobspy_count,
            },
        })
        return info
    except Exception as exc:
        info.update({
            "ok": False,
            "error": exc.__class__.__name__,
            "message": str(exc),
        })
        return info


def ensure_jobs_postgres_schema() -> dict[str, Any]:
    if not jobs_postgres_enabled():
        return {
            "enabled": False,
            "url_configured": bool(config.JOBS_POSTGRES_URL),
        }
    _ensure_schema()
    return {
        "enabled": True,
        "jobs_table": config.JOBS_POSTGRES_JOBS_TABLE,
        "external_cache_table": config.JOBS_POSTGRES_EXTERNAL_CACHE_TABLE,
        "jobspy_table": config.JOBS_POSTGRES_JOBSPY_TABLE,
    }
