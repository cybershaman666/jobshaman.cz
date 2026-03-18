from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from pymongo import ASCENDING, DESCENDING, MongoClient, UpdateOne
from pymongo.collection import Collection

try:
    import certifi

    _CA_FILE = certifi.where()
except Exception:
    _CA_FILE = None

from ..core import config
from .jobs_postgres_store import (
    backfill_jobs_from_documents,
    backfill_jobspy_from_documents,
    get_jobs_postgres_health,
    jobs_postgres_enabled,
    search_jobspy_documents,
)

_mongo_client: MongoClient | None = None
_indexes_ready = False
_JOBSPY_MAX_AGE_DAYS = 21

_COUNTRY_CODE_ALIASES = {
    "austria": "AT",
    "at": "AT",
    "germany": "DE",
    "de": "DE",
    "deutschland": "DE",
    "czech republic": "CZ",
    "czechia": "CZ",
    "cesko": "CZ",
    "česko": "CZ",
    "cz": "CZ",
    "slovakia": "SK",
    "slovensko": "SK",
    "sk": "SK",
    "poland": "PL",
    "polska": "PL",
    "pl": "PL",
}

_COUNTRY_NAMES_BY_CODE = {
    "AT": ["austria", "osterreich", "österreich"],
    "DE": ["germany", "deutschland"],
    "CZ": ["czech republic", "czechia", "cesko", "česko"],
    "SK": ["slovakia", "slovensko"],
    "PL": ["poland", "polska"],
}


def _load_jobspy_scrape_jobs():
    try:
        from jobspy import scrape_jobs as _scrape_jobs
    except Exception as exc:
        raise RuntimeError(
            "python-jobspy is not installed in the backend runtime. "
            "Install backend dependencies in backend/venv, including python-jobspy and pandas."
        ) from exc
    return _scrape_jobs


def _load_geocode_location():
    errors: list[Exception] = []
    for import_target in ("backend.geocoding", "geocoding"):
        try:
            module = __import__(import_target, fromlist=["geocode_location"])
            return getattr(module, "geocode_location")
        except Exception as exc:
            errors.append(exc)
    raise RuntimeError(
        "Backend geocoding module is not available. "
        "Expected geocode_location in backend.geocoding or geocoding."
    ) from (errors[-1] if errors else None)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fresh_cutoff() -> datetime:
    return _utcnow() - timedelta(days=_JOBSPY_MAX_AGE_DAYS)


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _coerce_amount(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except Exception:
        return None


def _jobspy_document_to_jobs_row(document: dict[str, Any]) -> dict[str, Any]:
    source_site = _safe_str(document.get("source_site") or document.get("provider") or "jobspy")
    location = _safe_str(document.get("location") or document.get("search_location_query") or "Remote")
    title = _safe_str(document.get("title") or "Role")
    company = _safe_str(document.get("company") or "Unknown company")
    description = _safe_str(document.get("description") or title)
    tags = [value for value in [
        source_site,
        _safe_str(document.get("job_type")),
        _safe_str(document.get("interval")),
    ] if value]
    work_model = "Remote" if bool(document.get("is_remote")) else "On-site"
    return {
        "id": _safe_str(document.get("_id")),
        "company_id": None,
        "posted_by": None,
        "recruiter_id": None,
        "title": title,
        "company": company,
        "location": location or "Remote",
        "description": description,
        "benefits": [],
        "tags": tags[:8],
        "contract_type": _safe_str(document.get("job_type")) or None,
        "salary_from": _coerce_amount(document.get("min_amount")),
        "salary_to": _coerce_amount(document.get("max_amount")),
        "salary_timeframe": _safe_str(document.get("interval")) or "month",
        "salary_currency": _safe_str(document.get("currency")) or "EUR",
        "currency": _safe_str(document.get("currency")) or "EUR",
        "work_type": work_model,
        "work_model": work_model,
        "source": source_site,
        "source_kind": "external",
        "url": _safe_str(document.get("job_url")),
        "education_level": None,
        "lat": document.get("lat"),
        "lng": document.get("lng"),
        "country_code": _safe_str(document.get("country_code")) or None,
        "language_code": "en",
        "legality_status": "legal",
        "verification_notes": f"JobSpy import from {source_site}",
        "status": "active",
        "is_active": True,
        "created_at": document.get("scraped_at"),
        "scraped_at": document.get("scraped_at"),
        "updated_at": document.get("updated_at"),
    }


def _sanitize_for_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _sanitize_for_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_sanitize_for_json(item) for item in value]
    if isinstance(value, float) and math.isnan(value):
        return None
    if hasattr(value, "item") and callable(value.item):
        try:
            return _sanitize_for_json(value.item())
        except Exception:
            pass
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _normalize_sites(site_name: str | list[str] | None) -> list[str]:
    if site_name is None:
        return []
    if isinstance(site_name, str):
        return [site_name.strip()] if site_name.strip() else []
    result: list[str] = []
    for item in site_name:
        normalized = _safe_str(item)
        if normalized:
            result.append(normalized)
    return result


