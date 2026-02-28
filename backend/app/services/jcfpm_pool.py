from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from pymongo import ASCENDING, MongoClient
from pymongo.collection import Collection

from ..core import config
from ..core.database import supabase

_POOL_METRICS = {
    "requests_total": 0,
    "mongo_hits": 0,
    "supabase_hits": 0,
    "fallback_count": 0,
}


@dataclass
class JcfpmItemsFetchResult:
    items: list[dict]
    source: str
    latency_ms: int
    fallback_used: bool
    fallback_reason: str | None = None


def _fetch_items_from_supabase() -> list[dict]:
    if not supabase:
        raise RuntimeError("Supabase client not initialized - verify SUPABASE_URL and SUPABASE_SERVICE_KEY")

    page_size = 1000
    offset = 0
    all_rows: list[dict] = []

    while True:
        resp = (
            supabase
            .table("jcfpm_items")
            .select("id, dimension, subdimension, prompt, prompt_i18n, subdimension_i18n, reverse_scoring, sort_order, item_type, payload, payload_i18n, assets, pool_key, variant_index")
            .order("sort_order", desc=False)
            .order("id", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not resp:
            raise RuntimeError("Supabase query returned no response object")
        
        page = resp.data or []
        all_rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    return all_rows


def _mongo_collection() -> Collection:
    if not config.MONGODB_URI:
        raise RuntimeError("MONGODB_URI missing")
    client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=3000)
    db = client[config.MONGODB_DB]
    return db[config.MONGODB_JCFPM_COLLECTION]


def _fetch_items_from_mongo() -> list[dict]:
    coll = _mongo_collection()
    docs = list(
        coll.find(
            {"status": {"$in": ["active", None]}},
            {
                "_id": 0,
                "id": 1,
                "dimension": 1,
                "subdimension": 1,
                "prompt": 1,
                "prompt_i18n": 1,
                "subdimension_i18n": 1,
                "reverse_scoring": 1,
                "sort_order": 1,
                "item_type": 1,
                "payload": 1,
                "payload_i18n": 1,
                "assets": 1,
                "pool_key": 1,
                "variant_index": 1,
            },
        ).sort([("sort_order", ASCENDING), ("id", ASCENDING)])
    )
    return docs


def fetch_jcfpm_items() -> JcfpmItemsFetchResult:
    _POOL_METRICS["requests_total"] += 1
    provider = config.JCFPM_ITEMS_PROVIDER
    started = time.perf_counter()

    if provider == "supabase":
        items = _fetch_items_from_supabase()
        _POOL_METRICS["supabase_hits"] += 1
        return JcfpmItemsFetchResult(
            items=items,
            source="supabase",
            latency_ms=round((time.perf_counter() - started) * 1000),
            fallback_used=False,
        )

    if provider == "mongo":
        items = _fetch_items_from_mongo()
        _POOL_METRICS["mongo_hits"] += 1
        return JcfpmItemsFetchResult(
            items=items,
            source="mongo",
            latency_ms=round((time.perf_counter() - started) * 1000),
            fallback_used=False,
        )

    # auto => Mongo primary + Supabase fallback
    mongo_started = time.perf_counter()
    try:
        mongo_items = _fetch_items_from_mongo()
        if mongo_items:
            _POOL_METRICS["mongo_hits"] += 1
            return JcfpmItemsFetchResult(
                items=mongo_items,
                source="mongo",
                latency_ms=round((time.perf_counter() - mongo_started) * 1000),
                fallback_used=False,
            )
        fallback_reason = "mongo_empty"
    except Exception as exc:  # pragma: no cover - best effort diagnostics
        fallback_reason = f"mongo_error:{type(exc).__name__}"

    supa_started = time.perf_counter()
    try:
        supa_items = _fetch_items_from_supabase()
        _POOL_METRICS["supabase_hits"] += 1
        _POOL_METRICS["fallback_count"] += 1
        return JcfpmItemsFetchResult(
            items=supa_items,
            source="supabase",
            latency_ms=round((time.perf_counter() - supa_started) * 1000),
            fallback_used=True,
            fallback_reason=fallback_reason,
        )
    except Exception as exc:
        raise RuntimeError(f"Fetch failed: {fallback_reason} AND supabase_error:{type(exc).__name__}: {str(exc)}")


def jcfpm_pool_diagnostics() -> dict[str, Any]:
    details: dict[str, Any] = {
        "provider_mode": config.JCFPM_ITEMS_PROVIDER,
        "mongodb_configured": bool(config.MONGODB_URI),
        "mongodb_db": config.MONGODB_DB,
        "mongodb_collection": config.MONGODB_JCFPM_COLLECTION,
    }
    try:
        fetched = fetch_jcfpm_items()
        details.update({
            "source": fetched.source,
            "latency_ms": fetched.latency_ms,
            "fallback_used": fetched.fallback_used,
            "fallback_reason": fetched.fallback_reason,
            "total_items": len(fetched.items),
        })
    except Exception as exc:
        details.update({
            "source": None,
            "latency_ms": None,
            "fallback_used": None,
            "fallback_reason": f"fetch_failed:{type(exc).__name__}",
            "total_items": 0,
        })
    return details


def jcfpm_pool_metrics() -> dict[str, int]:
    return dict(_POOL_METRICS)
