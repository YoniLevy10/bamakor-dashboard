import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  effective019SmsSource,
  normalizePhone019,
  post019SmsOnce,
  SMS_019_SENDER,
  SMS_019_SOURCE_MAX,
} from '@/lib/sms-019-core'

const RETRIES = 3
const BETWEEN_MS = 2000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export type Send019SmsRetryContext = {
  clientId?: string | null
  channel: string
}

/** Exported for tests / advanced callers — one 10s attempt. */
export async function try019SmsOnce(
  normalizedPhone: string,
  message: string,
  senderPreferred: string | null | undefined
): Promise<{ ok: boolean; error: string }> {
  const source = effective019SmsSource(senderPreferred ?? SMS_019_SENDER)
  const r = await post019SmsOnce(normalizedPhone, message, source)
  return { ok: r.ok, error: r.error || (r.ok ? '' : 'unknown') }
}

/**
 * 019SMS: up to 3 attempts, 2s backoff, 10s timeout per attempt.
 * Logs to failed_notifications after final failure when DB is configured.
 */
export async function send019SmsWithRetries(
  normalizedPhone: string,
  message: string,
  senderPreferred: string | null | undefined,
  ctx: Send019SmsRetryContext
): Promise<boolean> {
  const source = effective019SmsSource(senderPreferred ?? SMS_019_SENDER)
  const strippedPreferred = String(senderPreferred ?? '')
    .trim()
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, SMS_019_SOURCE_MAX)
  if (String(senderPreferred ?? '').trim() && strippedPreferred !== source) {
    console.log('📱 SMS_SOURCE_COERCED: 019SMS source must be Latin letters/digits (3–11); using effective value', {
      requested: senderPreferred,
      effective: source,
    })
  }

  let lastErr = 'unknown'

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const result = await post019SmsOnce(normalizedPhone, message, source)
    if (result.ok) {
      if (result.shipmentId) {
        console.log('✅ SMS_019_SENT', { channel: ctx.channel, shipmentId: result.shipmentId })
      }
      return true
    }
    lastErr = result.error
    console.error(`❌ SMS_019_ATTEMPT_${attempt}_${RETRIES}_FAILED`, {
      channel: ctx.channel,
      destination: normalizedPhone,
      detail: lastErr,
    })
    if (attempt < RETRIES) await sleep(BETWEEN_MS)
  }

  console.error('❌ SMS_019_FINAL_FAILURE after retries', {
    channel: ctx.channel,
    destination: normalizedPhone,
    lastErr,
  })

  try {
    const admin = getSupabaseAdmin()
    await admin.from('failed_notifications').insert({
      client_id: ctx.clientId ?? null,
      channel: ctx.channel,
      destination: normalizedPhone,
      payload: message.length > 2000 ? `${message.slice(0, 2000)}…` : message,
      error_message: lastErr.length > 2000 ? `${lastErr.slice(0, 2000)}…` : lastErr,
    })
  } catch (e) {
    console.error('⚠️ failed_notifications insert skipped or failed:', e instanceof Error ? e.message : String(e))
  }

  return false
}

export async function send019StaffSms(
  phoneNumber: string,
  message: string,
  senderPreferred: string | null | undefined,
  ctx: Send019SmsRetryContext
): Promise<boolean> {
  if (!phoneNumber) {
    console.error('❌ SMS_SEND_FAILURE: phoneNumber is missing')
    return false
  }
  if (!message) {
    console.error('❌ SMS_SEND_FAILURE: message is empty')
    return false
  }

  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction && !get019SmsEnvPresent()) {
    console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode (missing credentials)')
    console.log('📱 SMS_RECIPIENT:', phoneNumber)
    console.log('📱 SMS_MESSAGE_LENGTH:', message.length)
    return true
  }

  if (!get019SmsEnvPresent()) {
    console.error('❌ SMS_SEND_FAILURE: 019SMS token/username not configured')
    return false
  }

  const normalizedPhone = normalizePhone019(phoneNumber)
  if (!normalizedPhone) {
    console.error('❌ SMS_SEND_FAILURE: phoneNumber could not be normalized to 019SMS format', {
      originalPhone: phoneNumber,
    })
    return false
  }

  console.log('📱 SMS_SEND_START', {
    channel: ctx.channel,
    normalizedPhone,
    messageLength: message.length,
  })

  return send019SmsWithRetries(normalizedPhone, message, senderPreferred ?? SMS_019_SENDER, ctx)
}

function get019SmsEnvPresent(): boolean {
  return !!(process.env.SMS_019_API_TOKEN && process.env.SMS_019_USERNAME)
}
