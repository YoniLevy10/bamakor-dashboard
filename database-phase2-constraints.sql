-- Phase 2: Database Constraints & Data Safety
-- These constraints strengthen data integrity without destructive schema changes

-- ============================================================================
-- 1. NOT NULL CONSTRAINTS - Prevent orphaned data
-- ============================================================================

-- Ensure all tickets have a valid client and project
ALTER TABLE tickets
ADD CONSTRAINT tickets_client_id_not_null CHECK (client_id IS NOT NULL),
ADD CONSTRAINT tickets_project_id_not_null CHECK (project_id IS NOT NULL);

-- Ensure projects always belong to a client
ALTER TABLE projects
ADD CONSTRAINT projects_client_id_not_null CHECK (client_id IS NOT NULL);

-- Ensure workers belong to a client
ALTER TABLE workers
ADD CONSTRAINT workers_client_id_not_null CHECK (client_id IS NOT NULL);

-- ============================================================================
-- 2. ENUM/CHECK CONSTRAINTS - Enforce controlled values
-- ============================================================================

-- Status values: NEW, ASSIGNED, IN_PROGRESS, WAITING_PARTS, CLOSED
ALTER TABLE tickets
ADD CONSTRAINT tickets_status_valid CHECK (
  status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'CLOSED')
);

-- Priority values: HIGH, MEDIUM, LOW (or NULL for unset)
ALTER TABLE tickets
ADD CONSTRAINT tickets_priority_valid CHECK (
  priority IN ('HIGH', 'MEDIUM', 'LOW') OR priority IS NULL
);

-- Workers: role should be controlled (or NULL)
ALTER TABLE workers
ADD CONSTRAINT workers_role_valid CHECK (
  role IN ('technician', 'supervisor', 'admin') OR role IS NULL
);

-- ============================================================================
-- 3. UNIQUE CONSTRAINTS - Prevent duplicates
-- ============================================================================

-- ticket_number must be unique per client
ALTER TABLE tickets
ADD CONSTRAINT tickets_ticket_number_client_unique UNIQUE (ticket_number, client_id);

-- Only one active session per phone number per project
ALTER TABLE sessions
ADD CONSTRAINT sessions_phone_project_active_unique UNIQUE (phone_number, project_id)
WHERE is_active = true;

-- project_code must be unique per client
ALTER TABLE projects
ADD CONSTRAINT projects_code_client_unique UNIQUE (project_code, client_id);

-- ============================================================================
-- 4. FOREIGN KEY CONSTRAINTS - Referential integrity
-- ============================================================================

-- Projects must reference existing clients
ALTER TABLE projects
ADD CONSTRAINT projects_client_id_fk 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Tickets must reference existing clients and projects
ALTER TABLE tickets
ADD CONSTRAINT tickets_client_id_fk 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
ADD CONSTRAINT tickets_project_id_fk 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Workers must reference existing clients
ALTER TABLE workers
ADD CONSTRAINT workers_client_id_fk 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Ticket logs must reference existing tickets
ALTER TABLE ticket_logs
ADD CONSTRAINT ticket_logs_ticket_id_fk 
FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;

-- Ticket attachments must reference existing tickets
ALTER TABLE ticket_attachments
ADD CONSTRAINT ticket_attachments_ticket_id_fk 
FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;

-- Sessions must reference existing projects
ALTER TABLE sessions
ADD CONSTRAINT sessions_project_id_fk 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ============================================================================
-- 5. DEFAULT VALUES - Sensible defaults
-- ============================================================================

-- Sessions should default to inactive
ALTER TABLE sessions
ALTER COLUMN is_active SET DEFAULT false;

-- Workers should default to active
ALTER TABLE workers
ALTER COLUMN is_active SET DEFAULT true;

-- Projects should default to active
ALTER TABLE projects
ALTER COLUMN is_active SET DEFAULT true;

-- Tickets should default to NEW status
ALTER TABLE tickets
ALTER COLUMN status SET DEFAULT 'NEW';

-- ============================================================================
-- 6. INDEXES - Already applied, documented for reference
-- ============================================================================

-- See database-indexes.sql for performance indexes
