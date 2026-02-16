-- Remove stale auth metadata flags that can force legacy recruiter/freelancer context.
-- Safe to run repeatedly.

begin;

create table if not exists public.profile_role_cleanup_log (
  id bigserial primary key,
  profile_id uuid not null,
  old_role text not null,
  new_role text not null,
  reason text not null,
  cleaned_at timestamptz not null default now()
);

-- 1) Safety net: downgrade ghost recruiters (no company linkage) to candidate.
with ghost_recruiters as (
  select p.id
  from public.profiles p
  where p.role::text = 'recruiter'
    and not exists (
      select 1
      from public.companies c
      where c.owner_id = p.id
    )
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
  'strip_legacy_auth_profile_flags'
from role_updates ru;

-- 2) Remove stale metadata flags from users that are not linked to company context.
with users_without_company_context as (
  select p.id
  from public.profiles p
  where p.role::text <> 'recruiter'
    and not exists (
      select 1
      from public.companies c
      where c.owner_id = p.id
    )
    and not exists (
      select 1
      from public.company_members cm
      where cm.user_id = p.id
        and coalesce(cm.is_active, true) = true
    )
)
update auth.users u
set raw_user_meta_data =
  coalesce(u.raw_user_meta_data, '{}'::jsonb)
    - 'role'
    - 'is_freelancer'
    - 'company_name'
    - 'ico'
    - 'website'
where u.id in (select id from users_without_company_context)
  and coalesce(u.raw_user_meta_data, '{}'::jsonb) ?| array['role', 'is_freelancer', 'company_name', 'ico', 'website'];

commit;