def _build_mongo_client_kwargs(*, use_certifi_ca: bool) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "serverSelectionTimeoutMS": 5000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 10000,
        "retryWrites": True,
        "tls": True,
    }
    if use_certifi_ca and _CA_FILE:
        kwargs["tlsCAFile"] = _CA_FILE
    return kwargs


def _create_verified_client() -> MongoClient:
    if not config.MONGODB_URI:
        raise RuntimeError("MONGODB_URI missing")

    attempts: list[tuple[str, dict[str, Any]]] = [("certifi", _build_mongo_client_kwargs(use_certifi_ca=True))]
    if _CA_FILE:
        attempts.append(("system", _build_mongo_client_kwargs(use_certifi_ca=False)))

    last_error: Exception | None = None
    for label, kwargs in attempts:
        client = MongoClient(config.MONGODB_URI, **kwargs)
        try:
            client.admin.command("ping")
            if label == "system":
                print("ℹ️ JobSpy Mongo connected using system CA trust store fallback")
            return client
        except Exception as exc:
            last_error = exc
            try:
                client.close()
            except Exception:
                pass
            if label == "certifi":
                print(f"⚠️ JobSpy Mongo certifi TLS bootstrap failed, retrying with system CA store: {exc}")
    if last_error is not None:
        raise last_error
    raise RuntimeError("Failed to initialize MongoDB client")


def _get_client() -> MongoClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = _create_verified_client()
    return _mongo_client


def _get_collection() -> Collection:
    global _indexes_ready
    client = _get_client()
    collection = client[config.MONGODB_DB][config.MONGODB_JOBSPY_COLLECTION]
    if not _indexes_ready:
        collection.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        collection.create_index([("scraped_at", DESCENDING)])
        collection.create_index([("source_site", ASCENDING), ("scraped_at", DESCENDING)])
        collection.create_index([("query_hash", ASCENDING), ("scraped_at", DESCENDING)])
        _indexes_ready = True
    return collection


def _normalize_payload_row(row: dict[str, Any]) -> dict[str, Any]:
    lowered: dict[str, Any] = {}
    for key, value in row.items():
        lowered[str(key).strip().lower()] = _sanitize_for_json(value)
    return lowered


def _coerce_float(value: Any) -> float | None:
    sanitized = _sanitize_for_json(value)
    if sanitized in (None, ""):
        return None
    try:
        return float(sanitized)
    except Exception:
        return None


def _normalize_country_code(value: Any) -> str | None:
    normalized = _safe_str(value).lower()
    if not normalized:
        return None
    if normalized in _COUNTRY_CODE_ALIASES:
        return _COUNTRY_CODE_ALIASES[normalized]
    if len(normalized) == 2 and normalized.isalpha():
        return normalized.upper()
    return None


def _build_geocode_candidates(
    *,
    city: str,
    state: str,
    country: str,
    location_query: str,
) -> list[str]:
    candidates: list[str] = []
    for value in (
        ", ".join([part for part in [city, state, country] if part]),
        ", ".join([part for part in [city, country] if part]),
        ", ".join([part for part in [state, country] if part]),
        _safe_str(location_query),
        city,
    ):
        normalized = _safe_str(value)
        if normalized and normalized not in candidates:
            candidates.append(normalized)
    return candidates


def _resolve_job_location_query(
    *,
    row: dict[str, Any],
    city: str,
    state: str,
    country: str,
    fallback_query: str,
) -> str:
    raw_location = _safe_str(
        row.get("location")
        or row.get("job_location")
        or row.get("location_name")
        or row.get("job_geo")
    )
    if raw_location:
        return raw_location

    composed_location = ", ".join([part for part in [city, state, country] if part])
    if composed_location:
        return composed_location

    return _safe_str(fallback_query)


