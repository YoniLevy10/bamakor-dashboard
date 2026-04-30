import { getSupabaseAdmin } from '@/lib/supabase-admin'

/** Persist a failed WhatsApp send for cron retry (context whatsapp_send). */
export async function insertWhatsAppSendFailure(
  clientId: string,
  to: string,
  body: string,
  errorMessage: string
): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('error_logs').insert({
      context: 'whatsapp_send',
      message: errorMessage.slice(0, 8000),
      details: {
        client_id: clientId,
        to: to.slice(0, 64),
        body: body.slice(0, 4000),
      },
      resolved: false,
      whatsapp_attempts: 1,
    })
    if (error) {
      console.error('insertWhatsAppSendFailure:', error.message)
    }
  } catch (e) {
    console.error('insertWhatsAppSendFailure', e)
  }
}
