-- Emergency: migration 032 was not applied to production.
-- Adds soft-delete deleted_at columns that the application code already expects.
-- Safe to run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.tickets   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.workers   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.tickets.deleted_at   IS 'Soft delete: when set, ticket is excluded from app queries.';
COMMENT ON COLUMN public.workers.deleted_at   IS 'Soft delete: when set, worker is excluded from app queries.';
COMMENT ON COLUMN public.residents.deleted_at IS 'Soft delete: when set, resident is excluded from app queries.';

-- Index for efficient soft-delete filtering
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at   ON public.tickets   (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workers_deleted_at   ON public.workers   (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_residents_deleted_at ON public.residents (deleted_at) WHERE deleted_at IS NULL;
