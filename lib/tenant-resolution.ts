import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * מזהה לקוח (clients.id) לפי משתמש מחובר:
 * auth.users → organization_users → organizations.client_id
 */
export async function resolveClientIdForUserId(
  admin: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: ou, error: ouErr } = await admin
    .from('organization_users')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ouErr || !ou?.organization_id) return null

  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .select('client_id')
    .eq('id', ou.organization_id)
    .maybeSingle()

  if (orgErr || !org) return null
  const cid = (org as { client_id?: string | null }).client_id
  return cid && String(cid).length > 0 ? String(cid) : null
}

/**
 * כמו resolveClientIdForUserId; אם אין — זורק (לשימוש ב-API עם משתמש מחובר).
 * BAMAKOR_CLIENT_ID — רק fallback ל-localhost / בדיקות.
 */
export async function requireClientIdForUser(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const cid = await resolveClientIdForUserId(admin, userId)
  if (cid) return cid

  const envOnly = (process.env.BAMAKOR_CLIENT_ID || '').trim()
  if (process.env.NODE_ENV === 'development' && envOnly) {
    return envOnly
  }

  throw new Error('NO_CLIENT_FOR_USER')
}

/**
 * Webhook וואטסאפ: לקוח לפי Meta phone_number_id (ייחודי לרוב לכל WABA).
 */
export async function resolveClientIdByWhatsAppPhoneNumberId(
  admin: SupabaseClient,
  phoneNumberId: string
): Promise<{ clientId: string; row: Record<string, unknown> } | null> {
  const { data: rows, error } = await admin
    .from('clients')
    .select('id, name, sms_sender_name, whatsapp_phone_number_id, whatsapp_access_token, manager_phone')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .limit(2)

  if (error || !rows?.length) {
    const fallback = (process.env.BAMAKOR_CLIENT_ID || '').trim()
    if (process.env.NODE_ENV === 'development' && fallback) {
      const { data: one } = await admin
        .from('clients')
        .select('id, name, sms_sender_name, whatsapp_phone_number_id, whatsapp_access_token, manager_phone')
        .eq('id', fallback)
        .maybeSingle()
      if (one) return { clientId: fallback, row: one as Record<string, unknown> }
    }
    return null
  }

  if (rows.length > 1) {
    console.warn('[tenant-resolution] multiple clients for whatsapp_phone_number_id', {
      phoneNumberId,
      count: rows.length,
    })
  }

  const row = rows[0] as Record<string, unknown>
  const id = row.id as string
  return { clientId: id, row }
}
