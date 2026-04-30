import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronRequest } from '@/lib/cron-auth'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'
import { resolveWhatsAppTemplateMessage } from '@/lib/whatsapp-templates'
import { getLogger } from '@/lib/logging'

function hoursOpen(createdAt: string): number {
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return 0
  return (Date.now() - t) / 3600000
}

export async function GET(req: NextRequest) {
  const logger = getLogger()
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdmin()
    const { data: tickets, error } = await admin
      .from('tickets')
      .select('id, ticket_number, created_at, project_id, client_id, sla_alerted, status')
      .neq('status', 'CLOSED')
      .eq('sla_alerted', false)

    if (error) {
      logger.error('CRON', 'sla-check tickets query failed', new Error(error.message))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let marked = 0
    let waSent = 0

    for (const row of tickets || []) {
      const pid = row.project_id as string | null
      if (!pid) continue

      const { data: project, error: pErr } = await admin
        .from('projects')
        .select('id, name, sla_hours, manager_phone')
        .eq('id', pid)
        .maybeSingle()

      if (pErr || !project) continue

      const slaH = typeof project.sla_hours === 'number' ? project.sla_hours : 24
      if (hoursOpen(row.created_at as string) < slaH) continue

      const { data: clientRow } = await admin
        .from('clients')
        .select('manager_phone, whatsapp_phone_number_id, whatsapp_access_token')
        .eq('id', row.client_id as string)
        .maybeSingle()

      const managerPhone =
        (project.manager_phone as string | null)?.trim() ||
        (clientRow as { manager_phone?: string | null } | null)?.manager_phone?.trim() ||
        ''

      const creds = {
        phoneNumberId: (clientRow as { whatsapp_phone_number_id?: string | null } | null)
          ?.whatsapp_phone_number_id || undefined,
        accessToken: (clientRow as { whatsapp_access_token?: string | null } | null)?.whatsapp_access_token || undefined,
      }

      const body = await resolveWhatsAppTemplateMessage(
        admin,
        row.client_id as string,
        'error_general',
        '⏰ התראת SLA\n' +
          'תקלה #{{ticket_number}} בפרויקט {{project_name}} פתוחה מעל {{description}} שעות.\n' +
          'נא לבדוק בלוח הבקרה.',
        {
          ticket_number: String(row.ticket_number),
          project_name: (project.name as string) || '',
          description: String(slaH),
        }
      )

      if (managerPhone && creds.phoneNumberId && creds.accessToken) {
        try {
          await sendWhatsAppTextMessage(managerPhone, body, creds, {
            clientId: row.client_id as string,
          })
          waSent++
        } catch (e) {
          logger.warn('CRON', 'sla-check WhatsApp failed', {
            ticketId: row.id,
            err: e instanceof Error ? e.message : String(e),
          })
        }
      }

      const { error: upErr } = await admin.from('tickets').update({ sla_alerted: true }).eq('id', row.id)
      if (!upErr) marked++
    }

    return NextResponse.json({ ok: true, marked, waSent })
  } catch (e) {
    logger.error('CRON', 'sla-check fatal', e instanceof Error ? e : new Error(String(e)))
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
