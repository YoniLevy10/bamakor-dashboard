-- SaaS multi-tenant: add organization_id to existing tables (DEFAULT NULL required)
-- Important: do not remove/alter existing columns; only add.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) DEFAULT NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) DEFAULT NULL;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) DEFAULT NULL;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) DEFAULT NULL;

ALTER TABLE public.ticket_logs
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects (organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON public.tickets (organization_id);
CREATE INDEX IF NOT EXISTS idx_workers_organization_id ON public.workers (organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_organization_id ON public.sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_organization_id ON public.ticket_logs (organization_id);

