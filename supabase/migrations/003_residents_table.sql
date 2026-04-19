-- Residents directory (run in Supabase SQL if table is missing)
-- If an older residents table already exists from 001_feature_columns.sql, skip or align columns manually.

CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  apartment_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_residents_project_id ON residents (project_id);
