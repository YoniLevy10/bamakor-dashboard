import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'
import { resolveWhatsAppTemplateMessage } from '@/lib/whatsapp-templates'

export type ReporterClosedNotifyResult = {
  whatsappSent: boolean
  whatsappError?: string
}

/**
 * After a ticket is CLOSED: notify the reporter on WhatsApp (if configured).
 * Non-throwing — failures are returned in the result for logging.
 */
export async function notifyReporterTicketClosed(
  supabaseAdmin: SupabaseClient,
  clientId: string,
  opts: {
    reporterPhone: string | null | undefined
    projectName: string
  }
): Promise<ReporterClosedNotifyResult> {
  const reporterPhone = opts.reporterPhone?.trim()
  const result: ReporterClosedNotifyResult = { whatsappSent: false }

  if (!reporterPhone) {
    return result
  }

  const building = opts.projectName?.trim() || 'הבניין'
  const waFallback =
    '✅ שלום! התקלה שדיווחת בבניין {{project_name}} טופלה וסגורה.\n\nאם יש בעיה נוספת, ניתן לפנות אלינו בכל עת 🙏'

  const { data: waClient } = await supabaseAdmin
    .from('clients')
    .select('whatsapp_phone_number_id, whatsapp_access_token')
    .eq('id', clientId)
    .maybeSingle()

  const residentWhatsAppCreds = {
    phoneNumberId: (waClient as { whatsapp_phone_number_id?: string | null } | null)?.whatsapp_phone_number_id || undefined,
    accessToken: (waClient as { whatsapp_access_token?: string | null } | null)?.whatsapp_access_token || undefined,
  }

  try {
    const waBody = await resolveWhatsAppTemplateMessage(
      supabaseAdmin,
      clientId,
      'ticket_closed',
      waFallback,
      { project_name: building }
    )
    const wa = await sendWhatsAppTextMessage(reporterPhone, waBody, residentWhatsAppCreds, { clientId })
    result.whatsappSent = !!wa
    if (!wa) result.whatsappError = 'WhatsApp send failed (logged)'
  } catch (e) {
    result.whatsappError = e instanceof Error ? e.message : String(e)
  }

  return result
}
