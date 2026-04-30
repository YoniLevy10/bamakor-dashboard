-- Distributed API rate limiting (server-side).
-- Provides an atomic, tenant/key scoped limiter for Next.js API routes.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0
);

-- Index for cleanup / visibility (optional)
CREATE INDEX IF NOT EXISTS api_rate_limits_window_start_idx ON public.api_rate_limits (window_start);

-- Atomic rate limit check + increment.
-- Returns: is_limited boolean, remaining integer, reset_at timestamptz
CREATE OR REPLACE FUNCTION public.bamakor_rate_limit(
  p_key text,
  p_window_ms integer,
  p_max integer
)
RETURNS TABLE (is_limited boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts timestamptz := now();
  window_interval interval := make_interval(secs => p_window_ms / 1000.0);
  row_rec record;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    -- Defensive: empty keys are always limited
    RETURN QUERY SELECT true, 0, now_ts + window_interval;
    RETURN;
  END IF;

  LOOP
    -- Try to update existing window row (only if still inside window)
    UPDATE public.api_rate_limits
      SET count = count + 1
      WHERE key = p_key
        AND window_start + window_interval > now_ts
      RETURNING window_start, count INTO row_rec;

    IF FOUND THEN
      RETURN QUERY
        SELECT (row_rec.count > p_max) AS is_limited,
               GREATEST(p_max - row_rec.count, 0) AS remaining,
               row_rec.window_start + window_interval AS reset_at;
      RETURN;
    END IF;

    -- No active window: try to insert new row (race-safe)
    BEGIN
      INSERT INTO public.api_rate_limits(key, window_start, count)
        VALUES (p_key, now_ts, 1);

      RETURN QUERY SELECT false, GREATEST(p_max - 1, 0), now_ts + window_interval;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Someone inserted concurrently; loop and retry update path
    END;
  END LOOP;
END;
$$;

-- RLS: restrict table access; server uses service_role key.
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "service_role_bypass" ON public.api_rate_limits
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

