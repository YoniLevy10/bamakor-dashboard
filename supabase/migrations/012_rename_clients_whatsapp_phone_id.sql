-- Option A: legacy production DBs used `whatsapp_phone_id`; the app expects `whatsapp_phone_number_id`
-- (see supabase/migrations/002_clients_settings.sql). Idempotent: no-op if already aligned.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'whatsapp_phone_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'whatsapp_phone_number_id'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN whatsapp_phone_id TO whatsapp_phone_number_id;
  END IF;
END
$$;