def _resolve_job_geocode(
    *,
    city: str,
    state: str,
    country: str,
    location_query: str,
    is_remote: bool,
) -> tuple[float | None, float | None, str | None, str | None]:
    if is_remote:
        return None, None, None, None

    geocode_location = _load_geocode_location()
    for candidate in _build_geocode_candidates(
        city=city,
        state=state,
        country=country,
        location_query=location_query,
    ):
        try:
            geo = geocode_location(candidate)
        except Exception:
            geo = None
        if not isinstance(geo, dict):
            continue
        try:
            lat = float(geo.get("lat"))
            lon = float(geo.get("lon"))
        except Exception:
            continue
        geo_country_code = _normalize_country_code(geo.get("country"))
        return lat, lon, geo_country_code, _safe_str(geo.get("source")) or None

    return None, None, None, None


def _build_job_document(
    raw_row: dict[str, Any],
    *,
    sites: list[str],
    search_term: str,
    google_search_term: str,
    location: str,
    country_indeed: str,
    hours_old: int | None,
    job_type: str,
    is_remote: bool,
    queried_at: datetime,
    expires_at: datetime,
) -> dict[str, Any]:
    row = _normalize_payload_row(raw_row)
    source_site = _safe_str(row.get("site") or row.get("source") or row.get("site_name")).lower()
    title = _safe_str(row.get("title"))
    company = _safe_str(row.get("company"))
    city = _safe_str(row.get("city"))
    state = _safe_str(row.get("state"))
    country = _safe_str(row.get("country") or country_indeed)
    country_code = _normalize_country_code(country or country_indeed)
    location_query = _resolve_job_location_query(
        row=row,
        city=city,
        state=state,
        country=country,
        fallback_query=location,
    )
    location_label = location_query or ", ".join([part for part in [city, state, country] if part])
    job_url = _safe_str(row.get("job_url") or row.get("url") or row.get("job_url_direct"))
    description = _safe_str(row.get("description"))
    remote_flag = bool(row.get("is_remote")) or is_remote
    lat, lng, geocoded_country_code, geocode_source = _resolve_job_geocode(
        city=city,
        state=state,
        country=country,
        location_query=location_query,
        is_remote=remote_flag,
    )
    dedupe_input = "|".join(
        [
            source_site,
            job_url,
            title.lower(),
            company.lower(),
            location_label.lower(),
        ]
    )
    doc_id = hashlib.sha1(dedupe_input.encode("utf-8")).hexdigest()
    search_blob = " ".join(
        [
            title,
            company,
            location_label,
            description,
            _safe_str(search_term),
            _safe_str(google_search_term),
        ]
    ).lower()
    return {
        "_id": doc_id,
        "provider": "jobspy",
        "source_site": source_site or "unknown",
        "title": title,
        "company": company,
        "location": location_label,
        "city": city or None,
        "state": state or None,
        "country": country or None,
        "country_code": geocoded_country_code or country_code,
        "country_indeed": _safe_str(country_indeed) or None,
        "job_type": _safe_str(row.get("job_type") or job_type) or None,
        "interval": _safe_str(row.get("interval")) or None,
        "min_amount": _coerce_float(row.get("min_amount")),
        "max_amount": _coerce_float(row.get("max_amount")),
        "currency": _safe_str(row.get("currency")) or None,
        "job_url": job_url or None,
        "description": description or None,
        "is_remote": remote_flag,
        "lat": lat,
        "lng": lng,
        "geocode_source": geocode_source,
        "search_term": _safe_str(search_term) or None,
        "google_search_term": _safe_str(google_search_term) or None,
        "location_query": location_query or None,
        "search_location_query": _safe_str(location) or None,
        "queried_sites": sites,
        "hours_old": hours_old,
        "query_hash": hashlib.sha1(
            "|".join(
                [
                    ",".join(sorted(sites)),
                    _safe_str(search_term).lower(),
                    _safe_str(google_search_term).lower(),
                    _safe_str(location).lower(),
                    _safe_str(country_indeed).lower(),
                    _safe_str(job_type).lower(),
                    "remote" if is_remote else "onsite_or_unknown",
                    str(hours_old or ""),
                ]
            ).encode("utf-8")
        ).hexdigest(),
        "search_blob": search_blob,
        "scraped_at": queried_at,
        "expires_at": expires_at,
        "updated_at": queried_at,
        "raw_payload": row,
    }


@dataclass
class JobSpyImportResult:
    imported_count: int
    upserted_count: int
    matched_count: int
    query_hash: str
    collection: str
    sampled_jobs: list[dict[str, Any]]


