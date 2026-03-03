#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from pymongo import ASCENDING, MongoClient, UpdateOne


REQUIRED_FIELDS = {
    "id",
    "pool_key",
    "variant_index",
    "dimension",
    "prompt",
    "item_type",
    "sort_order",
}

SUPPORTED_LOCALES = ("cs", "en", "de", "pl", "sk")
LOCALE_FALLBACK_CHAIN = ("en", "de", "cs")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed JCFPM pool into MongoDB")
    parser.add_argument(
        "--source",
        default=str(Path(__file__).resolve().parents[2] / "docs" / "jcfpm_pool_v3.json"),
        help="Path to jcfpm pool JSON file",
    )
    parser.add_argument("--mongo-uri", default=os.getenv("MONGODB_URI"), help="MongoDB connection URI")
    parser.add_argument("--db", default=os.getenv("MONGODB_DB", "jobshaman"), help="Mongo database")
    parser.add_argument("--collection", default=os.getenv("MONGODB_JCFPM_COLLECTION", "jcfpm_items"), help="Mongo collection")
    parser.add_argument("--dry-run", action="store_true", help="Validate only, do not write")
    return parser.parse_args()


def load_items(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Source JSON must contain a list")
    return [normalize_i18n(item) for item in data]


def _pick_locale_value(values: dict, preferred: str | None = None):
    if preferred and values.get(preferred) is not None:
        return values[preferred]
    for locale in LOCALE_FALLBACK_CHAIN:
        if values.get(locale) is not None:
            return values[locale]
    for value in values.values():
        if value is not None:
            return value
    return None


def _complete_locale_map(raw: object, fallback: object = None) -> dict:
    localized = raw if isinstance(raw, dict) else {}
    result = dict(localized)
    if fallback is not None and result.get("cs") is None:
        result["cs"] = fallback
    seed_value = _pick_locale_value(result)
    for locale in SUPPORTED_LOCALES:
        if result.get(locale) is None:
            result[locale] = _pick_locale_value(result, preferred=locale) or seed_value or fallback
    return result


def normalize_i18n(item: dict) -> dict:
    normalized = dict(item)
    normalized["prompt_i18n"] = _complete_locale_map(item.get("prompt_i18n"), item.get("prompt"))

    if item.get("subdimension") is not None or item.get("subdimension_i18n") is not None:
        normalized["subdimension_i18n"] = _complete_locale_map(item.get("subdimension_i18n"), item.get("subdimension"))

    if item.get("payload_i18n") is not None:
        payload_fallback = item.get("payload")
        normalized["payload_i18n"] = _complete_locale_map(item.get("payload_i18n"), payload_fallback)

    return normalized


def validate_items(items: list[dict]) -> None:
    if len(items) < 432:
        raise ValueError(f"Expected at least 432 items, got {len(items)}")

    ids: set[str] = set()
    pool_variant: set[tuple[str, int]] = set()
    pool_keys: set[str] = set()
    dimensions: set[str] = set()

    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"Item #{idx} is not an object")
        missing = [f for f in REQUIRED_FIELDS if f not in item]
        if missing:
            raise ValueError(f"Item #{idx} missing fields: {missing}")

        item_id = str(item["id"]).strip()
        if not item_id:
            raise ValueError(f"Item #{idx} has empty id")
        if item_id in ids:
            raise ValueError(f"Duplicate id: {item_id}")
        ids.add(item_id)

        pool_key = str(item["pool_key"]).strip().upper()
        variant_index = int(item["variant_index"])
        key = (pool_key, variant_index)
        if key in pool_variant:
            raise ValueError(f"Duplicate pool_key+variant_index: {pool_key}#{variant_index}")
        pool_variant.add(key)
        pool_keys.add(pool_key)
        dimensions.add(str(item["dimension"]))

        prompt_i18n = item.get("prompt_i18n")
        if not isinstance(prompt_i18n, dict):
            raise ValueError(f"Item {item_id} missing prompt_i18n")
        missing_locales = [locale for locale in SUPPORTED_LOCALES if prompt_i18n.get(locale) is None]
        if missing_locales:
            raise ValueError(f"Item {item_id} missing prompt_i18n locales: {missing_locales}")

        payload_i18n = item.get("payload_i18n")
        if payload_i18n is not None:
            if not isinstance(payload_i18n, dict):
                raise ValueError(f"Item {item_id} has invalid payload_i18n")
            missing_payload_locales = [locale for locale in SUPPORTED_LOCALES if payload_i18n.get(locale) is None]
            if missing_payload_locales:
                raise ValueError(f"Item {item_id} missing payload_i18n locales: {missing_payload_locales}")

    expected_dims = {
        "d1_cognitive",
        "d2_social",
        "d3_motivational",
        "d4_energy",
        "d5_values",
        "d6_ai_readiness",
        "d7_cognitive_reflection",
        "d8_digital_eq",
        "d9_systems_thinking",
        "d10_ambiguity_interpretation",
        "d11_problem_decomposition",
        "d12_moral_compass",
    }
    if dimensions != expected_dims:
        missing = sorted(expected_dims - dimensions)
        extra = sorted(dimensions - expected_dims)
        raise ValueError(f"Dimension mismatch. Missing={missing}, extra={extra}")

    if len(pool_keys) < 72:
        raise ValueError(f"Expected at least 72 logical pool keys, got {len(pool_keys)}")


def seed(args: argparse.Namespace) -> None:
    items = load_items(args.source)
    validate_items(items)
    print(f"Validated {len(items)} items from {args.source}")

    if args.dry_run:
        print("Dry run only. No writes performed.")
        return

    if not args.mongo_uri:
        raise ValueError("Mongo URI missing. Provide --mongo-uri or MONGODB_URI")

    client = MongoClient(args.mongo_uri)
    db = client[args.db]
    coll = db[args.collection]

    now_iso = datetime.now(timezone.utc).isoformat()
    operations = []
    for item in items:
        doc = {**item, "updated_at": now_iso}
        operations.append(
            UpdateOne(
                {"id": item["id"]},
                {"$set": doc, "$setOnInsert": {"created_at": now_iso}},
                upsert=True,
            )
        )

    if operations:
        result = coll.bulk_write(operations, ordered=False)
        print(
            f"Upsert done. inserted={result.upserted_count} modified={result.modified_count} matched={result.matched_count}"
        )

    coll.create_index([("id", ASCENDING)], unique=True, name="jcfpm_items_id_uidx")
    coll.create_index([("pool_key", ASCENDING), ("variant_index", ASCENDING)], unique=True, name="jcfpm_items_pool_variant_uidx")
    coll.create_index([("dimension", ASCENDING), ("status", ASCENDING), ("sort_order", ASCENDING)], name="jcfpm_items_dim_status_sort_idx")
    print(f"Indexes ensured on {args.db}.{args.collection}")


if __name__ == "__main__":
    seed(parse_args())
