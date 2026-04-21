-- Idempotent repeat of 013 + 014 for databases where those migrations were skipped or schema cache drifted.
-- Safe to run multiple times.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_whatsapp_media_id TEXT;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_apartment_detail TEXT;

COMMENT ON COLUMN sessions.pending_whatsapp_media_id IS 'WhatsApp media id to attach to the next ticket created in this session (cleared after attach or session reset).';

COMMENT ON COLUMN sessions.pending_apartment_detail IS 'Resident apartment/floor hint; merged into next ticket description.';
