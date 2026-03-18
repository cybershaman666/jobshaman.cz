from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(dotenv_path=ROOT / ".env", override=False)
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

if not os.getenv("JWT_SECRET") and not os.getenv("SECRET_KEY"):
    os.environ["JWT_SECRET"] = "jobspy-career-ops-cli-secret"

from app.services.jobspy_career_ops import refresh_jobspy_career_ops_snapshots


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Refresh JobSpy career-ops enrichment and company snapshots.")
    parser.add_argument("--limit", type=int, default=600)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    result = refresh_jobspy_career_ops_snapshots(limit=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
