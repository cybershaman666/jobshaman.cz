-- Backfill assessment_invitations.company_id when legacy rows stored user_id

-- Map owner_id -> company_id (choose the smallest company id for determinism)
WITH owner_map AS (
  SELECT owner_id, MIN(id::text)::uuid AS company_id
  FROM public.companies
  GROUP BY owner_id
)
UPDATE public.assessment_invitations ai
SET company_id = owner_map.company_id
FROM owner_map
WHERE ai.company_id = owner_map.owner_id;

-- Map member user_id -> company_id for any remaining legacy rows
WITH member_map AS (
  SELECT user_id, MIN(company_id::text)::uuid AS company_id
  FROM public.company_members
  GROUP BY user_id
)
UPDATE public.assessment_invitations ai
SET company_id = member_map.company_id
FROM member_map
WHERE ai.company_id = member_map.user_id;
