# Compatibility shim: make `backend.app.routers.jobs` point to the current implementation
import importlib, sys
sys.modules[__name__] = importlib.import_module("backend.app.api.v2.endpoints.jobs")
