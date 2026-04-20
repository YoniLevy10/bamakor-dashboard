-- Multi-tenant WhatsApp: scope sessions and pending selections by client

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients (id) ON DELETE CASCADE;

UPDATE sessions s
SET client_id = p.client_id
FROM projects p
WHERE s.project_id = p.id
  AND s.client_id IS NULL;

ALTER TABLE pending_selections
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sessions_phone_client_active ON sessions (phone_number, client_id)
WHERE
  is_active = true;

CREATE INDEX IF NOT EXISTS idx_pending_selections_phone_client ON pending_selections (phone_number, client_id);
