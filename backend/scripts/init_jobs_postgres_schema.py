from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _bootstrap_env() -> None:
    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    os.environ.setdefault("JWT_SECRET", "local-dev-jobs-postgres-init")
    os.environ.setdefault("SECRET_KEY", os.environ["JWT_SECRET"])


def main() -> int:
    _bootstrap_env()

    from app.services.jobs_postgres_store import ensure_jobs_postgres_schema, get_jobs_postgres_health

    try:
        schema_result = ensure_jobs_postgres_schema()
        health_result = get_jobs_postgres_health()
    except Exception as exc:
        message = str(exc)
        hint = None
        if "failed to resolve host" in message.lower():
            hint = (
                "Northflank Postgres hostname was not resolvable from this machine. "
                "Use a public connection URI if Northflank provides one, try POSTGRES_URI_ADMIN, "
                "or run this script from a runtime that has access to the private addon network."
            )
        print(json.dumps({
            "schema": {"ok": False},
            "error": exc.__class__.__name__,
            "message": message,
            "hint": hint,
        }, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps({
        "schema": schema_result,
        "health": health_result,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
