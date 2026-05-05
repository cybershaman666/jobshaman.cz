CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  kind text NOT NULL,
  usage text,
  visibility text NOT NULL DEFAULT 'private',
  title text,
  caption text,
  original_name text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_provider text NOT NULL DEFAULT 'local',
  storage_bucket text,
  object_key text NOT NULL,
  upload_status text NOT NULL DEFAULT 'pending',
  metadata_json text NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner_user_id ON media_assets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_company_id ON media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_kind ON media_assets(kind);

ALTER TABLE candidate_cv_documents
  ADD COLUMN IF NOT EXISTS external_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS tone text,
  ADD COLUMN IF NOT EXISTS philosophy text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS legal_address text,
  ADD COLUMN IF NOT EXISTS values_json text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS profile_data text NOT NULL DEFAULT '{}';
