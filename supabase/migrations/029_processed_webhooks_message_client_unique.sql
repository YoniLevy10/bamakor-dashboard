-- דדופ טננטית: אותה הודעה יכולה להירשם לכל לקוח בנפרד; מונעת כפילויות בתוך tenant.

BEGIN;

ALTER TABLE public.processed_webhooks
  DROP CONSTRAINT IF EXISTS processed_webhooks_message_id_key;

ALTER TABLE public.processed_webhooks
  DROP CONSTRAINT IF EXISTS processed_webhooks_message_client_unique;

ALTER TABLE public.processed_webhooks
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE;

-- ללא tenant בשורות ישנות; מרוקנים לפני NOT NULL והייחוד המורכב
TRUNCATE TABLE public.processed_webhooks;

ALTER TABLE public.processed_webhooks
  ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE public.processed_webhooks
  ADD CONSTRAINT processed_webhooks_message_client_unique UNIQUE (message_id, client_id);

COMMIT;
