ALTER TABLE IF EXISTS public.assessments
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS source_job_id bigint,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.assessment_invitations
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS job_id bigint;

ALTER TABLE IF EXISTS public.assessment_results
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS job_id bigint;

DO $$
BEGIN
  IF to_regclass('public.assessments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assessments_company_status
      ON public.assessments (company_id, status, "createdAt" DESC)';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.assessment_invitations') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assessment_invitations_application_id
      ON public.assessment_invitations (application_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assessment_invitations_job_id
      ON public.assessment_invitations (job_id)';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.assessment_results') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assessment_results_application_id
      ON public.assessment_results (application_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assessment_results_job_id
      ON public.assessment_results (job_id)';
  END IF;
END
$$;
