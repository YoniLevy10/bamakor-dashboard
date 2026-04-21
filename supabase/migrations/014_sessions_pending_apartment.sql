-- Optional apartment / floor line collected before ticket description (WhatsApp session).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_apartment_detail TEXT;

COMMENT ON COLUMN sessions.pending_apartment_detail IS 'Resident apartment/floor hint; merged into next ticket description.';
