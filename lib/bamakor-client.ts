import { supabase } from '@/lib/supabase'

/**
 * מזהה `clients.id` לדפדפן לפי המשתמש המחובר:
 * organization_users → organizations.client_id
 *
 * Fallback לפיתוח: NEXT_PUBLIC_BAMAKOR_CLIENT_ID רק כש־NODE_ENV=development
 * ורק אם אין שיוך ארגון (אחרי ניסיון getUser + שרשרת org).
 */
export async function resolveBamakorClientIdForBrowser(): Promise<string> {
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !authData.user) {
    throw new Error('נדרשת התחברות')
  }
  const userId = authData.user.id

  const { data: ou, error: ouErr } = await supabase
    .from('organization_users')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ouErr) {
    throw ouErr
  }

  if (!ou?.organization_id) {
    if (typeof window !== 'undefined') {
      window.location.replace('/onboarding')
    }
    throw new Error('אין ארגון משויך — הועבר לאונבורדינג')
  }

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('client_id')
    .eq('id', ou.organization_id)
    .maybeSingle()

  if (orgErr) {
    throw orgErr
  }

  const cid = (org as { client_id?: string | null } | null)?.client_id
  if (cid && String(cid).trim().length > 0) {
    return String(cid)
  }

  const explicit = (process.env.NEXT_PUBLIC_BAMAKOR_CLIENT_ID || '').trim()
  if (process.env.NODE_ENV === 'development' && explicit) {
    return explicit
  }

  if (typeof window !== 'undefined') {
    window.location.replace('/onboarding')
  }
  throw new Error('לא נמצא client_id לארגון')
}
