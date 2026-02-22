import os


# Minimal config so backend modules importing app.core.config are test-safe.
os.environ.setdefault("JWT_SECRET", "test-secret")

