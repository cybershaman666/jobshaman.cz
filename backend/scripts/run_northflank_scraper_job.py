#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_str(name: str, default: str | None = None) -> str | None:
    raw = os.getenv(name)
    if raw is None:
        return default
    value = raw.strip()
    return value or default


def _append_flag(args: list[str], env_name: str, flag: str) -> None:
    if _env_bool(env_name, False):
        args.append(flag)


def _append_option(args: list[str], env_name: str, flag: str) -> None:
    value = _env_str(env_name)
    if value:
        args.extend([flag, value])


def main() -> int:
    target = BACKEND_DIR / "scripts" / "run_unified_jobs_ingest.py"
    if not target.exists():
        raise FileNotFoundError(f"Unified ingest script not found: {target}")

    os.environ.setdefault("JOBSHAMAN_SKIP_VENV_REEXEC", "1")

    args = [sys.executable, str(target)]
    _append_flag(args, "SCRAPER_JOB_SKIP_SCRAPER_MULTI", "--skip-scraper-multi")
    _append_flag(args, "SCRAPER_JOB_DISABLE_REMOTE_NORMALIZATION", "--disable-remote-normalization")

    print(
        "Starting Northflank scraper job:",
        " ".join(args[1:]),
        flush=True,
    )
    return subprocess.call(args, cwd=str(BACKEND_DIR))


if __name__ == "__main__":
    raise SystemExit(main())
