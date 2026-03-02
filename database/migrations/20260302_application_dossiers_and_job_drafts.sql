alter table if exists public.job_applications
  add column if not exists source text,
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists cover_letter text,
  add column if not exists cv_document_id uuid,
  add column if not exists cv_snapshot jsonb default '{}'::jsonb,
  add column if not exists candidate_profile_snapshot jsonb default '{}'::jsonb,
  add column if not exists jcfpm_share_level text,
  add column if not exists shared_jcfpm_payload jsonb default '{}'::jsonb,
  add column if not exists application_payload jsonb default '{}'::jsonb,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid;

update public.job_applications
set
  submitted_at = coalesce(submitted_at, applied_at, created_at, now()),
  updated_at = coalesce(updated_at, created_at, applied_at, now()),
  source = coalesce(source, 'legacy')
where
  submitted_at is null
  or updated_at is null
  or source is null;

create index if not exists idx_job_applications_company_status_submitted
  on public.job_applications (company_id, status, submitted_at desc);

create index if not exists idx_job_applications_candidate_job
  on public.job_applications (candidate_id, job_id);

create table if not exists public.job_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id bigint null,
  status text not null default 'draft',
  title text not null default '',
  role_summary text not null default '',
  team_intro text not null default '',
  responsibilities text not null default '',
  requirements text not null default '',
  nice_to_have text not null default '',
  benefits_structured jsonb not null default '[]'::jsonb,
  salary_from numeric null,
  salary_to numeric null,
  salary_currency text not null default 'CZK',
  salary_timeframe text not null default 'month',
  contract_type text null,
  work_model text null,
  workplace_address text null,
  location_public text null,
  application_instructions text not null default '',
  contact_email text null,
  quality_report jsonb not null default '{}'::jsonb,
  ai_suggestions jsonb not null default '{}'::jsonb,
  editor_state jsonb not null default '{}'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_drafts_status_check check (status in ('draft', 'ready_for_publish', 'published_linked', 'archived'))
);

create index if not exists idx_job_drafts_company_updated
  on public.job_drafts (company_id, updated_at desc);

create index if not exists idx_job_drafts_job
  on public.job_drafts (job_id);

create table if not exists public.job_versions (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null,
  draft_id uuid null references public.job_drafts(id) on delete set null,
  version_number integer not null,
  published_snapshot jsonb not null default '{}'::jsonb,
  change_summary text null,
  published_by uuid null,
  published_at timestamptz not null default now()
);

create unique index if not exists idx_job_versions_job_version_unique
  on public.job_versions (job_id, version_number);

create index if not exists idx_job_versions_job_published
  on public.job_versions (job_id, published_at desc);
