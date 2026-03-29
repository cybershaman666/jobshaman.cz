# Northflank scraper job

The scraper runtime on Northflank should run the unified ingest, not only `scraper.run_parallel`.

## Why the old setup fails

- `runtime-services/scraper/requirements.txt` only installed a minimal scraper subset
- that runtime did not include `python-jobspy`
- it also did not include `psycopg[binary]` for Jobs Postgres writes
- the container command only ran classic scrapers, not the unified ingest pipeline

## Fixed runtime behavior

The scraper container now:

- installs `backend/requirements.txt`
- runs `backend/scripts/run_northflank_scraper_job.py`
- delegates to `backend/scripts/run_unified_jobs_ingest.py`
- works in postgres-first mode when `JOBS_POSTGRES_URL` is configured

## Recommended Northflank env

Required:

- `JWT_SECRET` or `SECRET_KEY`
- `JOBS_POSTGRES_URL` or equivalent Postgres envs already supported by backend config
- `JOBS_POSTGRES_ENABLED=true`
- `JOBS_POSTGRES_WRITE_MAIN=true`
- `JOBS_POSTGRES_WRITE_EXTERNAL=true`
- `JOBS_POSTGRES_SERVE_MAIN=true`
- `JOBS_POSTGRES_SERVE_EXTERNAL=true`

Optional scraper-job tuning:

- `SCRAPER_JOB_COUNTRIES=CZ,AT,DE,SK,PL`
- `SCRAPER_JOB_SITES=indeed,linkedin,google`
- `SCRAPER_JOB_QUERIES=software engineer,project manager,data analyst,sales,marketing,customer support,operations`
- `SCRAPER_JOB_RESULTS_WANTED=30`
- `SCRAPER_JOB_HOURS_OLD=168`
- `SCRAPER_JOB_JOBSPY_SLEEP_SECONDS=1.0`
- `SCRAPER_JOB_LIMIT_LOCATIONS_PER_COUNTRY=4`
- `SCRAPER_JOB_JOBSPY_GEOCODING_LIMIT=1200`
- `SCRAPER_JOB_LINKEDIN_FETCH_DESCRIPTION=true`
- `SCRAPER_JOB_SKIP_SCRAPER_MULTI=false`
- `SCRAPER_JOB_SKIP_JOBSPY=false`
- `SCRAPER_JOB_SKIP_JOBSPY_GEOCODING_BACKFILL=false`
- `SCRAPER_JOB_DISABLE_REMOTE_NORMALIZATION=false`

## If Supabase is gone

That is fine for this job.

The scraper still logs missing Supabase, but it can continue in postgres-only mode as long as Jobs Postgres write flags are enabled and the database is reachable.
