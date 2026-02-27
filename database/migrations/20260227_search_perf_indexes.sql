-- Search performance indexes + normalization backfill for hybrid search.
SET lock_timeout = '5s';
SET statement_timeout = '20min';
SET idle_in_transaction_session_timeout = '2min';

-- Backfill normalized columns so the search function doesn't normalize per-row at query time.
UPDATE public.jobs j
SET
    contract_type_norm = public.normalize_contract_type(j.contract_type),
    work_model_norm = public.normalize_work_model(j.work_model, j.title, j.description, j.location)
WHERE
    contract_type_norm IS NULL
    OR work_model_norm IS NULL
    OR contract_type_norm IS DISTINCT FROM public.normalize_contract_type(j.contract_type)
    OR work_model_norm IS DISTINCT FROM public.normalize_work_model(j.work_model, j.title, j.description, j.location);

UPDATE public.jobs j
SET
    benefits_norm = public.normalize_benefits_tags(j.benefits, j.description, j.title)
WHERE
    benefits_norm IS NULL
    OR benefits_norm IS DISTINCT FROM public.normalize_benefits_tags(j.benefits, j.description, j.title);

-- GIN indexes for normalized filters
CREATE INDEX IF NOT EXISTS idx_jobs_contract_type_norm ON public.jobs USING GIN (contract_type_norm);
CREATE INDEX IF NOT EXISTS idx_jobs_work_model_norm ON public.jobs USING GIN (work_model_norm);
CREATE INDEX IF NOT EXISTS idx_jobs_benefits_norm ON public.jobs USING GIN (benefits_norm);

-- Functional indexes for country/language filters
CREATE INDEX IF NOT EXISTS idx_jobs_country_code_lower ON public.jobs ((lower(country_code)));
CREATE INDEX IF NOT EXISTS idx_jobs_language_code_lower ON public.jobs ((lower(language_code)));

-- Partial index for the most common filter path
CREATE INDEX IF NOT EXISTS idx_jobs_active_legal_scraped
ON public.jobs (scraped_at DESC)
WHERE (legality_status IS NULL OR legality_status = 'legal')
  AND (status IS NULL OR status = 'active');

-- Salary filter support
CREATE INDEX IF NOT EXISTS idx_jobs_salary_from ON public.jobs (salary_from);
