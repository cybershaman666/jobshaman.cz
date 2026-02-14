-- Career OS: recommendation exposure logging, implicit feedback signals, probability model registry and offline evaluations

create extension if not exists pgcrypto;

create table if not exists recommendation_exposures (
  id bigserial primary key,
  request_id uuid not null,
  user_id uuid not null references candidate_profiles(id) on delete cascade,
  job_id bigint not null references jobs(id) on delete cascade,
  position integer not null check (position >= 1),
  score numeric(8,4) not null,
  predicted_action_probability numeric(10,6),
  action_model_version text,
  ranking_strategy text,
  is_new_job boolean,
  is_long_tail_company boolean,
  model_version text not null,
  scoring_version text not null,
  source text not null default 'recommendations_api',
  shown_at timestamptz not null default now(),
  unique (request_id, user_id, job_id)
);

create index if not exists idx_recommendation_exposures_user_time
  on recommendation_exposures(user_id, shown_at desc);

create index if not exists idx_recommendation_exposures_scoring
  on recommendation_exposures(scoring_version, shown_at desc);

create index if not exists idx_recommendation_exposures_job
  on recommendation_exposures(job_id, shown_at desc);

create table if not exists recommendation_feedback_events (
  id bigserial primary key,
  request_id uuid,
  user_id uuid not null references profiles(id) on delete cascade,
  job_id bigint not null references jobs(id) on delete cascade,
  signal_type text not null check (signal_type in ('impression','open_detail','apply_click','save','unsave','dwell_ms','scroll_depth')),
  signal_value numeric(12,4),
  scoring_version text,
  model_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_recommendation_feedback_user_time
  on recommendation_feedback_events(user_id, created_at desc);

create index if not exists idx_recommendation_feedback_signal_time
  on recommendation_feedback_events(signal_type, created_at desc);

create index if not exists idx_recommendation_feedback_request
  on recommendation_feedback_events(request_id, user_id, job_id);

create table if not exists action_prediction_models (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version text not null,
  objective text not null default 'apply_click_probability',
  coefficients_json jsonb not null,
  feature_schema_json jsonb not null default '{}'::jsonb,
  trained_on_window_days integer not null default 30 check (trained_on_window_days between 1 and 365),
  sample_size integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (model_key, version)
);

create index if not exists idx_action_prediction_models_active
  on action_prediction_models(model_key, is_active, created_at desc);

create table if not exists model_offline_evaluations (
  id bigserial primary key,
  model_key text not null,
  model_version text not null,
  scoring_version text,
  window_days integer not null,
  sample_size integer not null,
  auc numeric(8,6),
  log_loss numeric(10,6),
  precision_at_5 numeric(8,6),
  precision_at_10 numeric(8,6),
  created_at timestamptz not null default now(),
  notes text
);

create index if not exists idx_model_offline_evaluations_lookup
  on model_offline_evaluations(model_key, model_version, created_at desc);

-- Seed baseline logistic model with interpretable coefficients
insert into action_prediction_models(model_key, version, objective, coefficients_json, feature_schema_json, trained_on_window_days, sample_size, is_active)
select
  'job_apply_probability',
  'v1',
  'apply_click_probability',
  '{
    "intercept": -2.15,
    "similarity_score": 1.20,
    "skill_match": 1.55,
    "salary_alignment": 0.70,
    "seniority_alignment": 0.80,
    "recency_score": 0.35,
    "location_distance_km": -0.015
  }'::jsonb,
  '{
    "features": ["similarity_score", "skill_match", "salary_alignment", "seniority_alignment", "recency_score", "location_distance_km"],
    "normalization": "0..1 components + raw distance km"
  }'::jsonb,
  30,
  0,
  true
where not exists (
  select 1 from action_prediction_models where model_key = 'job_apply_probability' and version = 'v1'
);

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'recommendation_exposures', 180, true
where not exists (select 1 from data_retention_policies where table_name = 'recommendation_exposures');

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'recommendation_feedback_events', 365, true
where not exists (select 1 from data_retention_policies where table_name = 'recommendation_feedback_events');

insert into data_retention_policies(table_name, retain_days, is_enabled)
select 'model_offline_evaluations', 365, true
where not exists (select 1 from data_retention_policies where table_name = 'model_offline_evaluations');

-- RLS
alter table if exists public.recommendation_exposures enable row level security;
alter table if exists public.recommendation_feedback_events enable row level security;
alter table if exists public.action_prediction_models enable row level security;
alter table if exists public.model_offline_evaluations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='recommendation_exposures' and policyname='recommendation_exposures_select_own'
  ) then
    create policy recommendation_exposures_select_own
      on public.recommendation_exposures for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='recommendation_feedback_events' and policyname='recommendation_feedback_events_select_own'
  ) then
    create policy recommendation_feedback_events_select_own
      on public.recommendation_feedback_events for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='action_prediction_models' and policyname='action_prediction_models_select_authenticated'
  ) then
    create policy action_prediction_models_select_authenticated
      on public.action_prediction_models for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='model_offline_evaluations' and policyname='model_offline_evaluations_select_authenticated'
  ) then
    create policy model_offline_evaluations_select_authenticated
      on public.model_offline_evaluations for select to authenticated using (true);
  end if;
end $$;
