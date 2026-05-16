#!/bin/bash
set -euo pipefail

# Import dump into Azure PostgreSQL using pg_restore
# Usage:
#   AZ_HOST=... AZ_USER=appuser AZ_DB=jobshaman DUMP_FILE=jobshaman.dump PGPASSWORD=secret ./backend/scripts/migrate_db_import.sh

if [ -z "${DUMP_FILE:-}" ]; then
  echo "Missing DUMP_FILE environment variable. Example: DUMP_FILE=jobshaman.dump"
  exit 2
fi

echo "Importing ${DUMP_FILE} into ${AZ_DB:-jobshaman} on ${AZ_HOST:-localhost}"

PGPASSWORD=${PGPASSWORD:-}
export PGPASSWORD

# Ensure extensions (adjust list as needed). On Azure Flexible Server some extensions
# may be restricted; ignore extension creation errors so import can continue.
psql -h "${AZ_HOST:-localhost}" -U "${AZ_USER:-appuser}" -d "${AZ_DB:-jobshaman}" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" || echo "Warning: pg_trgm not created or not allowed, continuing"
psql -h "${AZ_HOST:-localhost}" -U "${AZ_USER:-appuser}" -d "${AZ_DB:-jobshaman}" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || echo "Warning: uuid-ossp not created or not allowed, continuing"

echo "Determining dump format..."

# Detect gzip by using gzip -t which returns success for gzip files.
is_gzip=0
if gzip -t "${DUMP_FILE}" 2>/dev/null; then
  is_gzip=1
fi

# Read the first line (decompress if gzipped)
if [ "$is_gzip" -eq 1 ]; then
  first_line=$(zcat "${DUMP_FILE}" | head -n 1)
else
  first_line=$(head -n 1 "${DUMP_FILE}")
fi

# Helper: run psql with ON_ERROR_STOP so import fails fast on SQL errors
psql_cmd() {
  # if reading from stdin, caller should pipe into this; otherwise use -f
  if [ "$1" = "-" ]; then
    psql -h "${AZ_HOST:-localhost}" -p "${AZ_PORT:-5432}" -U "${AZ_USER:-appuser}" -d "${AZ_DB:-jobshaman}" -v ON_ERROR_STOP=1
  else
    psql -h "${AZ_HOST:-localhost}" -p "${AZ_PORT:-5432}" -U "${AZ_USER:-appuser}" -d "${AZ_DB:-jobshaman}" -v ON_ERROR_STOP=1 -f "$1"
  fi
}

# Check for plain SQL dump header
if echo "$first_line" | grep -q "^-- PostgreSQL database dump"; then
  echo "Detected plain SQL dump. Restoring with psql..."
  if [ "$is_gzip" -eq 1 ]; then
    zcat "${DUMP_FILE}" | psql_cmd -
  else
    psql_cmd "${DUMP_FILE}"
  fi
  exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "psql reported an error (exit $exit_code). Aborting."
    exit $exit_code
  fi
fi

# Check for pg_dump custom/archive format header (starts with "PGDMP")
if head -c 5 "${DUMP_FILE}" 2>/dev/null | grep -q "PGDMP"; then
  echo "Detected custom/pg_restore format. Running pg_restore..."
  pg_restore -h "${AZ_HOST:-localhost}" -p "${AZ_PORT:-5432}" -U "${AZ_USER:-appuser}" -d "${AZ_DB:-jobshaman}" -v "${DUMP_FILE}"
  exit $?
fi

# Fallback: try pg_restore (works for custom/dir formats). If it fails, attempt psql.
echo "Unknown/ambiguous dump format. First trying pg_restore, then psql if necessary..."
if pg_restore -h "${AZ_HOST:-localhost}" -p "${AZ_PORT:-5432}" -U "${AZ_USER:-appuser}" -d "${AZ_DB:-jobshaman}" -v "${DUMP_FILE}"; then
  echo "pg_restore succeeded"
  exit 0
else
  echo "pg_restore failed, attempting to import with psql (plain SQL assumption)..."
  if [ "$is_gzip" -eq 1 ]; then
    zcat "${DUMP_FILE}" | psql_cmd -
  else
    psql_cmd "${DUMP_FILE}"
  fi
  exit $?
fi

echo "Import complete"