def import_jobspy_jobs(
    *,
    site_name: str | list[str] | None,
    search_term: str,
    google_search_term: str = "",
    location: str = "",
    results_wanted: int = 20,
    hours_old: int | None = None,
    country_indeed: str = "",
    job_type: str = "",
    is_remote: bool = False,
    linkedin_fetch_description: bool = False,
    description_format: str = "markdown",
    verbose: int = 0,
    offset: int = 0,
) -> JobSpyImportResult:
    scrape_jobs = _load_jobspy_scrape_jobs()

    queried_at = _utcnow()
    expires_at = queried_at + timedelta(days=max(1, config.MONGODB_JOBSPY_TTL_DAYS))
    sites = _normalize_sites(site_name)

    jobs_df = scrape_jobs(
        site_name=sites or None,
        search_term=_safe_str(search_term) or None,
        google_search_term=_safe_str(google_search_term) or None,
        location=_safe_str(location) or None,
        results_wanted=max(1, min(200, int(results_wanted or 20))),
        hours_old=hours_old,
        country_indeed=_safe_str(country_indeed) or "usa",
        job_type=_safe_str(job_type) or None,
        is_remote=bool(is_remote),
        linkedin_fetch_description=bool(linkedin_fetch_description),
        description_format=_safe_str(description_format) or "markdown",
        verbose=max(0, min(2, int(verbose or 0))),
        offset=max(0, int(offset or 0)),
    )

    records = jobs_df.to_dict(orient="records") if jobs_df is not None else []
    documents = [
        _build_job_document(
            record,
            sites=sites,
            search_term=search_term,
            google_search_term=google_search_term,
            location=location,
            country_indeed=country_indeed,
            hours_old=hours_old,
            job_type=job_type,
            is_remote=is_remote,
            queried_at=queried_at,
            expires_at=expires_at,
        )
        for record in records
        if isinstance(record, dict)
    ]

    upserted_count = 0
    matched_count = 0
    storage_errors: list[Exception] = []

    if documents:
        if jobs_postgres_enabled():
            try:
                pg_result = backfill_jobspy_from_documents(documents)
                upserted_count = int(pg_result.get("upserted_count") or 0)
                matched_count = int(pg_result.get("matched_count") or 0)
            except Exception as exc:
                storage_errors.append(exc)
                print(f"⚠️ Failed to persist JobSpy docs to Jobs Postgres: {exc}")
            try:
                backfill_jobs_from_documents([
                    _jobspy_document_to_jobs_row(document)
                    for document in documents
                    if isinstance(document, dict) and _safe_str(document.get("_id"))
                ])
            except Exception as exc:
                storage_errors.append(exc)
                print(f"⚠️ Failed to mirror JobSpy docs into Jobs main table: {exc}")

        if config.MONGODB_URI:
            try:
                collection = _get_collection()
                operations = [
                    UpdateOne(
                        {"_id": document["_id"]},
                        {"$set": document},
                        upsert=True,
                    )
                    for document in documents
                ]
                result = collection.bulk_write(operations, ordered=False)
                if not jobs_postgres_enabled():
                    upserted_count = int(result.upserted_count or 0)
                    matched_count = int(result.matched_count or 0)
            except Exception as exc:
                storage_errors.append(exc)
                print(f"⚠️ Failed to persist JobSpy docs to Mongo: {exc}")

        if storage_errors and upserted_count == 0 and matched_count == 0:
            raise storage_errors[-1]

    sampled_jobs = [serialize_jobspy_job(doc) for doc in documents[:5]]
    query_hash = documents[0]["query_hash"] if documents else hashlib.sha1(b"empty").hexdigest()
    return JobSpyImportResult(
        imported_count=len(documents),
        upserted_count=upserted_count,
        matched_count=matched_count,
        query_hash=query_hash,
        collection=config.MONGODB_JOBSPY_COLLECTION,
        sampled_jobs=sampled_jobs,
    )


