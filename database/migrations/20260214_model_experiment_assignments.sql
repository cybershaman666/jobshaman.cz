-- Deterministic experiment assignment persistence for scoring versions

create table if not exists model_experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null,
  user_id uuid not null,
  subsystem text not null,
  feature text not null,
  assigned_version text not null,
  bucket integer not null check (bucket between 0 and 99),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_key, user_id)
);

create index if not exists idx_model_experiment_assignments_lookup
  on model_experiment_assignments(experiment_key, user_id);

create index if not exists idx_model_experiment_assignments_feature
  on model_experiment_assignments(subsystem, feature, assigned_version, assigned_at desc);

alter table if exists public.model_experiment_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='model_experiment_assignments' and policyname='model_experiment_assignments_select_own'
  ) then
    create policy model_experiment_assignments_select_own
      on public.model_experiment_assignments for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
