-- Career OS: model registry, release flags, seasonal bias correction, role taxonomy, AI quality metrics

create extension if not exists pgcrypto;

create table if not exists model_registry (
  id uuid primary key default gen_random_uuid(),
  subsystem text not null check (subsystem in ('ai_orchestration', 'matching')),
  feature text not null,
  version text not null,
  provider text not null default 'google',
  model_name text not null,
  temperature numeric(6,4),
  top_p numeric(6,4),
  top_k integer,
  is_primary boolean not null default false,
  is_fallback boolean not null default false,
  is_active boolean not null default false,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (subsystem, feature, version, model_name)
);

create index if not exists idx_model_registry_active
  on model_registry(subsystem, feature, is_active, created_at desc);

create table if not exists release_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  subsystem text not null check (subsystem in ('ai_orchestration', 'matching', 'frontend', 'admin')),
  description text,
  is_enabled boolean not null default false,
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  variant text,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_release_flags_subsystem_enabled
  on release_flags(subsystem, is_enabled);

create table if not exists seasonal_bias_corrections (
  id bigserial primary key,
  month smallint not null check (month between 1 and 12),
  country_code text,
  city text,
  skill text,
  correction_factor numeric(6,4) not null default 1.0,
  updated_at timestamptz not null default now(),
  unique (month, country_code, city, skill)
);

create index if not exists idx_seasonal_bias_lookup
  on seasonal_bias_corrections(month, country_code, city, skill);

create table if not exists role_taxonomy (
  id bigserial primary key,
  canonical_role text not null unique,
  role_family text,
  role_track text,
  seniority_default text,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_role_taxonomy_family_track
  on role_taxonomy(role_family, role_track);

alter table salary_normalization
  add column if not exists role_taxonomy_id bigint references role_taxonomy(id),
  add column if not exists role_family text,
  add column if not exists role_track text;

create index if not exists idx_salary_normalization_taxonomy
  on salary_normalization(role_taxonomy_id, role_family, role_track);

-- Optional conversion metric table for AI quality dashboard
create table if not exists ai_conversion_metrics (
  id bigserial primary key,
  user_id uuid,
  feature text not null,
  action text not null,
  action_value numeric(10,4),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_conversion_metrics_feature_created
  on ai_conversion_metrics(feature, created_at desc);

-- Seed model registry defaults
insert into model_registry(subsystem, feature, version, provider, model_name, temperature, top_p, top_k, is_primary, is_fallback, is_active, config_json)
select 'ai_orchestration', 'profile_generate', 'v1', 'google', 'gemini-1.5-flash', 0, 1, 1, true, false, true, '{"deterministic": true}'::jsonb
where not exists (
  select 1 from model_registry
  where subsystem = 'ai_orchestration' and feature = 'profile_generate' and is_primary = true and is_active = true
);

insert into model_registry(subsystem, feature, version, provider, model_name, temperature, top_p, top_k, is_primary, is_fallback, is_active, config_json)
select 'ai_orchestration', 'profile_generate', 'v1', 'google', 'gemini-1.5-flash-8b', 0, 1, 1, false, true, true, '{"deterministic": true}'::jsonb
where not exists (
  select 1 from model_registry
  where subsystem = 'ai_orchestration' and feature = 'profile_generate' and is_fallback = true and is_active = true
);

insert into model_registry(subsystem, feature, version, provider, model_name, is_primary, is_fallback, is_active, config_json)
select 'matching', 'recommendations', 'career-os-v2', 'internal', 'hybrid-vector-structured-v2', true, false, true,
  '{"shortlist_size":220,"min_score":25,"weights":{"skill":0.35,"demand":0.15,"seniority":0.15,"salary":0.15,"geo":0.20}}'::jsonb
where not exists (
  select 1 from model_registry
  where subsystem = 'matching' and feature = 'recommendations' and is_active = true
);

-- Seed release flags defaults
insert into release_flags(flag_key, subsystem, description, is_enabled, rollout_percent, variant, config_json)
select 'ai_profile_generate_v2', 'ai_orchestration', 'Enable AI profile generation V2 pipeline', true, 100, 'v2', '{}'::jsonb
where not exists (select 1 from release_flags where flag_key = 'ai_profile_generate_v2');

insert into release_flags(flag_key, subsystem, description, is_enabled, rollout_percent, variant, config_json)
select 'matching_engine_v2', 'matching', 'Enable analytical matching v2', true, 100, 'career-os-v2', '{}'::jsonb
where not exists (select 1 from release_flags where flag_key = 'matching_engine_v2');

insert into release_flags(flag_key, subsystem, description, is_enabled, rollout_percent, variant, config_json)
select 'admin_ai_quality_dashboard', 'admin', 'Enable admin AI quality dashboard widgets', true, 100, 'v1', '{}'::jsonb
where not exists (select 1 from release_flags where flag_key = 'admin_ai_quality_dashboard');

-- Seed role taxonomy defaults
insert into role_taxonomy(canonical_role, role_family, role_track, seniority_default, aliases)
select 'dispecer_dopravy', 'operations', 'transport', 'mid', array['dispečer','dispatcher','transport dispatcher']
where not exists (select 1 from role_taxonomy where canonical_role = 'dispecer_dopravy');

insert into role_taxonomy(canonical_role, role_family, role_track, seniority_default, aliases)
select 'koordinator_pece', 'healthcare', 'care', 'mid', array['koordinátor péče','patient care coordinator']
where not exists (select 1 from role_taxonomy where canonical_role = 'koordinator_pece');

insert into role_taxonomy(canonical_role, role_family, role_track, seniority_default, aliases)
select 'mistr_vyroby', 'manufacturing', 'production', 'senior', array['mistr výroby','production supervisor','shift supervisor']
where not exists (select 1 from role_taxonomy where canonical_role = 'mistr_vyroby');

-- RLS
alter table if exists public.model_registry enable row level security;
alter table if exists public.release_flags enable row level security;
alter table if exists public.seasonal_bias_corrections enable row level security;
alter table if exists public.role_taxonomy enable row level security;
alter table if exists public.ai_conversion_metrics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='model_registry' and policyname='model_registry_select_authenticated'
  ) then
    create policy model_registry_select_authenticated
      on public.model_registry for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='release_flags' and policyname='release_flags_select_authenticated'
  ) then
    create policy release_flags_select_authenticated
      on public.release_flags for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='seasonal_bias_corrections' and policyname='seasonal_bias_select_authenticated'
  ) then
    create policy seasonal_bias_select_authenticated
      on public.seasonal_bias_corrections for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='role_taxonomy' and policyname='role_taxonomy_select_authenticated'
  ) then
    create policy role_taxonomy_select_authenticated
      on public.role_taxonomy for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ai_conversion_metrics' and policyname='ai_conversion_metrics_select_own'
  ) then
    create policy ai_conversion_metrics_select_own
      on public.ai_conversion_metrics for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
