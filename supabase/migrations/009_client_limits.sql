-- Optional plan limits (used by API enforcement; nullable = no hard cap in app logic)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS max_workers INTEGER;

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS max_residents INTEGER;

COMMENT ON COLUMN clients.max_workers IS 'Max active workers; null = use default in app';
COMMENT ON COLUMN clients.max_residents IS 'Max residents rows; null = use default in app';
