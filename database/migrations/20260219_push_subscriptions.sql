-- Push subscriptions and per-user digest scheduling.
SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS daily_digest_time time DEFAULT '07:30';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS daily_digest_timezone text DEFAULT 'Europe/Prague';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS daily_digest_push_enabled boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    expires_at timestamptz,
    user_agent text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON public.push_subscriptions (user_id);
