# Compatibility shim: map `backend.app.routers.billing` to new location
import importlib, sys
sys.modules[__name__] = importlib.import_module("backend.app.api.v2.endpoints.billing")
