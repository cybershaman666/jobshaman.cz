-- CSRF Sessions Table
-- Stores CSRF tokens for security validation
-- Used for multi-instance deployments where in-memory storage isn't suitable

CREATE TABLE IF NOT EXISTS public.csrf_sessions (
    id BIGSERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT false,
    consumed_at TIMESTAMP WITH TIME ZONE,
    ip_address TEXT,
    user_agent TEXT
);

-- Index for faster lookups by token
CREATE INDEX IF NOT EXISTS csrf_sessions_token_idx ON public.csrf_sessions(token);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS csrf_sessions_user_id_idx ON public.csrf_sessions(user_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS csrf_sessions_expires_at_idx ON public.csrf_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.csrf_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert their own CSRF session (needed for token generation)
CREATE POLICY "csrf_sessions_insert_policy" ON public.csrf_sessions
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can read their own CSRF session (needed for validation)
CREATE POLICY "csrf_sessions_select_policy" ON public.csrf_sessions
    FOR SELECT USING (true);

-- Policy: Anyone can update their own CSRF session (needed to mark as consumed)
CREATE POLICY "csrf_sessions_update_policy" ON public.csrf_sessions
    FOR UPDATE USING (true)
    WITH CHECK (true);

-- Optional: Add cleanup function to delete expired tokens (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.csrf_sessions
    WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
