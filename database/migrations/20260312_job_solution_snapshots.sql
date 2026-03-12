create table if not exists public.job_solution_snapshots (
  id uuid primary key default gen_random_uuid(),
  dialogue_id uuid not null references public.job_applications(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  problem text not null default '',
  solution text not null default '',
  result text not null default '',
  problem_tags jsonb not null default '[]'::jsonb,
  solution_tags jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  share_slug text null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_job_solution_snapshots_dialogue_unique
  on public.job_solution_snapshots (dialogue_id);

create unique index if not exists idx_job_solution_snapshots_share_slug_unique
  on public.job_solution_snapshots (share_slug)
  where share_slug is not null;

create index if not exists idx_job_solution_snapshots_candidate_created
  on public.job_solution_snapshots (candidate_id, created_at desc);

create index if not exists idx_job_solution_snapshots_company_created
  on public.job_solution_snapshots (company_id, created_at desc);
