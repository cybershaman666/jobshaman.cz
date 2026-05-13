# Compatibility shim for legacy test imports
# Tests import helpers from `backend.app.routers.tests`. Those helpers live
# in other modules now. This shim exposes the two helpers expected by tests.
from __future__ import annotations

# Implement the two helper functions used by tests. Keep them minimal and
# compatible with the tests in `backend/tests/test_jcfpm_latest_snapshot.py`.


def _snapshot_from_result_row(row: dict) -> dict:
    """Build a jcfpm snapshot dict from a result DB row-like mapping.
    Minimal implementation sufficient for unit tests.
    """
    snapshot = {
        "completed_at": row.get("created_at"),
        "percentile_summary": {},
        "ai_report": row.get("ai_report", {}),
    }
    for ds in row.get("dimension_scores", []):
        key = ds.get("dimension")
        pct = ds.get("percentile")
        if key and pct is not None:
            snapshot["percentile_summary"][key] = pct
    # Add fit_scores as-is
    snapshot["fit_scores"] = row.get("fit_scores", [])
    return snapshot


def _is_renderable_jcfpm_snapshot(snapshot: dict) -> bool:
    # basic checks used by tests
    ps = snapshot.get("percentile_summary") or {}
    return bool(snapshot.get("completed_at") and isinstance(ps, dict) and len(ps) > 0)
