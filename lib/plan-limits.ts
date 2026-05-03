import type { SupabaseClient } from '@supabase/supabase-js'

/** Placeholder quotas for future billing enforcement. */
export const PLAN_LIMITS = {
  basic: { buildings: 3, workers: 5, tickets_per_month: 200 },
  pro: { buildings: 15, workers: 20, tickets_per_month: 2000 },
  enterprise: { buildings: Infinity, workers: Infinity, tickets_per_month: Infinity },
} as const

export type PlanTier = keyof typeof PLAN_LIMITS

export type ClientPlanRow = {
  id: string
  plan_tier?: string | null
  buildings_allowed?: number | null
  max_workers?: number | null
}

function normalizeTier(tier: string | null | undefined): PlanTier {
  if (tier === 'pro' || tier === 'enterprise') return tier
  return 'basic'
}

/** Single row for quota checks (create-project / create-worker / onboarding). */
export async function getClientPlanRow(supabase: SupabaseClient, clientId: string) {
  return supabase
    .from('clients')
    .select('id, plan_tier, buildings_allowed, max_workers')
    .eq('id', clientId)
    .maybeSingle()
}

/**
 * Max active buildings (projects). `null` = no hard cap in API logic.
 * DB `buildings_allowed` overrides plan defaults when set.
 */
export function effectiveMaxBuildings(client: ClientPlanRow | null): number | null {
  if (!client) return null
  const fromDb = client.buildings_allowed
  if (typeof fromDb === 'number' && Number.isFinite(fromDb) && fromDb > 0) {
    return fromDb
  }
  const lim = PLAN_LIMITS[normalizeTier(client.plan_tier)].buildings
  return lim === Infinity ? null : lim
}

/** Max active workers. `null` = no hard cap in API logic. DB `max_workers` overrides plan when set. */
export function effectiveMaxWorkers(client: ClientPlanRow | null): number | null {
  if (!client) return null
  const fromDb = client.max_workers
  if (typeof fromDb === 'number' && Number.isFinite(fromDb) && fromDb > 0) {
    return fromDb
  }
  const lim = PLAN_LIMITS[normalizeTier(client.plan_tier)].workers
  return lim === Infinity ? null : lim
}
