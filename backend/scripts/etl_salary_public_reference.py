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
