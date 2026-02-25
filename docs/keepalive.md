# Backend Keepalive (Workaround)

Render free tier can sleep on inactivity. Until upgrade, use one of these:

## Option A: External keepalive (recommended)
Run every 5–10 minutes (UptimeRobot / cron / GitHub Actions).

Example:
```
KEEPALIVE_URLS="https://jobshaman-cz-8d0p.onrender.com/healthz" node scripts/keepalive_ping.mjs
```

You can add more URLs:
```
KEEPALIVE_URLS="https://jobshaman-cz-8d0p.onrender.com/healthz,https://jobshaman-cz-8d0p.onrender.com/jobs/recommendations/warmup?limit=40" node scripts/keepalive_ping.mjs
```

## Option B: Client warmup
Frontend now fires a no‑cors ping to `/healthz` on start and when the tab becomes visible.
This reduces first‑load latency but won’t prevent sleep on its own.
