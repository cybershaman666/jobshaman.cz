# JCFPM MongoDB Rollout

## Env vars

Set in backend runtime:

- `JCFPM_ITEMS_PROVIDER=auto` (`mongo|supabase|auto`)
- `MONGODB_URI=...`
- `MONGODB_DB=jobshaman`
- `MONGODB_JCFPM_COLLECTION=jcfpm_items`

## Seed pipeline

1. Generate 432-item pool JSON:

```bash
python3 scripts/generate_jcfpm_pool_v3.py
```

2. Validate + seed to Mongo (dry run first):

```bash
python3 backend/scripts/seed_jcfpm_pool_mongo.py --dry-run
python3 backend/scripts/seed_jcfpm_pool_mongo.py
```

## Diagnostics

Check source and fallback health:

```bash
GET /tests/jcfpm/diagnostics
```

Key fields:

- `provider_mode`
- `source`
- `latency_ms`
- `fallback_used`
- `fallback_reason`
- `metrics.fallback_count`

## Rollout phases

1. **Staging**: `JCFPM_ITEMS_PROVIDER=auto`, verify diagnostics and pool counts.
2. **Canary**: release to subset of traffic, monitor fallback ratio.
3. **Full rollout**: keep `auto` mode in production.
4. **Optional cleanup**: once stable, retire Supabase `jcfpm_items` as active source.
