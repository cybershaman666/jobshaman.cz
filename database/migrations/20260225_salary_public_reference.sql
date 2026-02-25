CREATE TABLE IF NOT EXISTS public.salary_public_reference (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code text NOT NULL,
    role_family text NOT NULL,
    region_key text NOT NULL,
    seniority_band text NOT NULL,
    employment_type text NOT NULL,
    currency text NOT NULL DEFAULT 'CZK',
    p25 numeric,
    p50 numeric,
    p75 numeric,
    sample_size integer DEFAULT 0,
    data_window_days integer,
    source_name text NOT NULL,
    source_url text,
    period_label text,
    measure_type text NOT NULL DEFAULT 'median',
    gross_net text NOT NULL DEFAULT 'gross',
    employment_scope text NOT NULL DEFAULT 'full_time',
    updated_at timestamptz NOT NULL DEFAULT now(),
    method_version text DEFAULT 'salary-benchmark-v2'
);

CREATE UNIQUE INDEX IF NOT EXISTS salary_public_reference_unique
ON public.salary_public_reference (
    country_code,
    role_family,
    region_key,
    seniority_band,
    employment_type,
    gross_net,
    measure_type
);

CREATE INDEX IF NOT EXISTS salary_public_reference_country_role_idx
ON public.salary_public_reference (country_code, role_family);
