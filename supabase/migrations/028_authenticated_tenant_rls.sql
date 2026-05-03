-- Tenant-scoped RLS for dashboard (authenticated) + remove permissive anon_* policies.
-- Assumes users are linked via organization_users → organizations.client_id (see 022).

CREATE OR REPLACE FUNCTION public.bamakor_my_client_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT o.client_id::uuid
  FROM public.organization_users ou
  JOIN public.organizations o ON o.id = ou.organization_id
  WHERE ou.user_id = auth.uid()
    AND o.client_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.bamakor_my_client_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bamakor_my_client_ids() TO authenticated;

-- ─── Drop legacy anon_dashboard policies (broad USING (true)) ───

DROP POLICY IF EXISTS anon_dashboard_projects ON public.projects;
DROP POLICY IF EXISTS anon_dashboard_tickets ON public.tickets;
DROP POLICY IF EXISTS anon_dashboard_workers ON public.workers;
DROP POLICY IF EXISTS anon_dashboard_sessions ON public.sessions;
DROP POLICY IF EXISTS anon_dashboard_residents ON public.residents;
DROP POLICY IF EXISTS anon_dashboard_ticket_logs ON public.ticket_logs;
DROP POLICY IF EXISTS anon_dashboard_ticket_attachments ON public.ticket_attachments;

DROP POLICY IF EXISTS anon_dashboard_pending_resident_join_requests ON public.pending_resident_join_requests;

DROP POLICY IF EXISTS anon_dashboard_error_logs ON public.error_logs;
DROP POLICY IF EXISTS anon_dashboard_ticket_internal_messages ON public.ticket_internal_messages;

DROP POLICY IF EXISTS anon_dashboard_whatsapp_templates ON public.whatsapp_templates;

-- ─── Core tenant tables ───

DROP POLICY IF EXISTS authenticated_tenant_projects ON public.projects;
CREATE POLICY authenticated_tenant_projects ON public.projects
  FOR ALL
  TO authenticated
  USING (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_tenant_tickets ON public.tickets;
CREATE POLICY authenticated_tenant_tickets ON public.tickets
  FOR ALL
  TO authenticated
  USING (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_tenant_workers ON public.workers;
CREATE POLICY authenticated_tenant_workers ON public.workers
  FOR ALL
  TO authenticated
  USING (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_tenant_sessions ON public.sessions;
CREATE POLICY authenticated_tenant_sessions ON public.sessions
  FOR ALL
  TO authenticated
  USING (
    (
      sessions.client_id IS NOT NULL AND sessions.client_id IN (SELECT public.bamakor_my_client_ids())
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = sessions.project_id
          AND p.client_id IS NOT NULL
          AND p.client_id IN (SELECT public.bamakor_my_client_ids())
      )
    )
  )
  WITH CHECK (
    (
      sessions.client_id IS NOT NULL AND sessions.client_id IN (SELECT public.bamakor_my_client_ids())
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = sessions.project_id
          AND p.client_id IS NOT NULL
          AND p.client_id IN (SELECT public.bamakor_my_client_ids())
      )
    )
  );

DROP POLICY IF EXISTS authenticated_tenant_residents ON public.residents;
CREATE POLICY authenticated_tenant_residents ON public.residents
  FOR ALL
  TO authenticated
  USING (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_tenant_ticket_logs ON public.ticket_logs;
CREATE POLICY authenticated_tenant_ticket_logs ON public.ticket_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_logs.ticket_id
        AND t.client_id IS NOT NULL
        AND t.client_id IN (SELECT public.bamakor_my_client_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_logs.ticket_id
        AND t.client_id IS NOT NULL
        AND t.client_id IN (SELECT public.bamakor_my_client_ids())
    )
  );

DROP POLICY IF EXISTS authenticated_tenant_ticket_attachments ON public.ticket_attachments;
CREATE POLICY authenticated_tenant_ticket_attachments ON public.ticket_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
        AND t.client_id IS NOT NULL
        AND t.client_id IN (SELECT public.bamakor_my_client_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
        AND t.client_id IS NOT NULL
        AND t.client_id IN (SELECT public.bamakor_my_client_ids())
    )
  );

DROP POLICY IF EXISTS authenticated_tenant_pending_residents ON public.pending_resident_join_requests;
CREATE POLICY authenticated_tenant_pending_residents ON public.pending_resident_join_requests
  FOR ALL
  TO authenticated
  USING (client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_only ON public.whatsapp_templates;
DROP POLICY IF EXISTS authenticated_tenant_whatsapp_templates ON public.whatsapp_templates;
CREATE POLICY authenticated_tenant_whatsapp_templates ON public.whatsapp_templates
  FOR ALL
  TO authenticated
  USING (client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IN (SELECT public.bamakor_my_client_ids()));

-- error_logs.client_id מתווסף ב־027; שורות ישנות עם NULL לא ייחשפו מהדפדפן
DROP POLICY IF EXISTS authenticated_only ON public.error_logs;
DROP POLICY IF EXISTS authenticated_tenant_error_logs ON public.error_logs;
CREATE POLICY authenticated_tenant_error_logs ON public.error_logs
  FOR ALL
  TO authenticated
  USING (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IS NOT NULL AND client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_only ON public.ticket_internal_messages;
DROP POLICY IF EXISTS authenticated_tenant_ticket_internal_messages ON public.ticket_internal_messages;
CREATE POLICY authenticated_tenant_ticket_internal_messages ON public.ticket_internal_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_internal_messages.ticket_id
        AND t.client_id IS NOT NULL
        AND t.client_id IN (SELECT public.bamakor_my_client_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_internal_messages.ticket_id
        AND t.client_id IS NOT NULL
        AND t.client_id IN (SELECT public.bamakor_my_client_ids())
    )
  );

DROP POLICY IF EXISTS authenticated_only ON public.billing_events;
DROP POLICY IF EXISTS authenticated_tenant_billing_events ON public.billing_events;
CREATE POLICY authenticated_tenant_billing_events ON public.billing_events
  FOR ALL
  TO authenticated
  USING (client_id IN (SELECT public.bamakor_my_client_ids()))
  WITH CHECK (client_id IN (SELECT public.bamakor_my_client_ids()));

DROP POLICY IF EXISTS authenticated_only ON public.push_subscriptions;
DROP POLICY IF EXISTS authenticated_tenant_push_subscriptions ON public.push_subscriptions;
CREATE POLICY authenticated_tenant_push_subscriptions ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND client_id IN (SELECT public.bamakor_my_client_ids())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND client_id IN (SELECT public.bamakor_my_client_ids())
  );

-- IP rate limits לא אמורים להיחשף לדפדפן (רק RPC דרך service_role)
DROP POLICY IF EXISTS authenticated_only ON public.rate_limits;
