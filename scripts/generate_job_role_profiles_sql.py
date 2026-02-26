import argparse
import csv
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate SQL seed for job_role_profiles from CSV.")
    parser.add_argument(
        "--input",
        default="docs/job_role_profiles_seed.csv",
        help="Path to CSV with job_role_profiles data.",
    )
    parser.add_argument(
        "--output",
        default="database/seeds/job_role_profiles.sql",
        help="Path to write SQL seed file.",
    )
    return parser.parse_args()


def _to_float(value: str) -> float:
    return float(value.strip())


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    if not input_path.exists():
        raise SystemExit(f"Input CSV not found: {input_path}")

    rows = []
    with input_path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            title = (row.get("title") or "").strip()
            if not title:
                continue
            rows.append({
                "title": title,
                "d1": _to_float(row["d1"]),
                "d2": _to_float(row["d2"]),
                "d3": _to_float(row["d3"]),
                "d4": _to_float(row["d4"]),
                "d5": _to_float(row["d5"]),
                "d6": _to_float(row["d6"]),
                "salary_range": (row.get("salary_range") or "").strip(),
                "growth_potential": (row.get("growth_potential") or "").strip(),
                "ai_impact": (row.get("ai_impact") or "").strip(),
                "remote_friendly": (row.get("remote_friendly") or "").strip(),
            })

    if not rows:
        raise SystemExit("No rows found in CSV.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    def _sql_str(value: str) -> str:
        if not value:
            return "NULL"
        return "'" + value.replace("'", "''") + "'"

    with output_path.open("w", encoding="utf-8") as handle:
        handle.write("INSERT INTO public.job_role_profiles (title, d1, d2, d3, d4, d5, d6, salary_range, growth_potential, ai_impact, remote_friendly) VALUES\n")
        for idx, row in enumerate(rows):
            tail = "," if idx < len(rows) - 1 else ""
            handle.write(
                "('{title}', {d1:.2f}, {d2:.2f}, {d3:.2f}, {d4:.2f}, {d5:.2f}, {d6:.2f}, {salary_range}, {growth_potential}, {ai_impact}, {remote_friendly}){tail}\n".format(
                    title=row["title"].replace("'", "''"),
                    d1=row["d1"],
                    d2=row["d2"],
                    d3=row["d3"],
                    d4=row["d4"],
                    d5=row["d5"],
                    d6=row["d6"],
                    salary_range=_sql_str(row["salary_range"]),
                    growth_potential=_sql_str(row["growth_potential"]),
                    ai_impact=_sql_str(row["ai_impact"]),
                    remote_friendly=_sql_str(row["remote_friendly"]),
                    tail=tail,
                )
            )
        handle.write("ON CONFLICT DO NOTHING;\n")

    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
