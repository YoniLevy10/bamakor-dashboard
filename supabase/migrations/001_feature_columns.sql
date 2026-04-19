-- Run in Supabase SQL editor (or via CLI) when deploying these features.

-- #3 Default maintenance worker per project
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS assigned_worker_id UUID REFERENCES workers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_assigned_worker_id ON projects (assigned_worker_id);

COMMENT ON COLUMN projects.assigned_worker_id IS 'Default maintenance worker for this building (SMS alerts).';

-- #8 Merge duplicate tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS merged_into_ticket_id UUID REFERENCES tickets (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_merged_into ON tickets (merged_into_ticket_id);

-- #10 Residents directory (optional; UI uses when present)
CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  apartment_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE INDEX IF NOT EXISTS idx_residents_project_id ON residents (project_id);
CREATE INDEX IF NOT EXISTS idx_residents_phone ON residents (phone);
