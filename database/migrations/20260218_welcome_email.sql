-- Track whether welcome email was sent to avoid duplicates.
SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false;
