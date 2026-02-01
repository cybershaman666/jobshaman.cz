-- Add stripe_price_id column to subscriptions table
-- This fixes the error: Could not find the 'stripe_price_id' column of 'subscriptions' in the schema cache
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
-- Create an index for faster lookups if needed
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_price_id ON subscriptions(stripe_price_id);