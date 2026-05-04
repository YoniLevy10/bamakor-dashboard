-- Migration 035: four plan tiers (starter / pro / business / enterprise)
--
-- Pricing (May 2026):
--   starter    ₪299/month  — 3 buildings,  5 workers,  300 tickets/month
--   pro        ₪499/month  — 10 buildings, 20 workers, 1,000 tickets/month
--   business   ₪699/month  — 30 buildings, 60 workers, 5,000 tickets/month
--   enterprise ₪899+/month — unlimited
--
-- Changes:
--   1. Add max_tickets_per_month column (per-client override, null = plan default)
--   2. Rename old 'basic' tier → 'starter'
--   3. Add CHECK constraint for valid tier values

-- 1. New column
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS max_tickets_per_month INTEGER;

COMMENT ON COLUMN public.clients.max_tickets_per_month
  IS 'Per-client ticket quota override; NULL = use plan default from app code';

-- 2. Migrate any value that is NOT already a valid tier → 'starter'
--    (covers 'basic', NULL, and any other legacy/test values)
UPDATE public.clients
SET plan_tier = 'starter'
WHERE plan_tier IS NULL
   OR plan_tier NOT IN ('starter', 'pro', 'business', 'enterprise');

-- 3. Ensure default is 'starter' going forward
ALTER TABLE public.clients
  ALTER COLUMN plan_tier SET DEFAULT 'starter';

-- 4. Add CHECK constraint (drop first if already exists to allow re-run)
DO $$
BEGIN
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_plan_tier_check
    CHECK (plan_tier IN ('starter', 'pro', 'business', 'enterprise'));
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already exists, no-op
  WHEN check_violation  THEN
    RAISE EXCEPTION 'clients table contains plan_tier values outside the allowed set. Fix data first.';
END $$;
