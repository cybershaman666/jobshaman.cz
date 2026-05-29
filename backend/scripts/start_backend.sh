#!/usr/bin/env sh
set -eu

if [ "${RUN_DB_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "Running database migrations before backend start..."
  python backend/scripts/migrate_v2.py
else
  echo "Skipping database migrations because RUN_DB_MIGRATIONS_ON_START is not true."
fi

exec python -m gunicorn -k uvicorn.workers.UvicornWorker app.main:app \
  --bind "0.0.0.0:${PORT:-8080}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --timeout 120
