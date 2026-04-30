import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getLogger } from '@/lib/logging'
import { requireSessionClientId } from '@/lib/api-auth'
import { sanitizeId } from '@/lib/api-validation'
import { notifyReporterTicketClosed } from '@/lib/reporter-ticket-closed-notify'

/**
 * Called after a ticket is saved as CLOSED from the dashboard (e.g. /tickets) where
 * the client updates Supabase directly — same notifications as POST /api/close-ticket.
 */
export async function POST(req: Request) {
  const logger = getLogger()
  const requestId = `notify-reporter-closed-${Date.now()}`

  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      logger.error('NOTIFY_CLOSED', 'Supabase admin init failed', envError as Error, { requestId })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const clientId = auth.ctx.clientId

    const body = await req.json()
    const ticket_id = sanitizeId((body as { ticket_id?: unknown })?.ticket_id)

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 })
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, status, reporter_phone, project_id, client_id, projects (name)')
      .eq('id', ticket_id)
      .eq('client_id', clientId)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if ((ticket as { status?: string }).status !== 'CLOSED') {
      return NextResponse.json({ error: 'Ticket is not closed', code: 'NOT_CLOSED' }, { status: 400 })
    }

    const t = ticket as {
      reporter_phone?: string | null
      projects?: { name?: string | null } | { name?: string | null }[] | null
    }
    const proj = t.projects
    const projectName = Array.isArray(proj) ? proj[0]?.name : proj?.name

    const reporterHasPhone = Boolean(t.reporter_phone?.trim())

    const notify = await notifyReporterTicketClosed(supabaseAdmin, clientId, {
      reporterPhone: t.reporter_phone,
      projectName: projectName || 'הבניין',
    })

    logger.info('NOTIFY_CLOSED', 'Reporter WhatsApp after close', {
      requestId,
      ticket_id,
      whatsappSent: notify.whatsappSent,
    })

    if (notify.whatsappError) {
      logger.warn('NOTIFY_CLOSED', 'WhatsApp notify failed', { requestId, ticket_id, error: notify.whatsappError })
    }

    return NextResponse.json({
      success: true,
      reporter_has_phone: reporterHasPhone,
      whatsapp_sent: notify.whatsappSent,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('NOTIFY_CLOSED', 'Route error', err, { requestId: `notify-reporter-closed-${Date.now()}` })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