def search_jobspy_jobs(
    *,
    page: int = 0,
    page_size: int = 24,
    search_term: str = "",
    location: str = "",
    source_sites: list[str] | None = None,
    country_codes: list[str] | None = None,
    exclude_country_codes: list[str] | None = None,
) -> dict[str, Any]:
    if jobs_postgres_enabled():
        try:
            return search_jobspy_documents(
                page=page,
                page_size=page_size,
                search_term=search_term,
                location=location,
                source_sites=source_sites,
                country_codes=country_codes,
                exclude_country_codes=exclude_country_codes,
                fresh_cutoff=_fresh_cutoff(),
            )
        except Exception as exc:
            print(f"⚠️ Jobs Postgres JobSpy search unavailable: {exc}")
            return {
                "jobs": [],
                "total_count": 0,
                "has_more": False,
                "collection": config.JOBS_POSTGRES_JOBSPY_TABLE,
                "provider": "jobspy",
                "storage": "jobs_postgres",
                "error": exc.__class__.__name__,
            }

    collection = _get_collection()
    query: dict[str, Any] = {
        "expires_at": {"$gt": _utcnow()},
        "scraped_at": {"$gte": _fresh_cutoff()},
    }

    normalized_search = _safe_str(search_term).lower()
    normalized_location = _safe_str(location).lower()
    if normalized_search:
        query["search_blob"] = {"$regex": normalized_search, "$options": "i"}
    if normalized_location:
        query["location"] = {"$regex": normalized_location, "$options": "i"}
    normalized_sites = [site.strip().lower() for site in (source_sites or []) if site and site.strip()]
    if normalized_sites:
        query["source_site"] = {"$in": normalized_sites}
    normalized_country_codes = [code.strip().upper() for code in (country_codes or []) if code and code.strip()]
    normalized_excluded_country_codes = [code.strip().upper() for code in (exclude_country_codes or []) if code and code.strip()]
    if normalized_country_codes:
        country_name_patterns = [
            {"country": {"$regex": f"^{name}$", "$options": "i"}}
            for code in normalized_country_codes
            for name in _COUNTRY_NAMES_BY_CODE.get(code, [])
        ]
        query["$or"] = [{"country_code": {"$in": normalized_country_codes}}, *country_name_patterns]
    if normalized_excluded_country_codes:
        query.setdefault("$and", [])
        query["$and"].append({"country_code": {"$nin": normalized_excluded_country_codes}})
        excluded_patterns = [
            {"country": {"$not": {"$regex": f"^{name}$", "$options": "i"}}}
            for code in normalized_excluded_country_codes
            for name in _COUNTRY_NAMES_BY_CODE.get(code, [])
        ]
        query["$and"].extend(excluded_patterns)

    total_count = collection.count_documents(query)
    cursor = (
        collection.find(query, {"raw_payload": 0})
        .sort([("scraped_at", DESCENDING), ("updated_at", DESCENDING)])
        .skip(max(0, page) * max(1, page_size))
        .limit(max(1, min(100, page_size)))
    )
    jobs = [serialize_jobspy_job(item) for item in cursor]
    return {
        "jobs": jobs,
        "total_count": int(total_count),
        "has_more": (max(0, page) + 1) * max(1, page_size) < int(total_count),
        "collection": config.MONGODB_JOBSPY_COLLECTION,
    }


def backfill_jobspy_geocoding(*, limit: int = 200, only_missing: bool = True) -> dict[str, Any]:
    collection = _get_collection()
    query: dict[str, Any] = {"expires_at": {"$gt": _utcnow()}}
    if only_missing:
        query["$or"] = [
            {"lat": {"$exists": False}},
            {"lat": None},
            {"lng": {"$exists": False}},
            {"lng": None},
        ]

    cursor = (
        collection.find(
            query,
            {
                "_id": 1,
                "city": 1,
                "state": 1,
                "location": 1,
                "country": 1,
                "country_code": 1,
                "location_query": 1,
                "is_remote": 1,
            },
        )
        .sort([("updated_at", DESCENDING), ("scraped_at", DESCENDING)])
        .limit(max(1, min(2000, int(limit or 200))))
    )

    updated = 0
    skipped = 0
    scanned = 0
    for row in cursor:
        scanned += 1
        lat, lng, geocoded_country_code, geocode_source = _resolve_job_geocode(
            city=_safe_str(row.get("city")),
            state=_safe_str(row.get("state")),
            country=_safe_str(row.get("country")),
            location_query=_safe_str(row.get("location_query") or row.get("location")),
            is_remote=bool(row.get("is_remote")),
        )
        if lat is None or lng is None:
            skipped += 1
            continue

        patch: dict[str, Any] = {
            "lat": lat,
            "lng": lng,
            "updated_at": _utcnow(),
        }
        if geocoded_country_code:
            patch["country_code"] = geocoded_country_code
        if geocode_source:
            patch["geocode_source"] = geocode_source
        collection.update_one({"_id": row["_id"]}, {"$set": patch})
        updated += 1

    return {
        "collection": config.MONGODB_JOBSPY_COLLECTION,
        "scanned": scanned,
        "updated": updated,
        "skipped": skipped,
        "only_missing": only_missing,
    }


