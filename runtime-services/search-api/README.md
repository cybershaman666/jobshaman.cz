# JobShaman Search API (Northflank)

Isolated always-on service for critical search runtime.

## Endpoints
- `POST /jobs/hybrid-search`
- `POST /jobs/hybrid-search-v2`
- `POST /jobs/interactions`
- `GET /healthz`

## Local run
```bash
cd runtime-services/search-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Northflank config
- Root directory: `runtime-services/search-api`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT} --timeout 60`
- Health check path: `/healthz`

## Frontend wiring
- Set `VITE_SEARCH_BACKEND_URL` to the deployed Northflank URL (prefer full URL with scheme, e.g. `https://site--jobshaman--rb4dlj74d5kc.code.run`).
- Add the same URL to CSP `connect-src` in:
  - `index.html`
  - `vercel.json`
- When `VITE_SEARCH_BACKEND_URL` points to a different origin than `VITE_BACKEND_URL`, jobs feed/filtering and `/jobs/interactions` are routed through the Northflank search runtime.

## Required env vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (or `SUPABASE_KEY`)
- `SECRET_KEY` (or `JWT_SECRET`)
- `CSRF_TOKEN_EXPIRY` (optional, default `3600`)
- `ALLOWED_ORIGINS`
- `EXPOSE_DEBUG_ERRORS=false`

## Troubleshooting
- Log `⚠️ search_exposures table missing...` means DB migration for search telemetry is not applied yet. Apply `database/migrations/20260217_search_v2.sql`.
- Log `...without valid CSRF token...` on `/jobs/interactions` is expected fallback behavior; endpoint accepts authenticated telemetry even when CSRF token is not present.
