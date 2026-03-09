SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

CREATE TABLE IF NOT EXISTS public.external_live_search_cache (
  cache_key text PRIMARY KEY,
  provider text NOT NULL,
  search_term text,
  filter_city text,
  country_codes text[] NOT NULL DEFAULT '{}',
  exclude_country_codes text[] NOT NULL DEFAULT '{}',
  page integer NOT NULL DEFAULT 1,
  result_count integer NOT NULL DEFAULT 0,
  payload_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_live_search_cache_provider_fetched_at
  ON public.external_live_search_cache (provider, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_live_search_cache_expires_at
  ON public.external_live_search_cache (expires_at);
