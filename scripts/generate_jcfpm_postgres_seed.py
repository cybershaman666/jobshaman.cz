#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path


SUPPORTED_LOCALES = ("cs", "en", "de", "pl", "sk", "fi", "sv", "no", "da")
SOURCE_LOCALE = {
    "cs": "cs",
    "en": "en",
    "de": "de",
    "pl": "en",
    "sk": "cs",
    "fi": "en",
    "sv": "en",
    "no": "en",
    "da": "en",
}


IKIGAI_ITEMS = [
    ("I1.1", "i1_love", "Co mě přirozeně těší", "Při této aktivitě ztrácím pojem o čase.", "I lose track of time when doing this kind of activity."),
    ("I1.2", "i1_love", "Co mě přirozeně těší", "I po náročném dni mám chuť se k tomuto typu práce vrátit.", "Even after a demanding day, I want to return to this kind of work."),
    ("I1.3", "i1_love", "Co mě přirozeně těší", "Kdyby nebyl tlak na výkon, stejně bych se tomuto tématu věnoval/a.", "If there were no performance pressure, I would still explore this area."),
    ("I2.1", "i2_good_at", "V čem mám přirozenou sílu", "Lidé mě v této oblasti často žádají o radu nebo pomoc.", "People often ask me for advice or help in this area."),
    ("I2.2", "i2_good_at", "V čem mám přirozenou sílu", "V této práci rychle vidím vzorce, které ostatním unikají.", "In this work, I quickly notice patterns others miss."),
    ("I2.3", "i2_good_at", "V čem mám přirozenou sílu", "Umím v této oblasti zlepšovat výsledek i bez dlouhých instrukcí.", "I can improve outcomes in this area without long instructions."),
    ("I3.1", "i3_world_needs", "Co svět nebo tým potřebuje", "Dává mi smysl řešit problémy, které zlepšují život konkrétním lidem.", "It matters to me to solve problems that improve real people's lives."),
    ("I3.2", "i3_world_needs", "Co svět nebo tým potřebuje", "Chci vidět, komu moje práce pomohla a jaký měla dopad.", "I want to see who my work helped and what impact it had."),
    ("I3.3", "i3_world_needs", "Co svět nebo tým potřebuje", "Dokážu vydržet u práce déle, když chápu její širší užitek.", "I can stay with work longer when I understand its broader usefulness."),
    ("I4.1", "i4_paid_for", "Za co mě trh umí ocenit", "Umím pojmenovat hodnotu, kterou moje práce přináší firmě nebo zákazníkovi.", "I can name the value my work creates for a company or customer."),
    ("I4.2", "i4_paid_for", "Za co mě trh umí ocenit", "Chci rozvíjet schopnosti, za které je trh ochotný férově platit.", "I want to develop abilities the market is willing to pay for fairly."),
    ("I4.3", "i4_paid_for", "Za co mě trh umí ocenit", "Ideální práce pro mě spojuje smysl, sílu a ekonomickou udržitelnost.", "Ideal work for me combines meaning, strength, and economic sustainability."),
]


def sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def localized(raw: dict, locale: str) -> tuple[str, str]:
    prompts = raw.get("prompt_i18n") if isinstance(raw.get("prompt_i18n"), dict) else {}
    source = SOURCE_LOCALE[locale]
    value = prompts.get(locale) or prompts.get(source) or prompts.get("en") or prompts.get("cs") or raw.get("prompt") or ""
    status = "human_reviewed" if prompts.get(locale) else "needs_review"
    return str(value), status


def normalize_payload(raw: dict) -> dict:
    payload = raw.get("payload")
    if not isinstance(payload, dict):
        return {}
    return payload


