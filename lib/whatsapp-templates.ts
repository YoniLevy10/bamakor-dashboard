import type { SupabaseClient } from '@supabase/supabase-js'
import type { WhatsAppTemplateKey } from '@/lib/whatsapp-template-keys'

const VAR_NAMES = ['project_name', 'ticket_number', 'description', 'reporter_name', 'building_line'] as const

/** החלפת משתני {{...}} בטקסט הודעת וואטסאפ */
export function interpolateWhatsAppTemplate(
  text: string,
  vars: Partial<Record<(typeof VAR_NAMES)[number], string>> = {}
): string {
  let out = text
  for (const name of VAR_NAMES) {
    const val = vars[name] ?? ''
    out = out.split(`{{${name}}}`).join(val)
  }
  return out
}

/**
 * טוען תבנית מ-whatsapp_templates לפי client_id + template_key.
 * אם אין שורה ב-DB — משתמש ב-fallbackText (הטקסט הקשיח מהקוד).
 */
export async function resolveWhatsAppTemplateMessage(
  admin: SupabaseClient,
  clientId: string,
  templateKey: WhatsAppTemplateKey,
  fallbackText: string,
  vars: Partial<Record<(typeof VAR_NAMES)[number], string>> = {}
): Promise<string> {
  const { data, error } = await admin
    .from('whatsapp_templates')
    .select('template_text')
    .eq('client_id', clientId)
    .eq('template_key', templateKey)
    .maybeSingle()

  if (error) {
    console.warn('[whatsapp_templates]', error.message)
  }

  const fromDb = (data as { template_text?: string } | null)?.template_text
  const raw =
    fromDb != null && String(fromDb).trim().length > 0 ? String(fromDb) : fallbackText

  return interpolateWhatsAppTemplate(raw, vars)
}
