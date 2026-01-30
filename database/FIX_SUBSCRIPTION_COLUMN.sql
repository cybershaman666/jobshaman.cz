-- FIX SUBSCRIPTIONS TABLE
-- Run this to fix "column subscriptions.cancel_at_period_end does not exist"
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;