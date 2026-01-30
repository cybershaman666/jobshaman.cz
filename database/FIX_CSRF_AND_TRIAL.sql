-- Create CSRF Sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.csrf_sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed BOOLEAN DEFAULT FALSE
);
-- Enable RLS
ALTER TABLE public.csrf_sessions ENABLE ROW LEVEL SECURITY;
-- create policy for interaction
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.csrf_sessions;
CREATE POLICY "Enable all access for authenticated users" ON public.csrf_sessions FOR ALL USING (auth.role() = 'authenticated');
-- Grant permissions just in case
GRANT ALL ON public.csrf_sessions TO authenticated;
GRANT ALL ON public.csrf_sessions TO service_role;