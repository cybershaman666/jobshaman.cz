-- Cleanup stale recruiter/freelancer residue on legacy accounts.
-- Goal:
-- 1) Revert "ghost recruiters" (no company linkage) back to candidate role.
-- 2) Remove stale auth metadata flags that previously forced recruiter context.
--
-- Safety:
-- - Only affects profiles with role='recruiter'
-- - Requires NO owned company and NO active company membership
-- - Keeps accounts that are actually connected to company data untouched

begin;

-- Keep a small audit trail of automatic cleanup runs.
create table if not exists public.profile_role_cleanup_log (
  id bigserial primary key,
  profile_id uuid not null,
  old_role text not null,
  new_role text not null,
  reason text not null,
  cleaned_at timestamptz not null default now()
);

with ghost_recruiters as (
  select p.id
  from public.profiles p
  where p.role::text = 'recruiter'
    -- No owned company
    and not exists (
      select 1
      from public.companies c
      where c.owner_id = p.id
    )
    -- No active membership in any company
    and not exists (
      select 1
      from public.company_members cm
      where cm.user_id = p.id
        and coalesce(cm.is_active, true) = true
    )
),
role_updates as (
  update public.profiles p
  set role = 'candidate'::user_role
  where p.id in (select id from ghost_recruiters)
    and p.role::text = 'recruiter'
  returning p.id
)
insert into public.profile_role_cleanup_log (profile_id, old_role, new_role, reason)
select
  ru.id,
  'recruiter',
  'candidate',
  'legacy recruiter/freelancer residue without company linkage'
from role_updates ru;

-- Metadata hygiene (optional but recommended):
-- remove stale keys that used to force recruiter/freelancer context on login.
-- Executed only for users already converted above.
with converted as (
  select l.profile_id
  from public.profile_role_cleanup_log l
  where l.cleaned_at >= now() - interval '5 minutes'
    and l.reason = 'legacy recruiter/freelancer residue without company linkage'
)
update auth.users u
set raw_user_meta_data =
  coalesce(u.raw_user_meta_data, '{}'::jsonb)
    - 'role'
    - 'is_freelancer'
    - 'company_name'
    - 'ico'
    - 'website'
where u.id in (select profile_id from converted);

commit;

