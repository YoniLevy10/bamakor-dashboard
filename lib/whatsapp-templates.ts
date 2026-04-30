import type { SupabaseClient } from '@supabase/supabase-js'
import type { WhatsAppTemplateKey } from '@/lib/whatsapp-template-keys'

const VAR_NAMES = ['project_name', 'ticket_number', 'description', 'reporter_name', 'building_line'] as const

const TEMPLATE_CACHE_TTL_MS = 60_000
const templateTextCache = new Map<string, { text: string; expiresAt: number }>()

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

async function loadTemplateTextFromDb(
  admin: SupabaseClient,
  clientId: string,
  templateKey: WhatsAppTemplateKey
): Promise<string | null> {
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
  if (fromDb != null && String(fromDb).trim().length > 0) {
    return String(fromDb)
  }
  return null
}

/**
 * טוען תבנית מ-whatsapp_templates לפי client_id + template_key.
 * אם אין שורה ב-DB — משתמש ב-fallbackText (הטקסט הקשיח מהקוד).
 * Cache בזיכרון ל־60 שניות לשורות שנמצאו ב־DB (מפחית round-trips בשליחות webhook).
 */
export async function resolveWhatsAppTemplateMessage(
  admin: SupabaseClient,
  clientId: string,
  templateKey: WhatsAppTemplateKey,
  fallbackText: string,
  vars: Partial<Record<(typeof VAR_NAMES)[number], string>> = {}
): Promise<string> {
  const cacheKey = `${clientId}:${templateKey}`
  const now = Date.now()
  const hit = templateTextCache.get(cacheKey)
  if (hit && hit.expiresAt > now) {
    return interpolateWhatsAppTemplate(hit.text, vars)
  }

  const fromDb = await loadTemplateTextFromDb(admin, clientId, templateKey)
  const raw = fromDb ?? fallbackText

  if (fromDb) {
    templateTextCache.set(cacheKey, { text: fromDb, expiresAt: now + TEMPLATE_CACHE_TTL_MS })
    setTimeout(() => {
      const cur = templateTextCache.get(cacheKey)
      if (cur && cur.expiresAt <= Date.now()) {
        templateTextCache.delete(cacheKey)
      }
    }, TEMPLATE_CACHE_TTL_MS + 50)
  }

  return interpolateWhatsAppTemplate(raw, vars)
}

/**
 * Smoke test helper: resolves the 5 core templates and prints to console.
 * Use from any server context (e.g. a one-off API route in dev).
 */
export async function smokeTestWhatsAppTemplates(
  admin: SupabaseClient,
  clientId: string
): Promise<void> {
  const fallbacks: Record<WhatsAppTemplateKey, string> = {
    welcome:
      'שלום! ברוכים הבאים למערכת התקלות של {{project_name}}. כדי לפתוח תקלה חדשה, שלחו את תיאור הבעיה.',
    ticket_opened:
      'תקלה {{ticket_number}} נפתחה בהצלחה בפרויקט {{project_name}}. תיאור: {{description}}. נחזור אליכם בהקדם.',
    worker_assigned: 'תקלה {{ticket_number}} הוקצתה לטיפול. אנו על זה — נעדכן אתכם בקרוב.',
    ticket_closed: 'תקלה {{ticket_number}} נסגרה. תודה שפניתם! במקור — ניהול תקלות חכם.',
    error_general: 'אירעה שגיאה במערכת. אנא נסו שוב או פנו למנהל.',
  }

  const vars = {
    project_name: 'מגדלי הים התיכון',
    ticket_number: '128',
    description: 'נזילה מהצנרת בחדר האמבטיה',
    reporter_name: 'ישראל ישראלי',
    building_line: '\nבניין: ב׳',
  }

  console.log('[whatsapp_templates][smoke] clientId', clientId)
  for (const key of Object.keys(fallbacks) as WhatsAppTemplateKey[]) {
    // eslint-disable-next-line no-await-in-loop
    const msg = await resolveWhatsAppTemplateMessage(admin, clientId, key, fallbacks[key], vars)
    console.log(`\n[whatsapp_templates][smoke] ${key}\n${msg}`)
  }
}
