-- Allow "image before text" during an open WhatsApp session (building known, description not yet sent).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_whatsapp_media_id TEXT;

COMMENT ON COLUMN sessions.pending_whatsapp_media_id IS 'WhatsApp media id to attach to the next ticket created in this session (cleared after attach or session reset).';
