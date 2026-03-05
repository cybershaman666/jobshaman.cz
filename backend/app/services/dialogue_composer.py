from __future__ import annotations

from typing import Any

from ..core.database import supabase
from .mongo_dialogue_docs import (
    get_dialogue_ai_summary,
    get_dialogue_fit_evidence,
    get_dialogue_transcript,
)


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _normalize_asset(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    asset_id = str(item.get("asset_id") or item.get("id") or "").strip()
    url = str(item.get("url") or item.get("download_url") or "").strip()
    name = str(item.get("name") or item.get("filename") or "").strip()
    if not asset_id and not url:
        return None
    out = {
        "id": asset_id or None,
        "asset_id": asset_id or None,
        "name": name or "Attachment",
        "url": url or None,
        "path": item.get("path") or item.get("object_key"),
        "size": item.get("size") or item.get("size_bytes"),
        "size_bytes": item.get("size_bytes") or item.get("size"),
        "content_type": item.get("content_type") or item.get("mime_type"),
        "mime_type": item.get("mime_type") or item.get("content_type"),
        "provider": item.get("provider") or item.get("storage_provider"),
        "storage_provider": item.get("storage_provider") or item.get("provider"),
        "bucket": item.get("bucket"),
        "object_key": item.get("object_key") or item.get("path"),
        "kind": item.get("kind") or "attachment",
        "download_url": item.get("download_url") or item.get("url"),
        "transcript_status": item.get("transcript_status") or ("pending" if str(item.get("kind") or "").lower() == "audio" else "not_applicable"),
    }
    return out


def collect_dialogue_assets(dialogue_id: str) -> list[dict[str, Any]]:
    if not dialogue_id or not supabase:
        return []
    try:
        resp = (
            supabase
            .table("application_messages")
            .select("attachments")
            .eq("application_id", dialogue_id)
            .order("created_at", desc=False)
            .limit(200)
            .execute()
        )
    except Exception:
        return []

    assets: list[dict[str, Any]] = []
    for row in resp.data or []:
        for item in _safe_list(_safe_dict(row).get("attachments")):
            normalized = _normalize_asset(item)
            if normalized:
                assets.append(normalized)
    return assets


def build_dialogue_enrichment(dialogue_id: str) -> dict[str, Any]:
    assets = collect_dialogue_assets(dialogue_id)
    has_audio = any(str(item.get("kind") or "").lower() == "audio" for item in assets)

    ai_summary = get_dialogue_ai_summary(dialogue_id)
    fit_evidence = get_dialogue_fit_evidence(dialogue_id)
    transcript_doc = get_dialogue_transcript(dialogue_id) if has_audio else None

    audio_transcript_status = "not_applicable"
    if has_audio:
        audio_transcript_status = "ready" if transcript_doc else "pending"
        if transcript_doc:
            for item in assets:
                if str(item.get("kind") or "").lower() == "audio":
                    item["transcript_status"] = "ready"

    return {
        "assets": assets,
        "audio_transcript_status": audio_transcript_status,
        "ai_summary_status": "ready" if ai_summary else "unavailable",
        "fit_evidence_status": "ready" if fit_evidence else "unavailable",
        "ai_summary": (
            {
                "summary": ai_summary.get("summary"),
                "updated_at": ai_summary.get("generated_at"),
            }
            if ai_summary and ai_summary.get("summary")
            else None
        ),
        "fit_evidence": (
            {
                "layers": fit_evidence.get("five_layer_fit"),
                "updated_at": fit_evidence.get("generated_at"),
            }
            if fit_evidence and fit_evidence.get("five_layer_fit") is not None
            else None
        ),
    }