def base_items(root: Path) -> list[dict]:
    items = json.loads((root / "docs" / "jcfpm_pool_v3.json").read_text(encoding="utf-8"))
    for item in items:
        item.setdefault("scale_min", 1)
        item.setdefault("scale_max", 7 if item.get("item_type") == "likert" else None)
        item.setdefault("section", "psychometric" if str(item.get("dimension")) <= "d6_ai_readiness" else "cognitive_skill")
    for pool_key, dimension, subdimension, prompt_cs, prompt_en in IKIGAI_ITEMS:
        items.append({
            "id": pool_key,
            "pool_key": pool_key,
            "variant_index": 1,
            "dimension": dimension,
            "section": "ikigai",
            "subdimension": subdimension,
            "subdimension_i18n": {"cs": subdimension, "en": subdimension},
            "prompt": prompt_cs,
            "prompt_i18n": {"cs": prompt_cs, "en": prompt_en, "de": prompt_en},
            "reverse_scoring": False,
            "sort_order": 1300 + len([i for i in items if str(i.get("dimension", "")).startswith("i")]) + 1,
            "item_type": "likert",
            "payload": None,
            "payload_i18n": None,
            "assets": None,
            "status": "active",
            "version": "jcfpm-v3-ikigai",
            "scale_min": 1,
            "scale_max": 7,
        })
    return items


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "backend" / "migrations" / "006_jcfpm_item_bank.sql"
    items = base_items(root)

    lines = [
        "-- JCFPM v3 item bank: 12 core dimensions + basic Ikigai extension.",
        "CREATE TABLE IF NOT EXISTS jcfpm_forms (",
        "  form_key text PRIMARY KEY,",
        "  version text NOT NULL,",
        "  title text NOT NULL,",
        "  description text,",
        "  is_active boolean NOT NULL DEFAULT true,",
        "  created_at timestamptz NOT NULL DEFAULT now(),",
        "  updated_at timestamptz NOT NULL DEFAULT now()",
        ");",
        "",
        "CREATE TABLE IF NOT EXISTS jcfpm_items (",
        "  item_id text PRIMARY KEY,",
        "  pool_key text NOT NULL,",
        "  variant_index integer NOT NULL DEFAULT 1,",
        "  dimension text NOT NULL,",
        "  section text NOT NULL DEFAULT 'psychometric',",
        "  subdimension text,",
        "  item_type text NOT NULL DEFAULT 'likert',",
        "  scale_min integer,",
        "  scale_max integer,",
        "  reverse_scoring boolean NOT NULL DEFAULT false,",
        "  sort_order integer NOT NULL DEFAULT 0,",
        "  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,",
        "  assets_json jsonb NOT NULL DEFAULT '{}'::jsonb,",
        "  status text NOT NULL DEFAULT 'active',",
        "  version text NOT NULL DEFAULT 'jcfpm-v3',",
        "  created_at timestamptz NOT NULL DEFAULT now(),",
        "  updated_at timestamptz NOT NULL DEFAULT now(),",
        "  UNIQUE(pool_key, variant_index)",
        ");",
        "CREATE INDEX IF NOT EXISTS idx_jcfpm_items_dimension_status_sort ON jcfpm_items(dimension, status, sort_order);",
        "CREATE INDEX IF NOT EXISTS idx_jcfpm_items_section ON jcfpm_items(section);",
        "",
        "CREATE TABLE IF NOT EXISTS jcfpm_item_translations (",
        "  item_id text NOT NULL REFERENCES jcfpm_items(item_id) ON DELETE CASCADE,",
        "  locale text NOT NULL,",
        "  prompt text NOT NULL,",
        "  helper_text text,",
        "  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,",
        "  translation_status text NOT NULL DEFAULT 'needs_review',",
        "  source_locale text,",
        "  updated_at timestamptz NOT NULL DEFAULT now(),",
        "  PRIMARY KEY(item_id, locale)",
        ");",
        "CREATE INDEX IF NOT EXISTS idx_jcfpm_item_translations_locale_status ON jcfpm_item_translations(locale, translation_status);",
        "",
        "CREATE TABLE IF NOT EXISTS jcfpm_form_items (",
        "  form_key text NOT NULL REFERENCES jcfpm_forms(form_key) ON DELETE CASCADE,",
        "  item_id text NOT NULL REFERENCES jcfpm_items(item_id) ON DELETE CASCADE,",
        "  required boolean NOT NULL DEFAULT true,",
        "  sort_order integer NOT NULL DEFAULT 0,",
        "  PRIMARY KEY(form_key, item_id)",
        ");",
        "",
        "INSERT INTO jcfpm_forms(form_key, version, title, description, is_active)",
        "VALUES ('jcfpm-v3-ikigai', 'jcfpm-v3-ikigai', 'JCFPM v3 + Ikigai', 'Full JobShaman work-potential matrix with psychometric, cognitive-skill, and Ikigai sections.', true)",
        "ON CONFLICT (form_key) DO UPDATE SET version = EXCLUDED.version, title = EXCLUDED.title, description = EXCLUDED.description, is_active = EXCLUDED.is_active, updated_at = now();",
        "",
    ]

    for item in items:
        lines.append(
            "INSERT INTO jcfpm_items(item_id, pool_key, variant_index, dimension, section, subdimension, item_type, scale_min, scale_max, reverse_scoring, sort_order, payload_json, assets_json, status, version) "
            f"VALUES ({sql_literal(item['id'])}, {sql_literal(item['pool_key'])}, {int(item.get('variant_index') or 1)}, {sql_literal(item['dimension'])}, "
            f"{sql_literal(item.get('section') or 'psychometric')}, {sql_literal(item.get('subdimension'))}, {sql_literal(item.get('item_type') or 'likert')}, "
            f"{sql_literal(item.get('scale_min'))}, {sql_literal(item.get('scale_max'))}, {'true' if item.get('reverse_scoring') else 'false'}, "
            f"{int(item.get('sort_order') or 0)}, {sql_literal(normalize_payload(item))}::jsonb, {sql_literal(item.get('assets') or {})}::jsonb, "
            f"{sql_literal(item.get('status') or 'active')}, {sql_literal(item.get('version') or 'jcfpm-v3')}) "
            "ON CONFLICT (item_id) DO UPDATE SET pool_key = EXCLUDED.pool_key, variant_index = EXCLUDED.variant_index, dimension = EXCLUDED.dimension, section = EXCLUDED.section, subdimension = EXCLUDED.subdimension, item_type = EXCLUDED.item_type, scale_min = EXCLUDED.scale_min, scale_max = EXCLUDED.scale_max, reverse_scoring = EXCLUDED.reverse_scoring, sort_order = EXCLUDED.sort_order, payload_json = EXCLUDED.payload_json, assets_json = EXCLUDED.assets_json, status = EXCLUDED.status, version = EXCLUDED.version, updated_at = now();"
        )
        for locale in SUPPORTED_LOCALES:
            prompt, status = localized(item, locale)
            payload = item.get("payload_i18n", {}).get(locale) if isinstance(item.get("payload_i18n"), dict) else normalize_payload(item)
            lines.append(
                "INSERT INTO jcfpm_item_translations(item_id, locale, prompt, payload_json, translation_status, source_locale) "
                f"VALUES ({sql_literal(item['id'])}, {sql_literal(locale)}, {sql_literal(prompt)}, {sql_literal(payload or {})}::jsonb, {sql_literal(status)}, {sql_literal(SOURCE_LOCALE[locale])}) "
                "ON CONFLICT (item_id, locale) DO UPDATE SET prompt = EXCLUDED.prompt, payload_json = EXCLUDED.payload_json, translation_status = EXCLUDED.translation_status, source_locale = EXCLUDED.source_locale, updated_at = now();"
            )
        lines.append(
            "INSERT INTO jcfpm_form_items(form_key, item_id, required, sort_order) "
            f"VALUES ('jcfpm-v3-ikigai', {sql_literal(item['id'])}, true, {int(item.get('sort_order') or 0)}) "
            "ON CONFLICT (form_key, item_id) DO UPDATE SET required = EXCLUDED.required, sort_order = EXCLUDED.sort_order;"
        )

    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} items and {len(items) * len(SUPPORTED_LOCALES)} translations to {out}")


if __name__ == "__main__":
    main()
