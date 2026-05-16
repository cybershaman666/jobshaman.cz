#!/bin/bash
set -euo pipefail

# Export (dump) production database from Northflank (or existing Postgres host)
# Usage:
#   NF_HOST=... NF_PORT=5432 NF_USER=... NF_DB=jobshaman DUMP_FILE=jobshaman.dump \
#     PGPASSWORD=secret ./backend/scripts/migrate_db_export.sh

if [ -z "${DUMP_FILE:-}" ]; then
  echo "Missing DUMP_FILE environment variable. Example: DUMP_FILE=jobshaman.dump"
  exit 2
fi

: "Exporting database ${NF_DB:-jobshaman} from ${NF_HOST:-<host>} to ${DUMP_FILE}"

echo "Starting pg_dump (custom format)..."
PGPASSWORD=${PGPASSWORD:-}
export PGPASSWORD

pg_dump -h "${NF_HOST:-localhost}" \
  -p "${NF_PORT:-5432}" \
  -U "${NF_USER:-postgres}" \
  -Fc -d "${NF_DB:-jobshaman}" \
  -f "${DUMP_FILE}"

echo "Dump completed: ${DUMP_FILE}"
echo "Tip: copy the file to a secure location (az storage blob upload / scp / rclone)."
