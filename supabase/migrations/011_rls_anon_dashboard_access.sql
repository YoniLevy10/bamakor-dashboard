-- Allow the Supabase JS client (anon JWT) to read/write tenant tables from the Bamakor dashboard.
-- Migration 008 enabled RLS with policies only for service_role; the app uses createClient(url, anon_key)
-- in lib/supabase.ts, so without anon policies all in-browser .from(...) calls fail.
--
-- SECURITY NOTE: The anon key is public in the browser bundle. These policies restore the same exposure
-- as before RLS was enabled. For production hardening, move data access to authenticated sessions +
-- tenant-scoped RLS (e.g. client_id) or API routes only.

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_projects" ON projects
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_tickets" ON tickets
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_workers" ON workers
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_sessions" ON sessions
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_residents" ON residents
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_ticket_logs" ON ticket_logs
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "anon_dashboard_ticket_attachments" ON ticket_attachments
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
