#!/usr/bin/env node
/* eslint-disable no-console */
// Simple keepalive ping for backend services.
// Usage:
//   KEEPALIVE_URLS="https://your-backend/healthz,https://your-backend/jobs/recommendations/warmup?limit=40" node scripts/keepalive_ping.mjs

const urlsRaw = process.env.KEEPALIVE_URLS || '';
const urls = urlsRaw
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

if (!urls.length) {
  console.error('No KEEPALIVE_URLS provided. Example: KEEPALIVE_URLS="https://api.example.com/healthz"');
  process.exit(1);
}

const run = async () => {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetch(url, { method: 'GET' });
      return { url, status: res.status };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      console.log(`✅ ${result.value.url} -> ${result.value.status}`);
    } else {
      console.warn(`⚠️ ${result.reason?.message || 'failed'} (${String(result.reason)})`);
    }
  }
};

run().catch((err) => {
  console.error('Keepalive failed:', err);
  process.exit(1);
});
