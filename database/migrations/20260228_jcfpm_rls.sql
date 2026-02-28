-- JCFPM RLS hardening
-- - jcfpm_items: publicly readable, write protected (no client write policies)
-- - jcfpm_results: users can access only their own rows

ALTER TABLE public.jcfpm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jcfpm_results ENABLE ROW LEVEL SECURITY;

-- Idempotent cleanup
DROP POLICY IF EXISTS jcfpm_items_select_public ON public.jcfpm_items;
DROP POLICY IF EXISTS jcfpm_results_select_own ON public.jcfpm_results;
DROP POLICY IF EXISTS jcfpm_results_insert_own ON public.jcfpm_results;
DROP POLICY IF EXISTS jcfpm_results_update_own ON public.jcfpm_results;

-- Item bank is intentionally readable for everyone (test is open to all)
CREATE POLICY jcfpm_items_select_public
  ON public.jcfpm_items
  FOR SELECT
  USING (true);

-- Results: strict per-user isolation
CREATE POLICY jcfpm_results_select_own
  ON public.jcfpm_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY jcfpm_results_insert_own
  ON public.jcfpm_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY jcfpm_results_update_own
  ON public.jcfpm_results
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
