CREATE INDEX IF NOT EXISTS idx_tickets_client_status ON tickets (client_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets (created_at DESC);

-- Schema uses residents.phone (legacy task name referenced phone_number)
CREATE INDEX IF NOT EXISTS idx_residents_phone_client ON residents (phone, client_id)
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_msg ON processed_webhooks (message_id, client_id);

-- Lightweight monitoring rows (cron → /api/cron/health-check)
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info',
  source text DEFAULT 'cron',
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs (created_at DESC);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE system_logs IS 'Operational probes (health checks); inserts via service role';
