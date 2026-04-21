import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'
import { sendWorkerSMS } from '@/lib/sms-send'

export type ReporterClosedNotifyResult = {
  whatsappSent: boolean
  whatsappError?: string
  smsSent: boolean
  smsError?: string
}

/**
 * After a ticket is CLOSED: notify the reporter on WhatsApp (if configured) and SMS (019SMS).
 * Non-throwing — failures are returned in the result for logging.
 */
export async function notifyReporterTicketClosed(
  supabaseAdmin: SupabaseClient,
  clientId: string,
  opts: {
    reporterPhone: string | null | undefined
    ticketNumber: number
    projectName: string
  }
): Promise<ReporterClosedNotifyResult> {
  const reporterPhone = opts.reporterPhone?.trim()
  const result: ReporterClosedNotifyResult = { whatsappSent: false, smsSent: false }

  if (!reporterPhone) {
    return result
  }

  const building = opts.projectName?.trim() || 'הבניין'
  const waBody = `✅ שלום! התקלה שדיווחת בבניין ${building} טופלה וסגורה.\n\nאם יש בעיה נוספת, ניתן לפנות אלינו בכל עת 🙏`
  const smsBody = `במקור: פנייה #${opts.ticketNumber} ב${building} נסגרה. תודה שדיווחתם.`

  const { data: waClient } = await supabaseAdmin
    .from('clients')
    .select('whatsapp_phone_number_id, whatsapp_access_token, sms_sender_name, name')
    .eq('id', clientId)
    .maybeSingle()

  const residentWhatsAppCreds = {
    phoneNumberId: (waClient as { whatsapp_phone_number_id?: string | null } | null)?.whatsapp_phone_number_id || undefined,
    accessToken: (waClient as { whatsapp_access_token?: string | null } | null)?.whatsapp_access_token || undefined,
  }

  const smsSenderName =
    (waClient as { sms_sender_name?: string | null } | null)?.sms_sender_name ||
    (waClient as { name?: string | null } | null)?.name ||
    'במקור'

  try {
    await sendWhatsAppTextMessage(reporterPhone, waBody, residentWhatsAppCreds)
    result.whatsappSent = true
  } catch (e) {
    result.whatsappError = e instanceof Error ? e.message : String(e)
  }

  try {
    const ok = await sendWorkerSMS(reporterPhone, smsBody, smsSenderName)
    result.smsSent = ok
    if (!ok) {
      result.smsError = '019SMS returned false (missing credentials or invalid number)'
    }
  } catch (e) {
    result.smsError = e instanceof Error ? e.message : String(e)
  }

  return result
}
