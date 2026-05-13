# Compatibility shim: map `backend.app.routers.signal_boost` to new location
import importlib, sys
# signal_boost router implementation may live under services; try endpoints first
try:
    sys.modules[__name__] = importlib.import_module("backend.app.api.v2.endpoints.signal_boost")
except Exception:
    sys.modules[__name__] = importlib.import_module("backend.app.services.job_signal_boost")
