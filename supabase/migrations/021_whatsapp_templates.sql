-- WhatsApp message templates per client (dashboard-editable)

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  template_key text NOT NULL,
  template_text text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (client_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_client ON public.whatsapp_templates (client_id);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.whatsapp_templates
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_only" ON public.whatsapp_templates
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_whatsapp_templates" ON public.whatsapp_templates
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
