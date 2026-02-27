# Backend Migration to Northflank

This project can run on Northflank without backend refactor.

## 1) Build Source

- Dockerfile: `backend/Dockerfile`
- Build context: repo root

## 2) Default Architecture (Two Services)

Use one image, two runtime services:

1. `jobshaman-api` (public HTTP)
2. `jobshaman-scheduler` (private, no public ingress)

Reason: APScheduler is embedded in app startup. If multiple API replicas run with scheduler enabled, jobs run multiple times.

## 2b) Northflank Limit: Single Service Mode

If your Northflank plan allows only one service, run API and scheduler in one process.

- Service name: `jobshaman-api`
- Public ingress: enabled
- Replicas: exactly `1`
- Keep autoscaling off

Required flags in this mode:

- `ENABLE_BACKGROUND_SCHEDULER=true`
- `ENABLE_DAILY_DIGESTS=true` (if you want digest jobs)
- `ENABLE_PUBLIC_BENCHMARK_REFRESH=true` (if you want benchmark refresh)

Important:

- Do not scale above one replica, otherwise cron jobs run multiple times.
- Rolling restart will reset in-process scheduler timers (normal for APScheduler in app process).

## 3) Start Command

Use default image command:

```sh
python -m gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:${PORT:-8080} --timeout 120
```

## 4) Health Check

- Path: `/healthz`
- Port: service HTTP port (default `8080`)

## 5) Environment Variables (Both Services)

Required:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (or `SUPABASE_KEY`, service key preferred)
- `SECRET_KEY` (or `JWT_SECRET`)

Common app/runtime:

- `API_BASE_URL` (example: `https://api.jobshaman.cz`)
- `APP_PUBLIC_URL` (example: `https://jobshaman.cz`)
- `ALLOWED_ORIGINS` (comma-separated; include frontend origins)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_FALLBACK_MODEL`
- `RESEND_API_KEY`
- `SENTRY_DSN` (optional)

Feature flags:

- `ENABLE_BACKGROUND_SCHEDULER`
- `ENABLE_DAILY_DIGESTS`
- `ENABLE_PUBLIC_BENCHMARK_REFRESH`

Frontend note:

- Frontend calls backend via `VITE_BACKEND_URL` (build-time var in frontend project).
- `API_BASE_URL` is backend runtime config used mainly for generated links (for example email unsubscribe URLs), not for browser API routing.

## 6) Scheduler Split (Only if You Can Run Two Services)

`jobshaman-api`:

- `ENABLE_BACKGROUND_SCHEDULER=false`
- `ENABLE_DAILY_DIGESTS=false` (or as needed)
- `ENABLE_PUBLIC_BENCHMARK_REFRESH=false` (or as needed)

`jobshaman-scheduler`:

- `ENABLE_BACKGROUND_SCHEDULER=true`
- `ENABLE_DAILY_DIGESTS=true` (if you want digest jobs)
- `ENABLE_PUBLIC_BENCHMARK_REFRESH=true` (if you want benchmark refresh)
- Replicas: exactly `1`

## 7) Cutover Checklist

1. Deploy both Northflank services.
2. Confirm API: `GET /healthz` returns 200.
3. Confirm data path with a premium token:
   - `GET /tests/jcfpm/diagnostics`
   - Check `supabase_key_set=true` and `distinct_pool_keys>=108`.
4. Point frontend `VITE_BACKEND_URL` to new API URL.
5. Redeploy frontend.
6. Switch DNS (`api.jobshaman.cz`) to Northflank.
7. Keep Render running for short rollback window, then retire.

## 8) Quick Smoke Commands

```sh
curl -i https://api.jobshaman.cz/healthz
curl -i -H "Authorization: Bearer <TOKEN>" https://api.jobshaman.cz/tests/jcfpm/diagnostics
```
