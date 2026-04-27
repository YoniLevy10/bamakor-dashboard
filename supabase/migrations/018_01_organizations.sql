-- SaaS multi-tenant: organizations + organization_users (new tables; does not modify existing ones)

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'basic'
    CHECK (plan IN ('basic','pro','enterprise')),
  whatsapp_phone_number_id TEXT,
  whatsapp_access_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id)
    ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id)
    ON DELETE CASCADE,
  role TEXT DEFAULT 'admin'
    CHECK (role IN ('admin','manager','viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations (slug);
CREATE INDEX IF NOT EXISTS idx_organization_users_org ON public.organization_users (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user ON public.organization_users (user_id);

-- RLS: keep access server-side only for now (consistent with other migrations using service_role bypass)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.organizations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.organization_users
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the existing production customer as first org (safe/idempotent)
INSERT INTO public.organizations (name, slug, plan, whatsapp_phone_number_id)
SELECT
  'חברת שרה',
  'sara',
  'pro',
  NULL
WHERE
  NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE slug = 'sara'
    LIMIT 1
  );

