-- Daily digest preferences and delivery tracking.
SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS preferred_locale text;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS preferred_country_code text;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS daily_digest_enabled boolean DEFAULT true;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS daily_digest_last_sent_at timestamptz;
