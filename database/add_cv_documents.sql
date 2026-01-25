-- Add missing cv_documents table to match code usage
CREATE TABLE IF NOT EXISTS public.cv_documents (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    file_name text,
    original_name text,
    file_url text,
    file_size integer,
    content_type text,
    is_active boolean DEFAULT false,
    parsed_data jsonb,
    uploaded_at timestamp with time zone DEFAULT now(),
    last_used timestamp with time zone,
    CONSTRAINT cv_documents_pkey PRIMARY KEY (id),
    CONSTRAINT cv_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Add RLS policies if needed
ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their own CV documents
CREATE POLICY "Users can access their own CV documents" ON public.cv_documents
    FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.cv_documents TO authenticated;
GRANT ALL ON public.cv_documents TO anon;