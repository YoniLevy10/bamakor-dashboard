-- Public report: remove broad anon access to projects; optional WhatsApp display number for QR wa.me links.

-- 1) WhatsApp / wa.me: E.164 digits without + (separate from Meta phone_number_id)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_business_phone TEXT;

COMMENT ON COLUMN public.clients.whatsapp_business_phone IS 'Business WhatsApp number for wa.me links (digits, e.g. 9725XXXXXXXX); optional.';

-- 2) Drop permissive anon policy on projects (from 011)
DROP POLICY IF EXISTS "anon_dashboard_projects" ON public.projects;

-- 3) Anon cannot read projects directly; public app uses GET /api/public/projects (service role + validation).
