-- Career OS: model governance + experiment layer

create extension if not exists pgcrypto;

create table if not exists scoring_model_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  alpha_skill numeric(6,4) not null,
  beta_demand numeric(6,4) not null,
  gamma_seniority numeric(6,4) not null,
  delta_salary numeric(6,4) not null,
  epsilon_geo numeric(6,4) not null,
  notes text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_scoring_model_versions_active
  on scoring_model_versions(is_active, created_at desc);

create table if not exists model_experiments (
  id uuid primary key default gen_random_uuid(),
  subsystem text not null check (subsystem in ('matching', 'ai_orchestration')),
  feature text not null,
  experiment_key text not null unique,
  control_version text not null,
  candidate_version text not null,
  traffic_percent integer not null default 10 check (traffic_percent between 0 and 100),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_model_experiments_enabled
  on model_experiments(subsystem, feature, is_enabled);

alter table recommendation_cache
  add column if not exists scoring_version text;

create index if not exists idx_recommendation_cache_model_scoring
  on recommendation_cache(model_version, scoring_version, computed_at desc);

create table if not exists data_retention_policies (
  id bigserial primary key,
  table_name text not null unique,
  retain_days integer not null check (retain_days >= 1),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into scoring_model_versions(version, alpha_skill, beta_demand, gamma_seniority, delta_salary, epsilon_geo, notes, is_active)
select 'scoring-v1', 0.35, 0.15, 0.15, 0.15, 0.20, 'Initial weighted model', true
where not exists (select 1 from scoring_model_versions where version = 'scoring-v1');

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'ai_generation_logs', 180, true
where not exists (select 1 from data_retention_policies where table_name = 'ai_generation_logs');

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'ai_generation_diffs', 180, true
where not exists (select 1 from data_retention_policies where table_name = 'ai_generation_diffs');

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'recommendation_cache', 30, true
where not exists (select 1 from data_retention_policies where table_name = 'recommendation_cache');

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'ai_conversion_metrics', 365, true
where not exists (select 1 from data_retention_policies where table_name = 'ai_conversion_metrics');

alter table if exists public.scoring_model_versions enable row level security;
alter table if exists public.model_experiments enable row level security;
alter table if exists public.data_retention_policies enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='scoring_model_versions' and policyname='scoring_model_versions_select_authenticated'
  ) then
    create policy scoring_model_versions_select_authenticated
      on public.scoring_model_versions for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='model_experiments' and policyname='model_experiments_select_authenticated'
  ) then
    create policy model_experiments_select_authenticated
      on public.model_experiments for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='data_retention_policies' and policyname='data_retention_policies_select_authenticated'
  ) then
    create policy data_retention_policies_select_authenticated
      on public.data_retention_policies for select to authenticated using (true);
  end if;
end $$;
