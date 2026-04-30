-- Worker field link token, public IP rate limits, billing events, push subscriptions

-- 1) Worker access token (deep link for /worker without Google login)
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS access_token uuid DEFAULT gen_random_uuid();

UPDATE public.workers SET access_token = gen_random_uuid() WHERE access_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_workers_access_token ON public.workers (access_token);

-- 2) Rate limits (IP + endpoint), cleaned on each RPC call
CREATE TABLE IF NOT EXISTS public.rate_limits (
  ip text NOT NULL,
  endpoint text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, endpoint)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.rate_limits
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_only" ON public.rate_limits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.bamakor_rate_limit_ip_endpoint(
  p_ip text,
  p_endpoint text,
  p_max integer DEFAULT 20
)
RETURNS TABLE (is_limited boolean, current_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ip_key text := coalesce(nullif(trim(p_ip), ''), 'unknown');
  ep_key text := coalesce(nullif(trim(p_endpoint), ''), 'unknown');
  v_count integer;
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 minute';

  INSERT INTO public.rate_limits (ip, endpoint, count, window_start)
  VALUES (ip_key, ep_key, 1, now())
  ON CONFLICT (ip, endpoint) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < now() - interval '1 minute' THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < now() - interval '1 minute' THEN now()
      ELSE rate_limits.window_start
    END
  RETURNING rate_limits.count INTO v_count;

  RETURN QUERY SELECT (v_count > p_max), v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bamakor_rate_limit_ip_endpoint(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bamakor_rate_limit_ip_endpoint(text, text, integer) TO service_role;

-- 3) Billing usage events (dashboard / future plans)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_client_created
  ON public.billing_events (client_id, created_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.billing_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_only" ON public.billing_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Web Push subscriptions (PWA)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client ON public.push_subscriptions (client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_client_unique
  ON public.push_subscriptions (user_id, client_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.push_subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "authenticated_only" ON public.push_subscriptions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.workers.access_token IS 'Secret token for /worker?token= field worker access (no Google session).';
COMMENT ON TABLE public.rate_limits IS 'IP+endpoint sliding window; used by bamakor_rate_limit_ip_endpoint from API (service role).';
COMMENT ON TABLE public.billing_events IS 'Metering: ticket_created, resident_added, worker_added.';
COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscription JSON per user+client; server sends via web-push.';

-- 5) Billing: auto-record usage (covers API + dashboard Supabase inserts)
CREATE OR REPLACE FUNCTION public.billing_on_ticket_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.billing_events (client_id, event_type) VALUES (NEW.client_id, 'ticket_created');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_ticket_insert ON public.tickets;
CREATE TRIGGER trg_billing_ticket_insert
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE PROCEDURE public.billing_on_ticket_insert();

CREATE OR REPLACE FUNCTION public.billing_on_resident_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.billing_events (client_id, event_type) VALUES (NEW.client_id, 'resident_added');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_resident_insert ON public.residents;
CREATE TRIGGER trg_billing_resident_insert
  AFTER INSERT ON public.residents
  FOR EACH ROW
  EXECUTE PROCEDURE public.billing_on_resident_insert();

CREATE OR REPLACE FUNCTION public.billing_on_worker_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.billing_events (client_id, event_type) VALUES (NEW.client_id, 'worker_added');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_worker_insert ON public.workers;
CREATE TRIGGER trg_billing_worker_insert
  AFTER INSERT ON public.workers
  FOR EACH ROW
  EXECUTE PROCEDURE public.billing_on_worker_insert();
