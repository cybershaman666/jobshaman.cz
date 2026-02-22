"""
Central role taxonomy loader for multilingual matching.

Primary source is JSON (`role_taxonomy.json`) so extending professions/languages
does not require code changes. Optional CSV fallback is supported for bulk edits.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, List

_MODULE_DIR = Path(__file__).resolve().parent
_JSON_PATH = _MODULE_DIR / "role_taxonomy.json"
_CSV_DIR = _MODULE_DIR / "role_taxonomy_csv"

_DEFAULT_TAXONOMY: Dict[str, Any] = {
    "taxonomy_version": "role-taxonomy-fallback-v1",
    "domain_keywords": {},
    "role_family_keywords": {},
    "role_family_relations": {},
    "required_qualification_rules": [],
}


def _string_list(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    out: List[str] = []
    for item in values:
        text = str(item or "").strip().lower()
        if text:
            out.append(text)
    return out


def _dict_of_string_lists(values: Any) -> Dict[str, List[str]]:
    if not isinstance(values, dict):
        return {}
    out: Dict[str, List[str]] = {}
    for key, raw_list in values.items():
        k = str(key or "").strip().lower()
        if not k:
            continue
        parsed = _string_list(raw_list)
        if parsed:
            out[k] = parsed
    return out


def _relations(values: Any) -> Dict[str, Dict[str, float]]:
    if not isinstance(values, dict):
        return {}
    out: Dict[str, Dict[str, float]] = {}
    for source, raw_targets in values.items():
        source_key = str(source or "").strip().lower()
        if not source_key or not isinstance(raw_targets, dict):
            continue
        targets: Dict[str, float] = {}
        for target, raw_weight in raw_targets.items():
            target_key = str(target or "").strip().lower()
            if not target_key:
                continue
            try:
                weight = float(raw_weight)
            except (TypeError, ValueError):
                continue
            targets[target_key] = max(0.0, min(1.0, weight))
        if targets:
            out[source_key] = targets
    return out


def _qualification_rules(values: Any) -> List[Dict[str, Any]]:
    if not isinstance(values, list):
        return []
    rules: List[Dict[str, Any]] = []
    for entry in values:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip().lower()
        job_terms = _string_list(entry.get("job_terms"))
        candidate_terms = _string_list(entry.get("candidate_terms"))
        if not name or not job_terms or not candidate_terms:
            continue
        rules.append(
            {
                "name": name,
                "job_terms": job_terms,
                "candidate_terms": candidate_terms,
            }
        )
    return rules


def _normalize_taxonomy(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "taxonomy_version": str(payload.get("taxonomy_version") or _DEFAULT_TAXONOMY["taxonomy_version"]).strip(),
        "domain_keywords": _dict_of_string_lists(payload.get("domain_keywords")),
        "role_family_keywords": _dict_of_string_lists(payload.get("role_family_keywords")),
        "role_family_relations": _relations(payload.get("role_family_relations")),
        "required_qualification_rules": _qualification_rules(payload.get("required_qualification_rules")),
    }


def _load_from_json(path: Path) -> Dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    return _normalize_taxonomy(data)


def _read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8", newline="") as handle:
            return list(csv.DictReader(handle))
    except Exception:
        return []


def _load_from_csv(directory: Path) -> Dict[str, Any] | None:
    if not directory.exists():
        return None

    domains: Dict[str, List[str]] = {}
    for row in _read_csv(directory / "domain_keywords.csv"):
        domain = str(row.get("domain") or "").strip().lower()
        keyword = str(row.get("keyword") or "").strip().lower()
        if domain and keyword:
            domains.setdefault(domain, []).append(keyword)

    families: Dict[str, List[str]] = {}
    for row in _read_csv(directory / "role_family_keywords.csv"):
        family = str(row.get("family") or "").strip().lower()
        keyword = str(row.get("keyword") or "").strip().lower()
        if family and keyword:
            families.setdefault(family, []).append(keyword)

    relations: Dict[str, Dict[str, float]] = {}
    for row in _read_csv(directory / "role_family_relations.csv"):
        source = str(row.get("source_family") or "").strip().lower()
        target = str(row.get("target_family") or "").strip().lower()
        if not source or not target:
            continue
        try:
            weight = float(row.get("weight") or 0.0)
        except (TypeError, ValueError):
            continue
        relations.setdefault(source, {})[target] = max(0.0, min(1.0, weight))

    rules_map: Dict[str, Dict[str, Any]] = {}
    for row in _read_csv(directory / "required_qualification_rules.csv"):
        name = str(row.get("name") or "").strip().lower()
        if not name:
            continue
        rule = rules_map.setdefault(name, {"name": name, "job_terms": [], "candidate_terms": []})
        job_term = str(row.get("job_term") or "").strip().lower()
        candidate_term = str(row.get("candidate_term") or "").strip().lower()
        if job_term:
            rule["job_terms"].append(job_term)
        if candidate_term:
            rule["candidate_terms"].append(candidate_term)

    meta_rows = _read_csv(directory / "taxonomy_meta.csv")
    taxonomy_version = "role-taxonomy-csv-v1"
    if meta_rows:
        for row in meta_rows:
            key = str(row.get("key") or "").strip().lower()
            if key == "taxonomy_version":
                taxonomy_version = str(row.get("value") or taxonomy_version).strip()
                break

    payload = {
        "taxonomy_version": taxonomy_version,
        "domain_keywords": domains,
        "role_family_keywords": families,
        "role_family_relations": relations,
        "required_qualification_rules": list(rules_map.values()),
    }
    normalized = _normalize_taxonomy(payload)
    has_data = bool(
        normalized["domain_keywords"]
        or normalized["role_family_keywords"]
        or normalized["role_family_relations"]
        or normalized["required_qualification_rules"]
    )
    return normalized if has_data else None


def _load_taxonomy() -> Dict[str, Any]:
    json_taxonomy = _load_from_json(_JSON_PATH)
    if json_taxonomy is not None:
        return json_taxonomy
    csv_taxonomy = _load_from_csv(_CSV_DIR)
    if csv_taxonomy is not None:
        return csv_taxonomy
    return _DEFAULT_TAXONOMY


_TAXONOMY = _load_taxonomy()

TAXONOMY_VERSION: str = str(_TAXONOMY["taxonomy_version"])
DOMAIN_KEYWORDS: Dict[str, List[str]] = dict(_TAXONOMY["domain_keywords"])
ROLE_FAMILY_KEYWORDS: Dict[str, List[str]] = dict(_TAXONOMY["role_family_keywords"])
ROLE_FAMILY_RELATIONS: Dict[str, Dict[str, float]] = dict(_TAXONOMY["role_family_relations"])
REQUIRED_QUALIFICATION_RULES: List[Dict[str, Any]] = list(_TAXONOMY["required_qualification_rules"])

