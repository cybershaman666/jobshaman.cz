-- Run in Supabase SQL Editor to inspect current storage usage.

-- 1) Top tables by total size
select
  n.nspname as schema_name,
  c.relname as table_name,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as index_toast_size,
  pg_total_relation_size(c.oid) as total_bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
order by pg_total_relation_size(c.oid) desc
limit 30;

-- 2) Estimated row counts for largest public tables
select
  relname as table_name,
  n_live_tup as est_live_rows,
  n_dead_tup as est_dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
order by n_live_tup desc
limit 30;

-- 3) Jobs column payload sampling (usually large text/json fields)
select
  avg(length(coalesce(description, '')))::bigint as avg_description_chars,
  max(length(coalesce(description, ''))) as max_description_chars,
  avg(length(coalesce(ai_analysis::text, '')))::bigint as avg_ai_analysis_chars,
  max(length(coalesce(ai_analysis::text, ''))) as max_ai_analysis_chars
from public.jobs;

-- 4) Candidate profile heavy json/text sampling
select
  avg(length(coalesce(cv_text, '')))::bigint as avg_cv_text_chars,
  max(length(coalesce(cv_text, ''))) as max_cv_text_chars,
  avg(length(coalesce(preferences::text, '')))::bigint as avg_preferences_chars,
  max(length(coalesce(preferences::text, ''))) as max_preferences_chars
from public.candidate_profiles;
