-- Performance: indexes for common dashboard / tenant queries (Apr 2026)
--
-- Some Supabase projects (e.g. MVP) were created without `tickets.client_id` or
-- `error_logs.client_id` even though the app expects them. Add columns + backfill
-- before creating indexes so this migration succeeds everywhere.

-- tickets.client_id (aligns with app selects / RLS-style filtering)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

UPDATE public.tickets t
SET client_id = p.client_id
FROM public.projects p
WHERE t.project_id = p.id
  AND t.client_id IS NULL
  AND p.client_id IS NOT NULL;

UPDATE public.tickets t
SET client_id = o.client_id
FROM public.projects p
JOIN public.organizations o ON o.id = p.organization_id
WHERE t.project_id = p.id
  AND t.client_id IS NULL
  AND o.client_id IS NOT NULL;

-- workers / residents: defensive (same class of "column does not exist" on partial DBs)
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

UPDATE public.workers w
SET client_id = o.client_id
FROM public.organizations o
WHERE w.organization_id = o.id
  AND w.client_id IS NULL
  AND o.client_id IS NOT NULL;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE CASCADE;

UPDATE public.residents r
SET client_id = p.client_id
FROM public.projects p
WHERE r.project_id = p.id
  AND r.client_id IS NULL
  AND p.client_id IS NOT NULL;

UPDATE public.residents r
SET client_id = o.client_id
FROM public.projects p
JOIN public.organizations o ON o.id = p.organization_id
WHERE r.project_id = p.id
  AND r.client_id IS NULL
  AND o.client_id IS NOT NULL;

-- error_logs: optional tenant column for filtered listings (details often holds client_id for WhatsApp)
ALTER TABLE public.error_logs
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

UPDATE public.error_logs el
SET client_id = (el.details->>'client_id')::uuid
WHERE el.client_id IS NULL
  AND el.details ? 'client_id'
  AND (el.details->>'client_id') ~ '^[0-9a-fA-F-]{36}$';

-- Indexes (IF NOT EXISTS keeps re-runs safe)
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON public.tickets (client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client_status ON public.tickets (client_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_client_created ON public.tickets (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_residents_client_id ON public.residents (client_id);
CREATE INDEX IF NOT EXISTS idx_workers_client_id ON public.workers (client_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ticket_id ON public.ticket_logs (ticket_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_lookup ON public.whatsapp_templates (client_id, template_key);
CREATE INDEX IF NOT EXISTS idx_error_logs_client ON public.error_logs (client_id, created_at DESC);
