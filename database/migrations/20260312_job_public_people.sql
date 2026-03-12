create table if not exists public.job_public_people (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  person_kind text not null,
  display_name text not null default '',
  display_role text not null default '',
  avatar_url text null,
  short_context text null,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_public_people_kind_check check (person_kind in ('publisher', 'responder'))
);

create unique index if not exists idx_job_public_people_single_publisher
  on public.job_public_people (job_id)
  where person_kind = 'publisher' and is_visible = true;

create unique index if not exists idx_job_public_people_user_kind_unique
  on public.job_public_people (job_id, user_id, person_kind);

create index if not exists idx_job_public_people_job_visible_order
  on public.job_public_people (job_id, is_visible, display_order asc, created_at asc);

create index if not exists idx_job_public_people_company_visible
  on public.job_public_people (company_id, is_visible, person_kind);
