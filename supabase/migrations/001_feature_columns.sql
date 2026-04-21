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

-- Residents table: see 003_residents_table.sql (single definition; avoids duplicate/conflicting CREATE with 001).
