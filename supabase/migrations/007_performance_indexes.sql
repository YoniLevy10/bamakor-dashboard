CREATE INDEX IF NOT EXISTS idx_sessions_phone_client ON sessions (phone_number, client_id)
WHERE
  is_active = true;

CREATE INDEX IF NOT EXISTS idx_tickets_client_status ON tickets (client_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_client_project ON tickets (client_id, project_id);

CREATE INDEX IF NOT EXISTS idx_projects_client_code ON projects (client_id, project_code);

CREATE INDEX IF NOT EXISTS idx_residents_client_phone ON residents (client_id, phone);

CREATE INDEX IF NOT EXISTS idx_workers_client_active ON workers (client_id, is_active);
