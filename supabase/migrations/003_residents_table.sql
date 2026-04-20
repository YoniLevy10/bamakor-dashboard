-- Residents: multi-tenant directory (aligns with app/residents CRUD)
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS column checks via separate statements.

CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  apartment_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE residents ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients (id) ON DELETE CASCADE;

ALTER TABLE residents ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill client_id from project when possible
UPDATE residents r
SET
  client_id = p.client_id
FROM
  projects p
WHERE
  r.project_id = p.id
  AND r.client_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_residents_project ON residents (project_id);

CREATE INDEX IF NOT EXISTS idx_residents_client ON residents (client_id);

CREATE INDEX IF NOT EXISTS idx_residents_phone ON residents (phone);
