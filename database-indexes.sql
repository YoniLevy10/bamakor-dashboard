-- Stability Pass: Database Performance Indexes
-- These indexes optimize the most critical queries without changing schema

-- Index 1: Sessions lookup by phone number and active status
-- Used when receiving WhatsApp messages to find active ticket context
CREATE INDEX IF NOT EXISTS idx_sessions_phone_active 
ON sessions(phone_number, is_active) 
WHERE is_active = true;

-- Index 2: Tickets filtering by project and status
-- Used on dashboard to filter tickets by status within a project
CREATE INDEX IF NOT EXISTS idx_tickets_project_status 
ON tickets(project_id, status);

-- Index 3: Projects lookup by project_code
-- Used to find projects by their unique code
CREATE INDEX IF NOT EXISTS idx_projects_project_code 
ON projects(project_code UNIQUE);

-- Index 4: Attachments by ticket ID with ordering
-- Used when loading attachments for a ticket (most critical for display)
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id 
ON ticket_attachments(ticket_id, created_at DESC);

-- Index 5: Pending selections by phone number
-- Used when processing pending user selections
CREATE INDEX IF NOT EXISTS idx_pending_selections_phone 
ON pending_selections(phone_number);

-- Optional: Partial index for active tickets (optimization)
CREATE INDEX IF NOT EXISTS idx_tickets_active 
ON tickets(status) 
WHERE status IN ('open', 'in_progress', 'pending');
