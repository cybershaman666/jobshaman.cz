#!/bin/bash
set -euo pipefail

# Rclone-based sync from S3 (Northflank) to Azure Blob
# Requires rclone configured with 'northflank' remote (s3) and 'azure' remote (azureblob)
# Usage:
#   ./backend/scripts/migrate_storage_rclone.sh northflank:bucket-name azure:container-name

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <source_remote:bucket> <dest_remote:container>"
  exit 2
fi

SRC="$1"
DST="$2"

echo "Syncing ${SRC} -> ${DST} (rclone)"
rclone sync "${SRC}" "${DST}" --progress --transfers=16 --checkers=16 --fast-list

echo "Sync complete"
