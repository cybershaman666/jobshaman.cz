-- JCFPM sharing support under RLS
-- Keep owner-only access by default, but allow opt-in public sharing per result.

ALTER TABLE public.jcfpm_results
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_slug text;

-- Ensure share_slug uniqueness when present.
CREATE UNIQUE INDEX IF NOT EXISTS jcfpm_results_share_slug_uidx
  ON public.jcfpm_results (share_slug)
  WHERE share_slug IS NOT NULL;

-- Replace select policy to allow:
-- 1) owner access (auth.uid() = user_id)
-- 2) public shared access (is_shared = true)
DROP POLICY IF EXISTS jcfpm_results_select_own ON public.jcfpm_results;
DROP POLICY IF EXISTS jcfpm_results_select_own_or_shared ON public.jcfpm_results;

CREATE POLICY jcfpm_results_select_own_or_shared
  ON public.jcfpm_results
  FOR SELECT
  USING (auth.uid() = user_id OR is_shared = true);
