-- Phase 3: resident uniqueness, ticket metadata, priority check, failed SMS log

-- One resident phone per tenant (normalized app-side to DB `phone` key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_client_phone_unique
ON residents (client_id, phone)
WHERE phone IS NOT NULL AND client_id IS NOT NULL;

-- Optional JSON bag for WhatsApp extras (e.g. shared location)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tickets.ticket_metadata IS 'Structured extras (WhatsApp location, etc.)';

-- Priority domain (add URGENT)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_priority_check
  CHECK (
    priority IS NULL OR priority::text IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
  );

-- Outbound SMS failures (019SMS retries exhausted)
CREATE TABLE IF NOT EXISTS failed_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients (id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  destination TEXT,
  payload TEXT,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_notifications_created ON failed_notifications (created_at DESC);

COMMENT ON TABLE failed_notifications IS 'Final failure after retries (e.g. 019SMS)';

-- Stash WhatsApp shared location until a ticket row exists (same pattern as pending image)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_location JSONB;
