#!/usr/bin/env python3
"""
Convert matching role taxonomy between JSON and CSV.

Usage:
  python backend/scripts/taxonomy_json_csv.py export
  python backend/scripts/taxonomy_json_csv.py import
  python backend/scripts/taxonomy_json_csv.py roundtrip-check
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[1]
MATCHING_DIR = ROOT / "app" / "matching_engine"
JSON_PATH = MATCHING_DIR / "role_taxonomy.json"
CSV_DIR = MATCHING_DIR / "role_taxonomy_csv"


def _uniq_lower(values: List[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for raw in values:
        value = str(raw or "").strip().lower()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _write_csv(path: Path, header: List[str], rows: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _read_csv(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _load_json(path: Path) -> Dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("role_taxonomy.json must contain a JSON object")
    return data


def export_json_to_csv(json_path: Path = JSON_PATH, csv_dir: Path = CSV_DIR) -> None:
    data = _load_json(json_path)

    domain_rows: List[Dict[str, str]] = []
    for domain, keywords in sorted((data.get("domain_keywords") or {}).items()):
        for keyword in _uniq_lower(list(keywords or [])):
            domain_rows.append({"domain": domain, "keyword": keyword})
    _write_csv(csv_dir / "domain_keywords.csv", ["domain", "keyword"], domain_rows)

    family_rows: List[Dict[str, str]] = []
    for family, keywords in sorted((data.get("role_family_keywords") or {}).items()):
        for keyword in _uniq_lower(list(keywords or [])):
            family_rows.append({"family": family, "keyword": keyword})
    _write_csv(csv_dir / "role_family_keywords.csv", ["family", "keyword"], family_rows)

    relation_rows: List[Dict[str, str]] = []
    for source, targets in sorted((data.get("role_family_relations") or {}).items()):
        for target, weight in sorted((targets or {}).items()):
            relation_rows.append(
                {"source_family": source, "target_family": target, "weight": str(float(weight))}
            )
    _write_csv(
        csv_dir / "role_family_relations.csv",
        ["source_family", "target_family", "weight"],
        relation_rows,
    )

    rule_rows: List[Dict[str, str]] = []
    for rule in sorted((data.get("required_qualification_rules") or []), key=lambda x: x.get("name", "")):
        name = str(rule.get("name") or "").strip().lower()
        if not name:
            continue
        job_terms = _uniq_lower(list(rule.get("job_terms") or []))
        cand_terms = _uniq_lower(list(rule.get("candidate_terms") or []))
        max_len = max(len(job_terms), len(cand_terms))
        if max_len == 0:
            continue
        for idx in range(max_len):
            rule_rows.append(
                {
                    "name": name,
                    "job_term": job_terms[idx] if idx < len(job_terms) else "",
                    "candidate_term": cand_terms[idx] if idx < len(cand_terms) else "",
                }
            )
    _write_csv(
        csv_dir / "required_qualification_rules.csv",
        ["name", "job_term", "candidate_term"],
        rule_rows,
    )

    version = str(data.get("taxonomy_version") or "role-taxonomy-csv-v1").strip()
    _write_csv(csv_dir / "taxonomy_meta.csv", ["key", "value"], [{"key": "taxonomy_version", "value": version}])


def import_csv_to_json(csv_dir: Path = CSV_DIR, json_path: Path = JSON_PATH) -> Dict[str, Any]:
    domain_keywords: Dict[str, List[str]] = {}
    for row in _read_csv(csv_dir / "domain_keywords.csv"):
        domain = str(row.get("domain") or "").strip().lower()
        keyword = str(row.get("keyword") or "").strip().lower()
        if domain and keyword:
            domain_keywords.setdefault(domain, []).append(keyword)
    domain_keywords = {k: _uniq_lower(v) for k, v in sorted(domain_keywords.items())}

    role_family_keywords: Dict[str, List[str]] = {}
    for row in _read_csv(csv_dir / "role_family_keywords.csv"):
        family = str(row.get("family") or "").strip().lower()
        keyword = str(row.get("keyword") or "").strip().lower()
        if family and keyword:
            role_family_keywords.setdefault(family, []).append(keyword)
    role_family_keywords = {k: _uniq_lower(v) for k, v in sorted(role_family_keywords.items())}

    role_family_relations: Dict[str, Dict[str, float]] = {}
    for row in _read_csv(csv_dir / "role_family_relations.csv"):
        source = str(row.get("source_family") or "").strip().lower()
        target = str(row.get("target_family") or "").strip().lower()
        if not source or not target:
            continue
        try:
            weight = float(row.get("weight") or 0.0)
        except (TypeError, ValueError):
            continue
        role_family_relations.setdefault(source, {})[target] = max(0.0, min(1.0, weight))
    role_family_relations = {
        source: dict(sorted(targets.items()))
        for source, targets in sorted(role_family_relations.items())
    }

    rules_map: Dict[str, Dict[str, Any]] = {}
    for row in _read_csv(csv_dir / "required_qualification_rules.csv"):
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

    required_qualification_rules = []
    for name in sorted(rules_map.keys()):
        rule = rules_map[name]
        job_terms = _uniq_lower(rule["job_terms"])
        candidate_terms = _uniq_lower(rule["candidate_terms"])
        if job_terms and candidate_terms:
            required_qualification_rules.append(
                {"name": name, "job_terms": job_terms, "candidate_terms": candidate_terms}
            )

    taxonomy_version = "role-taxonomy-csv-v1"
    for row in _read_csv(csv_dir / "taxonomy_meta.csv"):
        key = str(row.get("key") or "").strip().lower()
        if key == "taxonomy_version":
            taxonomy_version = str(row.get("value") or taxonomy_version).strip()
            break

    payload = {
        "taxonomy_version": taxonomy_version,
        "domain_keywords": domain_keywords,
        "role_family_keywords": role_family_keywords,
        "role_family_relations": role_family_relations,
        "required_qualification_rules": required_qualification_rules,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    return payload


def roundtrip_check(json_path: Path = JSON_PATH, csv_dir: Path = CSV_DIR) -> None:
    original = _load_json(json_path)
    export_json_to_csv(json_path=json_path, csv_dir=csv_dir)
    regenerated = import_csv_to_json(csv_dir=csv_dir, json_path=json_path)

    if (
        json.dumps(original, ensure_ascii=True, sort_keys=True)
        != json.dumps(regenerated, ensure_ascii=True, sort_keys=True)
    ):
        raise SystemExit("Roundtrip mismatch detected between JSON and CSV representation.")

    print("Roundtrip check passed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Role taxonomy JSON/CSV converter")
    parser.add_argument(
        "command",
        choices=["export", "import", "roundtrip-check"],
        help="Conversion command to execute",
    )
    args = parser.parse_args()

    if args.command == "export":
        export_json_to_csv()
        print(f"Exported taxonomy CSV files to {CSV_DIR}")
        return
    if args.command == "import":
        payload = import_csv_to_json()
        print(
            "Imported CSV to JSON:",
            f"domains={len(payload['domain_keywords'])}",
            f"families={len(payload['role_family_keywords'])}",
            f"rules={len(payload['required_qualification_rules'])}",
        )
        return
    roundtrip_check()


if __name__ == "__main__":
    main()

