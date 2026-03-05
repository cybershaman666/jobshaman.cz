SET lock_timeout = '5s';
SET statement_timeout = '5min';
SET idle_in_transaction_session_timeout = '2min';

CREATE TABLE IF NOT EXISTS public.external_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider text NOT NULL DEFAULT 'local',
  bucket text NOT NULL,
  object_key text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'attachment',
  mime_type text,
  size_bytes bigint DEFAULT 0,
  sha256 text,
  uploaded_by uuid REFERENCES public.profiles(id),
  filename text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_assets_uploaded_by_created_at
  ON public.external_assets (uploaded_by, created_at DESC);

ALTER TABLE IF EXISTS public.cv_documents
  ADD COLUMN IF NOT EXISTS external_asset_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cv_documents_external_asset_id_fkey'
      AND conrelid = 'public.cv_documents'::regclass
  ) THEN
    ALTER TABLE public.cv_documents
      ADD CONSTRAINT cv_documents_external_asset_id_fkey
      FOREIGN KEY (external_asset_id)
      REFERENCES public.external_assets(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cv_documents_external_asset_id
  ON public.cv_documents (external_asset_id);
