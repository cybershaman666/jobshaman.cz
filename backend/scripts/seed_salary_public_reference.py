import argparse
import os
import sys
from dotenv import load_dotenv

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

from app.services.benchmarks_public import refresh_public_benchmarks  # type: ignore


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed salary_public_reference from CSV files.")
    parser.add_argument("--csv-dir", default=None, help="Directory with CSV files.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to DB.")
    args = parser.parse_args()

    load_dotenv(os.path.join(backend_dir, ".env"))
    load_dotenv(os.path.join(backend_dir, ".env.local"))

    csv_dir = args.csv_dir or os.getenv("SALARY_PUBLIC_REFERENCE_CSV_DIR")
    if not csv_dir:
        print("❌ Missing csv-dir (use --csv-dir or SALARY_PUBLIC_REFERENCE_CSV_DIR).")
        return 1

    summary = refresh_public_benchmarks(csv_dir, dry_run=args.dry_run)
    print(f"✅ Processed {summary['processed']} file(s), {summary['rows']} row(s).")
    if args.dry_run:
        print("ℹ️ Dry run enabled, no DB writes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
