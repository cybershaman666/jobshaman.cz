ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'native_challenge',
  ADD COLUMN IF NOT EXISTS challenge_format text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS assessment_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS handshake_blueprint_v1 jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS capacity_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS editor_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_company_status
  ON opportunities(company_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_native_active
  ON opportunities(status, is_active, source_kind);

CREATE TABLE IF NOT EXISTS slot_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  owner_id uuid NOT NULL,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  handshake_id uuid REFERENCES handshakes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'reserved',
  reason text NOT NULL DEFAULT 'handshake_initiated',
  reserved_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (scope IN ('candidate', 'company_challenge')),
  CHECK (status IN ('reserved', 'consumed', 'released', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_slot_reservations_owner_status
  ON slot_reservations(scope, owner_id, status, reserved_at DESC);

CREATE INDEX IF NOT EXISTS idx_slot_reservations_handshake
  ON slot_reservations(handshake_id);

CREATE INDEX IF NOT EXISTS idx_slot_reservations_opportunity
  ON slot_reservations(opportunity_id, status);
