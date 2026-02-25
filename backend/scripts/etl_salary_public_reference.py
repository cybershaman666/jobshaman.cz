import csv
import os
from datetime import datetime, timezone
from typing import Dict, List

OUTPUT_HEADERS = [
    "country_code",
    "role_family",
    "region_key",
    "seniority_band",
    "employment_type",
    "currency",
    "p25",
    "p50",
    "p75",
    "sample_size",
    "data_window_days",
    "source_name",
    "source_url",
    "period_label",
    "measure_type",
    "gross_net",
    "employment_scope",
    "updated_at",
    "method_version",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_text(value: str, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def _to_float(value: str) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def _to_int(value: str, fallback: int = 0) -> int:
    try:
        if value is None or value == "":
            return fallback
        return int(float(str(value).replace(",", ".")))
    except Exception:
        return fallback


def load_isco_major_inputs(csv_path: str) -> List[Dict[str, str]]:
    if not os.path.exists(csv_path):
        return []
    rows: List[Dict[str, str]] = []
    with open(csv_path, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            country_code = _normalize_text(raw.get("country_code"), "").upper()
            isco_major = _normalize_text(raw.get("isco_major"), "")
            if not country_code or not isco_major:
                continue
            role_family = f"isco_major_{isco_major}"
            region_key = _normalize_text(raw.get("region_key"), f"{country_code.lower()}_national")
            currency = _normalize_text(raw.get("currency"), "CZK")
            p50 = _to_float(raw.get("p50"))
            p25 = _to_float(raw.get("p25")) or p50
            p75 = _to_float(raw.get("p75")) or p50
            if p50 is None:
                continue
            rows.append({
                "country_code": country_code,
                "role_family": role_family,
                "region_key": region_key,
                "seniority_band": _normalize_text(raw.get("seniority_band"), "mid"),
                "employment_type": _normalize_text(raw.get("employment_type"), "employee"),
                "currency": currency,
                "p25": str(p25),
                "p50": str(p50),
                "p75": str(p75),
                "sample_size": str(_to_int(raw.get("sample_size"), 0)),
                "data_window_days": _normalize_text(raw.get("data_window_days"), ""),
                "source_name": _normalize_text(raw.get("source_name"), "public"),
                "source_url": _normalize_text(raw.get("source_url"), ""),
                "period_label": _normalize_text(raw.get("period_label"), ""),
                "measure_type": _normalize_text(raw.get("measure_type"), "median"),
                "gross_net": _normalize_text(raw.get("gross_net"), "gross"),
                "employment_scope": _normalize_text(raw.get("employment_scope"), "full_time"),
                "updated_at": _normalize_text(raw.get("updated_at"), _now_iso()),
                "method_version": _normalize_text(raw.get("method_version"), "salary-benchmark-v2"),
            })
    return rows


def fetch_cz() -> List[Dict[str, str]]:
    # TODO: implement CZ public data fetch (e.g., ČSÚ)
    return []


def fetch_sk() -> List[Dict[str, str]]:
    # TODO: implement SK public data fetch (ŠÚ SR)
    return []


def fetch_pl() -> List[Dict[str, str]]:
    # TODO: implement PL public data fetch (GUS)
    return []


def fetch_de() -> List[Dict[str, str]]:
    # TODO: implement DE public data fetch (Destatis)
    return []


def fetch_at() -> List[Dict[str, str]]:
    # TODO: implement AT public data fetch (Statistik Austria)
    return []


def collect_all() -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    input_dir = os.getenv(
        "SALARY_PUBLIC_REFERENCE_RAW_DIR",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "benchmarks_public", "raw"),
    )
    rows.extend(load_isco_major_inputs(os.path.join(input_dir, "isco_major_inputs.csv")))
    for provider in (fetch_cz, fetch_sk, fetch_pl, fetch_de, fetch_at):
        rows.extend(provider())
    return rows


def write_csv(rows: List[Dict[str, str]], output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_HEADERS)
        writer.writeheader()
        for row in rows:
            normalized = {**row}
            if "updated_at" not in normalized:
                normalized["updated_at"] = _now_iso()
            writer.writerow(normalized)


def main() -> int:
    output_dir = os.getenv(
        "SALARY_PUBLIC_REFERENCE_CSV_DIR",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "benchmarks_public"),
    )
    output_path = os.path.join(output_dir, "generated_public_benchmarks.csv")
    rows = collect_all()
    write_csv(rows, output_path)
    print(f"✅ Wrote {len(rows)} row(s) to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
