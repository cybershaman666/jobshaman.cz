from __future__ import annotations

from ._runtime_bridge import load_runtime_module, reexport_runtime_module, run_runtime_as_main

_runtime_module = load_runtime_module("reproduce_scraper.py", "jobshaman_runtime_reproduce_scraper")
reexport_runtime_module(globals(), _runtime_module)

if __name__ == "__main__":
    run_runtime_as_main("reproduce_scraper.py")
