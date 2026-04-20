ALTER TABLE clients
ADD COLUMN IF NOT EXISTS sms_sender_name TEXT DEFAULT 'במקור';

COMMENT ON COLUMN clients.sms_sender_name IS 'Brand name shown as SMS sender (019SMS source).';

