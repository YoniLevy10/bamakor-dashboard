import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

let memoryCache: string | null = null

/**
 * Single-tenant: exactly one logical customer (one row in `clients`).
 * Optional `BAMAKOR_CLIENT_ID` overrides DB lookup (ops / staging).
 */
export async function getSingletonClientId(admin?: SupabaseClient): Promise<string> {
  const fromEnv = (process.env.BAMAKOR_CLIENT_ID || '').trim()
  if (fromEnv) return fromEnv

  if (memoryCache) return memoryCache

  const supabase = admin ?? getSupabaseAdmin()
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    throw new Error(`getSingletonClientId: ${error.message}`)
  }
  const id = (data as { id?: string }[] | null)?.[0]?.id
  if (!id) {
    throw new Error('getSingletonClientId: no row in clients')
  }
  memoryCache = id
  return id
}
