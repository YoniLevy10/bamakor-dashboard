import type { SupabaseClient } from '@supabase/supabase-js'

type ClientPlanRow = {
  plan_tier?: string | null
  buildings_allowed?: number | null
  max_workers?: number | null
  max_residents?: number | null
}

/** null / undefined = no cap (unlimited) */
export function effectiveMaxBuildings(row: ClientPlanRow): number | null {
  const n = row.buildings_allowed
  if (n === null || n === undefined) return null
  return n >= 0 ? n : null
}

/** null = unlimited */
export function effectiveMaxWorkers(row: ClientPlanRow): number | null {
  const n = row.max_workers
  if (n === null || n === undefined) return null
  return n >= 0 ? n : null
}

/** null = unlimited */
export function effectiveMaxResidents(row: ClientPlanRow): number | null {
  const n = row.max_residents
  if (n === null || n === undefined) return null
  return n >= 0 ? n : null
}

export async function getClientPlanRow(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ data: ClientPlanRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('clients')
    .select('plan_tier, buildings_allowed, max_workers, max_residents')
    .eq('id', clientId)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data as ClientPlanRow) || null, error: null }
}
