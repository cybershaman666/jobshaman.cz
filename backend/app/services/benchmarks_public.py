from __future__ import annotations

import csv
import os
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from supabase import create_client


def _get_supabase_service_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    try:
        return create_client(url, key)
    except Exception:
        return None

DEFAULT_CSV_DIR = os.getenv(
    "SALARY_PUBLIC_REFERENCE_CSV_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "benchmarks_public"),
)

REQUIRED_FIELDS = {
    "country_code",
    "role_family",
    "region_key",
    "seniority_band",
    "employment_type",
    "currency",
    "source_name",
}

OPTIONAL_FIELDS = {
    "p25",
    "p50",
    "p75",
    "sample_size",
    "data_window_days",
    "source_url",
    "period_label",
    "measure_type",
    "gross_net",
    "employment_scope",
    "updated_at",
    "method_version",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _safe_int(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except Exception:
        return None


def _normalize_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def _normalize_row(raw: Dict[str, Any]) -> Dict[str, Any]:
    country_code = _normalize_text(raw.get("country_code")).upper()
    role_family = _normalize_text(raw.get("role_family"), "general").lower()
    region_key = _normalize_text(raw.get("region_key"), f"{country_code.lower()}_national").lower()
    seniority_band = _normalize_text(raw.get("seniority_band"), "mid").lower()
    employment_type = _normalize_text(raw.get("employment_type"), "employee").lower()
    currency = _normalize_text(raw.get("currency"), "CZK").upper()
    source_name = _normalize_text(raw.get("source_name"))
    if not source_name:
        raise ValueError("source_name is required")

    measure_type = _normalize_text(raw.get("measure_type"), "median").lower()
    gross_net = _normalize_text(raw.get("gross_net"), "gross").lower()
    employment_scope = _normalize_text(raw.get("employment_scope"), "full_time").lower()

    updated_at = _normalize_text(raw.get("updated_at"), _now_iso())

    return {
        "country_code": country_code,
        "role_family": role_family,
        "region_key": region_key,
        "seniority_band": seniority_band,
        "employment_type": employment_type,
        "currency": currency,
        "p25": _safe_float(raw.get("p25")),
        "p50": _safe_float(raw.get("p50")),
        "p75": _safe_float(raw.get("p75")),
        "sample_size": _safe_int(raw.get("sample_size")) or 0,
        "data_window_days": _safe_int(raw.get("data_window_days")),
        "source_name": source_name,
        "source_url": _normalize_text(raw.get("source_url")) or None,
        "period_label": _normalize_text(raw.get("period_label")) or None,
        "measure_type": measure_type,
        "gross_net": gross_net,
        "employment_scope": employment_scope,
        "updated_at": updated_at,
        "method_version": _normalize_text(raw.get("method_version"), "salary-benchmark-v2"),
    }


def load_public_benchmark_rows(csv_path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with open(csv_path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return []
        missing = REQUIRED_FIELDS.difference(set(reader.fieldnames))
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(sorted(missing))}")
        for raw in reader:
            normalized = _normalize_row(raw)
            rows.append(normalized)
    return rows


def _chunk(items: List[Dict[str, Any]], size: int = 200) -> Iterable[List[Dict[str, Any]]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def upsert_public_benchmark_rows(rows: List[Dict[str, Any]], dry_run: bool = False) -> int:
    if not rows:
        return 0
    if dry_run:
        return len(rows)
    supabase = _get_supabase_service_client()
    if not supabase:
        raise RuntimeError("Supabase client is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_KEY)")
    inserted = 0
    for batch in _chunk(rows):
        supabase.table("salary_public_reference").upsert(
            batch,
            on_conflict="country_code,role_family,region_key,seniority_band,employment_type,gross_net,measure_type",
        ).execute()
        inserted += len(batch)
    return inserted


def refresh_public_benchmarks(csv_dir: str, dry_run: bool = False) -> Dict[str, Any]:
    csv_files = []
    if os.path.isdir(csv_dir):
        for name in os.listdir(csv_dir):
            if name.lower().endswith(".csv"):
                csv_files.append(os.path.join(csv_dir, name))
    summary = {"processed": 0, "rows": 0, "files": csv_files}
    for path in csv_files:
        rows = load_public_benchmark_rows(path)
        upsert_public_benchmark_rows(rows, dry_run=dry_run)
        summary["processed"] += 1
        summary["rows"] += len(rows)
    return summary


def run_salary_public_reference_refresh() -> Dict[str, Any]:
    dry_run = os.getenv("SALARY_PUBLIC_REFERENCE_DRY_RUN", "false").strip().lower() in {"1", "true", "yes", "on"}
    csv_dir = os.getenv("SALARY_PUBLIC_REFERENCE_CSV_DIR", DEFAULT_CSV_DIR)
    return refresh_public_benchmarks(csv_dir, dry_run=dry_run)
