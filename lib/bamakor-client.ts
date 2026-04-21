import { supabase } from '@/lib/supabase'

/**
 * Single-tenant: resolve the one `clients.id` for browser-side Supabase queries.
 *
 * Priority:
 * 1) NEXT_PUBLIC_BAMAKOR_CLIENT_ID (optional override; mirrors BAMAKOR_CLIENT_ID on server)
 * 2) First row in `clients` (ordered by created_at)
 */
export async function resolveBamakorClientIdForBrowser(): Promise<string> {
  // Explicit override (optional)
  const explicit = (process.env.NEXT_PUBLIC_BAMAKOR_CLIENT_ID || '').trim()
  if (explicit) return explicit

  const { data: rows, error } = await supabase
    .from('clients')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) throw error
  const firstId = (rows as Array<{ id?: string }> | null)?.[0]?.id
  if (!firstId) throw new Error('לא נמצא רשומת לקוח')
  return firstId
}
