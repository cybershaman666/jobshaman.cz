"""
Matching engine package.

Keep imports lazy: some submodules (e.g. `serve`) pull in heavy dependencies and
runtime services. Use `__getattr__` so importing lightweight helpers like
`role_taxonomy` does not trigger those side-effects.
"""

from __future__ import annotations

import importlib
from typing import Any

_EXPORTS = {
    "MODEL_VERSION",
    "hybrid_search_jobs",
    "hybrid_search_jobs_v2",
    "recommend_jobs_for_user",
    "run_daily_batch_jobs",
    "run_hourly_batch_jobs",
}

__all__ = sorted(_EXPORTS)


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        mod = importlib.import_module(".serve", __name__)
        return getattr(mod, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(set(globals().keys()) | _EXPORTS)
