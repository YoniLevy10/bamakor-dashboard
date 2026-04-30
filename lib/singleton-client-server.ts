import type { SupabaseClient } from '@supabase/supabase-js'
import { requireClientIdForUser } from '@/lib/tenant-resolution'

/**
 * מחזיר את `clients.id` של המשתמש המחובר (דרך organization → client).
 * `userId` חובה — מזהה מ־`getUser()` ב-route.
 *
 * Fallback: ב-development בלבד — `BAMAKOR_CLIENT_ID` אם אין שיוך ארגון (ראו `requireClientIdForUser`).
 */
export async function getSingletonClientId(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  return requireClientIdForUser(admin, userId)
}
