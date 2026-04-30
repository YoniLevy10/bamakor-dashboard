-- Fix workers phone uniqueness: allow same phone across clients.
-- Old (wrong): unique phone globally.
-- New (correct): unique (phone, client_id).

ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_phone_unique;

-- Defensive: in case it was implemented as a unique index (name may vary).
DROP INDEX IF EXISTS public.workers_phone_unique;
DROP INDEX IF EXISTS public.idx_workers_phone_unique;

-- Correct uniqueness: same phone cannot appear twice within same client.
CREATE UNIQUE INDEX IF NOT EXISTS workers_phone_client_unique
ON public.workers (phone, client_id);

