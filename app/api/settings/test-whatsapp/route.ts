import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendWhatsAppTextMessageWithCredentials } from '@/lib/whatsapp-send'
import { requireSessionClientId } from '@/lib/api-auth'
import { checkRateLimitDistributed } from '@/lib/api-validation'
import { getLogger, getAuditLogger } from '@/lib/logging'

/**
 * Sends a test WhatsApp using credentials stored on `clients` (not .env).
 */
export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `test-whatsapp-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const clientId = auth.ctx.clientId

    const admin = getSupabaseAdmin()

    // Rate limit to avoid abuse (sending messages)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin: admin,
      key: `ip:${ip}:settings:test-whatsapp`,
      windowMs: 60_000,
      maxRequests: 5,
    })
    if (rl.isLimited) {
      audit.logFailedOperation('SEND', 'WHATSAPP_TEST', 'n/a', 'single-tenant', 'rate_limited')
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const { data: client, error } = await admin
      .from('clients')
      .select('name, whatsapp_phone_number_id, whatsapp_access_token, manager_phone')
      .eq('id', clientId)
      .single()

    if (error || !client) {
      audit.logFailedOperation('READ', 'CLIENT', clientId, 'single-tenant', 'client_not_found')
      return NextResponse.json({ error: 'לקוח לא נמצא', requestId }, { status: 404 })
    }

    const phoneNumberId = client.whatsapp_phone_number_id as string | null
    const accessToken = client.whatsapp_access_token as string | null
    const to = (client.manager_phone as string | null)?.trim()

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'נדרשים מזהה מספר וואטסאפ וטוקן בהגדרות', requestId },
        { status: 400 }
      )
    }

    if (!to) {
      return NextResponse.json(
        { error: 'נדרש מספר מנהל בהגדרות (התראות) לשליחת בדיקה', requestId },
        { status: 400 }
      )
    }

    const digits = to.replace(/\D/g, '')
    const waTo =
      digits.startsWith('972') ? digits : digits.startsWith('0') ? `972${digits.slice(1)}` : digits

    await sendWhatsAppTextMessageWithCredentials(
      phoneNumberId,
      accessToken,
      waTo,
      `✅ בדיקת חיבור מהמערכת — ${(client as { name?: string | null }).name || 'המערכת'}`
    )

    audit.logAction('SEND', 'WHATSAPP_TEST', 'n/a', 'single-tenant', 'dashboard', undefined, 'SUCCESS')
    logger.info('SETTINGS', 'Test WhatsApp sent', { requestId, clientId })
    return NextResponse.json({ success: true, requestId })
  } catch (e) {
    logger.error('SETTINGS', 'Test WhatsApp failed', e instanceof Error ? e : new Error(String(e)), { requestId })
    audit.logFailedOperation('SEND', 'WHATSAPP_TEST', 'n/a', 'single-tenant', 'exception', 'dashboard')
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
