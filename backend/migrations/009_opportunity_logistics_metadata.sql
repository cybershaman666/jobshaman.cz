ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS hours_per_week integer,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS benefits text NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS work_perks text NOT NULL DEFAULT '[]';
