-- Merge flags (merged_into_ticket_id may already exist from 001_feature_columns.sql)
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tickets.is_merged IS 'True when this ticket was merged into another';
