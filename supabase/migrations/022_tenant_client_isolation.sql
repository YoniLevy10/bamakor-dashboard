-- Multi-tenant: organizations.client_id backfill, RLS for authenticated tenant reads,
-- unique (client_id, project_code) on projects.

-- 1) Backfill: ארגונים ללא client_id משויכים ללקוח הקיים הראשון (נתוני projects כבר מצביעים עליו).
UPDATE public.organizations o
SET client_id = sub.id
FROM (
  SELECT id FROM public.clients ORDER BY created_at ASC LIMIT 1
) AS sub
WHERE o.client_id IS NULL
  AND sub.id IS NOT NULL;

-- 2) Authenticated users can read their own tenant chain (browser resolveBamakorClientIdForBrowser)
DO $$
BEGIN
  CREATE POLICY "authenticated_read_own_organization_users"
    ON public.organization_users
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_read_orgs_of_member"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_users ou
        WHERE ou.organization_id = organizations.id
          AND ou.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_read_client_of_member_org"
    ON public.clients
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.organization_users ou
        JOIN public.organizations o ON o.id = ou.organization_id
        WHERE ou.user_id = auth.uid()
          AND o.client_id = clients.id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) project_code unique per tenant (not globally)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_client_id_project_code_key;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_id_project_code_key UNIQUE (client_id, project_code);
