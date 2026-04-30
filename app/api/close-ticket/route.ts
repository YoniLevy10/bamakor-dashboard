import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { requireSessionClientId } from '@/lib/api-auth'
import { getLogger } from '@/lib/logging'
import { notifyReporterTicketClosed } from '@/lib/reporter-ticket-closed-notify'
import { checkRateLimitDistributed, sanitizeId } from '@/lib/api-validation'

export async function POST(req: Request) {
  const logger = getLogger()
  const requestId = `close-ticket-${Date.now()}`
  
  logger.info('TICKET_API', 'Close ticket request received', { requestId })
  
  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      const error = envError instanceof Error ? envError : new Error(String(envError))
      logger.error('TICKET_API', 'Failed to initialize Supabase admin', error, { requestId })
      console.error('❌ Environment configuration error:', envError)
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const bamakorClientId = auth.ctx.clientId

    const body = await req.json()
    const ticket_id = sanitizeId((body as { ticket_id?: unknown })?.ticket_id)

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin,
      key: `ip:${ip}:close-ticket`,
      windowMs: 60_000,
      maxRequests: 60,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    if (!ticket_id) {
      logger.error('TICKET_API', 'Missing ticket_id parameter', undefined, { requestId })
      return NextResponse.json(
        { error: 'ticket_id is required', requestId },
        { status: 400 }
      )
    }

    const ticketQuery = supabaseAdmin
      .from('tickets')
      .select('id, status, reporter_phone, project_id, client_id, projects (name)')
      .eq('id', ticket_id)
      .eq('client_id', bamakorClientId)

    const { data: ticket, error: ticketError } = await ticketQuery.single()

    if (ticketError || !ticket) {
      console.warn('Ticket not found:', ticket_id)
      logger.error('TICKET_API', 'Ticket not found', ticketError, { requestId, ticket_id })
      return NextResponse.json(
        { error: 'Ticket not found', requestId },
        { status: 404 }
      )
    }

    if (ticket.status === 'CLOSED') {
      logger.warn('TICKET_API', 'Ticket already closed', { requestId, ticket_id })
      return NextResponse.json(
        { error: 'Ticket is already closed', code: 'ALREADY_CLOSED', requestId },
        { status: 409 }
      )
    }

    const clientId = bamakorClientId

    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
      .eq('client_id', clientId)
      .select()
      .single()

    if (updateError) {
      logger.error('TICKET_API', 'Failed to close ticket', updateError, { requestId, ticket_id })
      console.error('Failed to update ticket:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to close ticket',
          requestId,
        },
        { status: 500 }
      )
    }
    
    logger.info('TICKET_API', 'Ticket closed successfully', { requestId, ticket_id })

    type TicketWithProject = {
      reporter_phone?: string | null
      projects?: { name?: string | null } | { name?: string | null }[] | null
    }
    const trow = ticket as TicketWithProject
    const proj = trow.projects
    const projectName = Array.isArray(proj) ? proj[0]?.name : proj?.name

    const notify = await notifyReporterTicketClosed(supabaseAdmin, clientId, {
      reporterPhone: trow.reporter_phone,
      projectName: projectName || 'הבניין',
    })
    logger.info('TICKET_API', 'Reporter WhatsApp on close', {
      requestId,
      ticket_id,
      whatsappSent: notify.whatsappSent,
    })
    if (notify.whatsappError) {
      logger.warn('TICKET_API', 'Reporter WhatsApp on close failed', {
        requestId,
        ticket_id,
        error: notify.whatsappError,
      })
    }

    const { error: sessionError } = await supabaseAdmin
      .from('sessions')
      .update({
        active_ticket_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('active_ticket_id', ticket_id)
      .eq('client_id', clientId)

    if (sessionError) {
      console.error('⚠️ Failed to clear session:', sessionError)
      logger.warn('TICKET_API', 'Failed to clear session after closing ticket', { requestId, ticket_id, error: sessionError.message })
    }

    const { error: logError } = await supabaseAdmin.from('ticket_logs').insert([
      {
        ticket_id,
        action_type: 'TICKET_CLOSED',
        performed_by: 'system',
        notes: 'Ticket closed successfully',
        created_at: new Date().toISOString(),
      },
    ])

    if (logError) {
      console.error('⚠️ Failed to insert close log:', logError)
      logger.warn('TICKET_API', 'Failed to insert close log', { requestId, ticket_id, error: logError.message })
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      reporter_has_phone: Boolean(trow.reporter_phone?.trim()),
      whatsapp_sent: notify.whatsappSent,
      requestId,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('TICKET_API', 'Close ticket route error', err, { requestId })
    console.error('❌ Error closing ticket:', error)
    return NextResponse.json(
      {
        error: 'Server error',
        requestId,
      },
      { status: 500 }
    )
  }
}