alter table public.companies
  add column if not exists team_member_profiles jsonb not null default '{}'::jsonb;
