-- Soft delete for primary operational tables.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN tickets.deleted_at IS 'When set, row is treated as deleted in app queries.';
COMMENT ON COLUMN residents.deleted_at IS 'When set, row is treated as deleted in app queries.';
COMMENT ON COLUMN workers.deleted_at IS 'When set, row is treated as deleted in app queries.';
