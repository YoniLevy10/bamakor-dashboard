import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return false
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@bamakor.app'
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

/**
 * Notify subscribed dashboard users when a new ticket is opened via POST /api/create-ticket.
 */
export async function notifyNewTicketPush(
  admin: SupabaseClient,
  clientId: string,
  description: string | null
): Promise<void> {
  if (!initWebPush()) return

  const title = 'טיקט חדש נפתח'
  const body = (description || '').trim().slice(0, 50) || 'תקלה חדשה'

  const { data: rows, error } = await admin
    .from('push_subscriptions')
    .select('subscription')
    .eq('client_id', clientId)

  if (error || !rows?.length) return

  const payload = JSON.stringify({ title, body, url: '/tickets' })

  await Promise.allSettled(
    rows.map(async (row: { subscription: unknown }) => {
      const sub = row.subscription
      if (!sub || typeof sub !== 'object') return
      try {
        await webpush.sendNotification(sub as webpush.PushSubscription, payload, { TTL: 3600 })
      } catch {
        /* ignore per-device failures */
      }
    })
  )
}
