-- Error logs, ticket internal chat, SLA columns, org.client_id, realtime publication

CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  whatsapp_attempts INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_error_logs_context_resolved ON public.error_logs (context, resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_whatsapp_retry
  ON public.error_logs (context, resolved, whatsapp_attempts)
  WHERE context = 'whatsapp_send' AND resolved = false;

COMMENT ON COLUMN public.error_logs.whatsapp_attempts IS 'whatsapp_send: number of failed send rounds; retries while < 3.';

CREATE TABLE IF NOT EXISTS public.ticket_internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_internal_messages_ticket
  ON public.ticket_internal_messages (ticket_id, created_at DESC);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 24;

UPDATE public.projects SET sla_hours = 24 WHERE sla_hours IS NULL;

ALTER TABLE public.projects ALTER COLUMN sla_hours SET DEFAULT 24;
ALTER TABLE public.projects ALTER COLUMN sla_hours SET NOT NULL;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_sla_hours_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_sla_hours_check CHECK (sla_hours > 0 AND sla_hours <= 8760);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS manager_phone TEXT;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS sla_alerted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_internal_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.error_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_only" ON public.error_logs
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.ticket_internal_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_only" ON public.ticket_internal_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Legacy dashboard client uses the anon key with broad policies (see 011_rls_anon_dashboard_access.sql).
DO $$
BEGIN
  CREATE POLICY "anon_dashboard_error_logs" ON public.error_logs
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_ticket_internal_messages" ON public.ticket_internal_messages
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_internal_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
