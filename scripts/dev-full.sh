#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for backend startup."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required for frontend startup."
  exit 1
fi

BACKEND_CMD="python3 -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000"

is_effectively_empty_secret() {
  value="${1:-}"
  case "$value" in
    ""|"\"\""|"''")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if is_effectively_empty_secret "${JWT_SECRET:-}"; then
  echo "JWT_SECRET missing/empty. Using local dev fallback."
  export JWT_SECRET="jobshaman-local-dev-secret-key-change-me"
fi

if is_effectively_empty_secret "${SECRET_KEY:-}"; then
  echo "SECRET_KEY missing/empty. Using JWT_SECRET value for local dev."
  export SECRET_KEY="$JWT_SECRET"
fi

echo "Starting backend: $BACKEND_CMD"
sh -c "$BACKEND_CMD" &
BACKEND_PID=$!

cleanup() {
  echo "Stopping backend (pid: $BACKEND_PID)..."
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}

trap cleanup INT TERM EXIT

echo "Starting frontend: npm run dev"
npm run dev
