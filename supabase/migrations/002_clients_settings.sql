-- Settings columns on clients (Bamakor dashboard /settings)
-- Create Storage bucket `client-logos` (public read) in Supabase Dashboard if missing.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'he';

ALTER TABLE clients ADD COLUMN IF NOT EXISTS manager_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_worker_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sms_on_ticket_open BOOLEAN DEFAULT TRUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sms_on_ticket_close BOOLEAN DEFAULT TRUE;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'basic';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS buildings_allowed INTEGER DEFAULT 10;

COMMENT ON COLUMN clients.whatsapp_access_token IS 'Meta WhatsApp token; prefer storing in DB for dashboard, not only .env';
COMMENT ON COLUMN clients.whatsapp_phone_number_id IS 'Meta Phone Number ID for Graph API';
