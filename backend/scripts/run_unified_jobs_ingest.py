#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def _maybe_reexec_backend_venv() -> None:
    if os.environ.get("JOBSHAMAN_SKIP_VENV_REEXEC") == "1":
        return

    script_path = Path(__file__).resolve()
    backend_dir = script_path.parent.parent if script_path.parent.name == "scripts" else script_path.parents[2] / "backend"
    venv_python = backend_dir / "venv" / "bin" / "python"
    if not venv_python.exists():
        return

    current_python = Path(sys.executable).resolve()
    if current_python == venv_python.resolve():
        return

    os.environ["JOBSHAMAN_SKIP_VENV_REEXEC"] = "1"
    os.execv(str(venv_python), [str(venv_python), str(script_path), *sys.argv[1:]])


_maybe_reexec_backend_venv()

from dotenv import load_dotenv

SCRIPT_PATH = Path(__file__).resolve()
if SCRIPT_PATH.parent.name == "scripts" and (SCRIPT_PATH.parent.parent / "app").exists():
    ROOT = SCRIPT_PATH.parent.parent
    BACKEND_DIR = ROOT
else:
    ROOT = SCRIPT_PATH.parents[2]
    BACKEND_DIR = ROOT / "backend"
SCRAPER_DIR = BACKEND_DIR / "scraper"

for path in (BACKEND_DIR, SCRAPER_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

load_dotenv(dotenv_path=ROOT / ".env", override=False)
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=False)

os.environ.setdefault("JWT_SECRET", "jobshaman-unified-ingest-local-dev")
os.environ.setdefault("SECRET_KEY", os.environ["JWT_SECRET"])

try:
    from scraper.scraper_multi import run_all_scrapers  # type: ignore
except Exception:
    from scraper_multi import run_all_scrapers  # type: ignore


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run unified scraper ingest into Jobs Postgres."
    )
    parser.add_argument("--skip-scraper-multi", action="store_true")
    parser.add_argument("--disable-remote-normalization", action="store_true")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    summary: dict[str, object] = {
        "status": "success",
        "scraper_multi": None,
    }

    if args.disable_remote_normalization:
        os.environ["SCRAPER_REMOTE_METADATA_BACKFILL"] = "false"

    if not args.skip_scraper_multi:
        scraper_total = run_all_scrapers()
        summary["scraper_multi"] = {"saved_total": int(scraper_total or 0)}

    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
