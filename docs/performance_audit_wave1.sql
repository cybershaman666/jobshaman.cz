-- Wave 1 performance/storage audit queries (run in Supabase SQL editor).

-- 1) Table/index footprint for jobs + search_exposures
select
  c.relname as table_name,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('jobs', 'search_exposures')
order by pg_total_relation_size(c.oid) desc;

-- 2) Index usage for jobs/search_exposures
select
  s.schemaname,
  s.relname as table_name,
  s.indexrelname,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
from pg_stat_user_indexes s
where s.schemaname = 'public'
  and s.relname in ('jobs', 'search_exposures')
order by pg_relation_size(s.indexrelid) desc;

-- 3) search_exposures retention sanity
select
  count(*) as rows_total,
  min(shown_at) as oldest,
  max(shown_at) as newest
from public.search_exposures;

-- 4) Estimated rows/min ingest over last 1h
select
  date_trunc('minute', shown_at) as minute_bucket,
  count(*) as rows_per_minute
from public.search_exposures
where shown_at >= now() - interval '1 hour'
group by 1
order by 1 desc;
