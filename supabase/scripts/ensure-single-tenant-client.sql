-- =============================================================================
-- Bamakor single-tenant: ensure one `clients` row and backfill `client_id`
-- Run in Supabase → SQL Editor (review before execute).
--
-- Preconditions:
--   - Table `clients` already exists. Repo migrations: supabase/migrations/
--   - If INSERT fails on NOT NULL columns, adjust the INSERT list.
--
-- Note on sessions / pending_selections:
--   If migration 004 was never applied, those tables have no `client_id`.
--   Static SQL like `UPDATE sessions s ... WHERE s.client_id IS NULL` still
--   fails at parse time. Those sections use plpgsql + EXECUTE only when the
--   column exists.
-- =============================================================================

-- 1) Exactly one tenant row (skip if any row already exists)
INSERT INTO clients (id, name, created_at)
SELECT
  gen_random_uuid(),
  'במקור',
  now()
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      clients
    LIMIT
      1
  );

-- 2) Backfill NULL client_id (same tenant = oldest clients row)
WITH
  tenant AS (
    SELECT
      id
    FROM
      clients
    ORDER BY
      created_at ASC
    LIMIT
      1
  )
UPDATE projects p
SET
  client_id = tenant.id
FROM
  tenant
WHERE
  p.client_id IS NULL;

WITH
  tenant AS (
    SELECT
      id
    FROM
      clients
    ORDER BY
      created_at ASC
    LIMIT
      1
  )
UPDATE workers w
SET
  client_id = tenant.id
FROM
  tenant
WHERE
  w.client_id IS NULL;

WITH
  tenant AS (
    SELECT
      id
    FROM
      clients
    ORDER BY
      created_at ASC
    LIMIT
      1
  )
UPDATE tickets t
SET
  client_id = tenant.id
FROM
  tenant
WHERE
  t.client_id IS NULL;

-- residents + sessions + pending_selections: dynamic UPDATE so missing columns do not error at parse time
DO $$
DECLARE
  tenant_id uuid;
BEGIN
  SELECT
    id INTO tenant_id
  FROM
    clients
  ORDER BY
    created_at ASC
  LIMIT
    1;

  IF tenant_id IS NULL THEN
    RAISE NOTICE 'No row in clients; skip optional backfills';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'residents'
      AND column_name = 'client_id'
  ) THEN
    EXECUTE format(
      'UPDATE residents SET client_id = %L WHERE client_id IS NULL',
      tenant_id
    );
  ELSE
    RAISE NOTICE 'residents.client_id missing — run supabase/migrations/003_residents_table.sql';
  END IF;

  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'client_id'
  ) THEN
    EXECUTE format(
      'UPDATE sessions SET client_id = %L WHERE client_id IS NULL',
      tenant_id
    );
  ELSE
    RAISE NOTICE 'sessions.client_id missing — run supabase/migrations/004_webhook_client_scope.sql if needed';
  END IF;

  IF EXISTS (
    SELECT
      1
    FROM
      information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'pending_selections'
      AND column_name = 'client_id'
  ) THEN
    EXECUTE format(
      'UPDATE pending_selections SET client_id = %L WHERE client_id IS NULL',
      tenant_id
    );
  ELSE
    RAISE NOTICE 'pending_selections.client_id missing — optional migration 004';
  END IF;
END
$$;

-- 3) Sanity (uncomment to run)
-- SELECT COUNT(*) AS clients_count FROM clients;
