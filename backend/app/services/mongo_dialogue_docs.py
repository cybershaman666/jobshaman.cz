from __future__ import annotations

from typing import Any

from pymongo import MongoClient

try:
    import certifi

    _CA_FILE = certifi.where()
except Exception:
    _CA_FILE = None

from ..core import config

_mongo_client: MongoClient | None = None


def _get_client() -> MongoClient | None:
    global _mongo_client
    if not config.MONGODB_URI:
        return None
    if _mongo_client is None:
        kwargs = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 10000,
            "retryWrites": True,
        }
        if _CA_FILE:
            kwargs["tlsCAFile"] = _CA_FILE
        _mongo_client = MongoClient(config.MONGODB_URI, **kwargs)
    return _mongo_client


def _get_collection(name: str):
    client = _get_client()
    if client is None:
        return None
    return client[config.MONGODB_DB][name]


def _safe_find_one(collection_name: str, filter_query: dict[str, Any], sort_field: str = "generated_at") -> dict[str, Any] | None:
    collection = _get_collection(collection_name)
    if collection is None:
        return None
    try:
        doc = collection.find_one(filter_query, sort=[(sort_field, -1)])
    except Exception:
        return None
    if not isinstance(doc, dict):
        return None
    doc.pop("_id", None)
    return doc


def get_dialogue_ai_summary(dialogue_id: str) -> dict[str, Any] | None:
    if not dialogue_id:
        return None
    return _safe_find_one(
        config.MONGODB_DIALOGUE_AI_SUMMARIES_COLLECTION,
        {"dialogue_id": dialogue_id},
    )


def get_dialogue_fit_evidence(dialogue_id: str) -> dict[str, Any] | None:
    if not dialogue_id:
        return None
    return _safe_find_one(
        config.MONGODB_DIALOGUE_FIT_EVIDENCE_COLLECTION,
        {"dialogue_id": dialogue_id},
    )


def get_dialogue_transcript(dialogue_id: str, message_id: str | None = None, asset_id: str | None = None) -> dict[str, Any] | None:
    if not dialogue_id:
        return None
    filter_query: dict[str, Any] = {"dialogue_id": dialogue_id}
    if message_id:
        filter_query["message_id"] = message_id
    if asset_id:
        filter_query["asset_id"] = asset_id
    return _safe_find_one(
        config.MONGODB_DIALOGUE_TRANSCRIPTS_COLLECTION,
        filter_query,
    )
