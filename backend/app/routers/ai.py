# Compatibility shim: make `backend.app.routers.ai` point to the current implementation
import importlib, sys
# Some code expects `backend.app.routers.ai` to be a module with helper functions
# Map it to where the AI router currently lives (if present). Try common candidate paths.
try:
    target = importlib.import_module("backend.app.api.v2.endpoints.ai")
except Exception:
    # fallback to ai_orchestration or services module if endpoint not present
    target = importlib.import_module("backend.app.ai_orchestration.client")
sys.modules[__name__] = target
