import importlib
import sys

# Import backend.app and register it as the top-level `app` package so tests
# and code that import `app.*` will resolve to `backend.app` transparently.
backend_app = importlib.import_module("backend.app")
# Ensure Python's module cache maps 'app' to the backend.app package/module
sys.modules["app"] = backend_app

# Re-export commonly used names from backend.app for convenience
from backend.app import *  # noqa: F401,F403
