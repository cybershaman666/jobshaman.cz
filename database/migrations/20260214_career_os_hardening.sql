-- Career OS hardening: AI orchestration + analytical matching layer

create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  system_prompt text not null,
  schema_version text not null default 'v1',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  feature text not null,
  prompt_version text,
  model_primary text,
  model_final text,
  fallback_used boolean not null default false,
  input_chars integer not null default 0,
  output_valid boolean not null default false,
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  estimated_cost numeric(12, 8),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_generation_logs_user_feature_created
  on ai_generation_logs(user_id, feature, created_at desc);

create table if not exists candidate_embeddings (
  candidate_id uuid primary key references candidate_profiles(id) on delete cascade,
  embedding vector(256) not null,
  embedding_model text not null,
  embedding_version text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_candidate_embeddings_updated_at
  on candidate_embeddings(updated_at desc);

create table if not exists job_embeddings (
  job_id bigint primary key references jobs(id) on delete cascade,
  embedding vector(256) not null,
  embedding_model text not null,
  embedding_version text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_embeddings_updated_at
  on job_embeddings(updated_at desc);

create index if not exists idx_job_embeddings_ivfflat
  on job_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists skill_graph_nodes (
  id bigserial primary key,
  skill text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists skill_graph_edges (
  id bigserial primary key,
  from_skill text not null,
  to_skill text not null,
  weight numeric(6, 4) not null default 0.0,
  relation_type text not null default 'related',
  updated_at timestamptz not null default now(),
  unique (from_skill, to_skill, relation_type)
);

create index if not exists idx_skill_graph_edges_from on skill_graph_edges(from_skill);
create index if not exists idx_skill_graph_edges_to on skill_graph_edges(to_skill);

create table if not exists market_skill_demand (
  id bigserial primary key,
  skill text not null,
  country_code text,
  city text,
  demand_score numeric(8, 4) not null default 0,
  window_start date not null,
  window_end date not null,
  updated_at timestamptz not null default now(),
  unique (skill, country_code, city, window_start, window_end)
);

create index if not exists idx_market_skill_demand_lookup
  on market_skill_demand(skill, country_code, city, window_end desc);

create table if not exists salary_normalization (
  id bigserial primary key,
  country_code text not null,
  city text,
  currency text not null,
  seniority text,
  normalized_index numeric(8, 4) not null,
  updated_at timestamptz not null default now(),
  unique (country_code, city, currency, seniority)
);

create index if not exists idx_salary_normalization_lookup
  on salary_normalization(country_code, city, currency, seniority);

create table if not exists recommendation_cache (
  id bigserial primary key,
  user_id uuid not null references candidate_profiles(id) on delete cascade,
  job_id bigint not null references jobs(id) on delete cascade,
  score numeric(8, 4) not null,
  breakdown_json jsonb not null,
  reasons_json jsonb not null default '[]'::jsonb,
  model_version text not null,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, job_id, model_version)
);

create index if not exists idx_recommendation_cache_user_expires
  on recommendation_cache(user_id, expires_at desc);

-- Seed default active prompt version used by AI profile generation V2.
insert into ai_prompt_versions(name, version, system_prompt, schema_version, is_active)
select
  'profile_generate',
  'v1',
  'You are a senior career strategist. Analyze user career story and return only JSON according to response schema.',
  'v2',
  true
where not exists (
  select 1 from ai_prompt_versions where name = 'profile_generate' and is_active = true
);