def backfill_jobspy_postgres_from_mongo(*, limit: int = 1000, only_fresh: bool = True) -> dict[str, Any]:
    if not jobs_postgres_enabled():
        return {
            "collection": config.MONGODB_JOBSPY_COLLECTION,
            "jobs_postgres_enabled": False,
            "scanned": 0,
            "imported": 0,
        }

    collection = _get_collection()
    query: dict[str, Any] = {}
    if only_fresh:
        query["expires_at"] = {"$gt": _utcnow()}
        query["scraped_at"] = {"$gte": _fresh_cutoff()}

    cursor = collection.find(
        query,
        {"raw_payload": 1},
    ).limit(max(1, min(10000, int(limit or 1000))))
    documents: list[dict[str, Any]] = []
    try:
        for row in cursor:
            if isinstance(row, dict):
                documents.append(dict(row))
    finally:
        try:
            cursor.close()
        except Exception:
            pass
    pg_result = backfill_jobspy_from_documents(documents)
    return {
        "collection": config.MONGODB_JOBSPY_COLLECTION,
        "jobs_postgres_table": config.JOBS_POSTGRES_JOBSPY_TABLE,
        "jobs_postgres_enabled": True,
        "scanned": len(documents),
        "imported": int(pg_result.get("imported_count") or 0),
        "upserted": int(pg_result.get("upserted_count") or 0),
        "matched": int(pg_result.get("matched_count") or 0),
        "only_fresh": only_fresh,
    }


def get_jobspy_storage_health() -> dict[str, Any]:
    info: dict[str, Any] = {
        "provider": "jobspy",
        "mongodb_configured": bool(config.MONGODB_URI),
        "jobs_postgres": get_jobs_postgres_health(),
        "mongodb_db": config.MONGODB_DB,
        "collections": {
            "raw": config.MONGODB_JOBSPY_COLLECTION,
            "enriched": config.MONGODB_JOBSPY_ENRICHED_COLLECTION,
            "companies": config.MONGODB_JOBSPY_COMPANY_COLLECTION,
        },
    }
    if not config.MONGODB_URI:
        info.update({
            "ok": False,
            "error": "RuntimeError",
            "message": "MONGODB_URI missing",
        })
        return info

    try:
        client = _get_client()
        ping_result = client.admin.command("ping")
        db = client[config.MONGODB_DB]
        raw_collection = db[config.MONGODB_JOBSPY_COLLECTION]
        enriched_collection = db[config.MONGODB_JOBSPY_ENRICHED_COLLECTION]
        company_collection = db[config.MONGODB_JOBSPY_COMPANY_COLLECTION]
        fresh_cutoff = _fresh_cutoff()
        info.update({
            "ok": True,
            "ping": _sanitize_for_json(ping_result),
            "counts": {
                "raw_total": int(raw_collection.count_documents({})),
                "raw_fresh": int(raw_collection.count_documents({"scraped_at": {"$gte": fresh_cutoff}})),
                "enriched_total": int(enriched_collection.count_documents({})),
                "companies_total": int(company_collection.count_documents({})),
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


def serialize_jobspy_job(document: dict[str, Any]) -> dict[str, Any]:
    payload = dict(document)
    payload.pop("_id", None)
    for key in ("scraped_at", "expires_at", "updated_at"):
        value = payload.get(key)
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
    payload.setdefault("id", f"jobspy-{_safe_str(document.get('_id'))}")
    payload.setdefault("source", f"jobspy:{_safe_str(payload.get('source_site') or 'unknown')}")
    payload.setdefault("url", payload.get("job_url"))
    payload.setdefault("salary_from", payload.get("min_amount"))
    payload.setdefault("salary_to", payload.get("max_amount"))
    payload.setdefault("salary_timeframe", payload.get("interval"))
    payload.setdefault("contract_type", payload.get("job_type"))
    payload.setdefault("work_type", "Remote" if payload.get("is_remote") else "On-site")
    payload.setdefault("work_model", "remote" if payload.get("is_remote") else "onsite")
    payload.setdefault("language_code", None)
    payload.setdefault("legality_status", "legal")
    payload.setdefault("verification_notes", "external_jobspy_import")
    return payload
