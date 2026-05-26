from __future__ import annotations

import importlib.util
import runpy
from pathlib import Path
from types import ModuleType
from typing import Any


_BACKEND_SCRAPER_DIR = Path(__file__).resolve().parent
_RUNTIME_SCRAPER_DIR = _BACKEND_SCRAPER_DIR.parents[1] / "runtime-services" / "scraper"


def _runtime_path(filename: str) -> Path:
    path = _RUNTIME_SCRAPER_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Runtime scraper module not found: {path}")
    return path


def load_runtime_module(filename: str, module_name: str) -> ModuleType:
    path = _runtime_path(filename)
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load runtime scraper module from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def reexport_runtime_module(target_globals: dict[str, Any], runtime_module: ModuleType) -> None:
    for name in dir(runtime_module):
        if name.startswith("__") and name not in {"__all__", "__doc__"}:
            continue
        target_globals[name] = getattr(runtime_module, name)


def run_runtime_as_main(filename: str) -> None:
    runpy.run_path(str(_runtime_path(filename)), run_name="__main__")
