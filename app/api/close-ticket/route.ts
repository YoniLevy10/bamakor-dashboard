import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { getLogger } from '@/lib/logging'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'

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
    
    const body = await req.json()
    const { ticket_id } = body

    if (!ticket_id) {
      logger.error('TICKET_API', 'Missing ticket_id parameter', undefined, { requestId })
      return NextResponse.json(
        { error: 'ticket_id is required' },
        { status: 400 }
      )
    }

    const headerClientId = req.headers.get('x-client-id')
    let ticketQuery = supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, status, reporter_phone, project_id, client_id, projects (name)')
      .eq('id', ticket_id)
    if (headerClientId) ticketQuery = ticketQuery.eq('client_id', headerClientId)

    const { data: ticket, error: ticketError } = await ticketQuery.single()

    if (ticketError || !ticket) {
      console.warn('Ticket not found:', ticket_id)
      logger.error('TICKET_API', 'Ticket not found', ticketError, { requestId, ticket_id })
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    if (ticket.status === 'CLOSED') {
      logger.warn('TICKET_API', 'Ticket already closed', { requestId, ticket_id })
      return NextResponse.json(
        { error: 'Ticket is already closed', code: 'ALREADY_CLOSED' },
        { status: 409 }
      )
    }

    const clientId = headerClientId || (ticket as { client_id?: string | null }).client_id
    if (!clientId) {
      return NextResponse.json({ error: 'חסר client_id' }, { status: 400 })
    }

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
          details: process.env.NODE_ENV === 'development' ? updateError.message : undefined,
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
    const reporterPhone = trow.reporter_phone
    const proj = trow.projects
    const projectName = Array.isArray(proj) ? proj[0]?.name : proj?.name

    if (reporterPhone) {
      try {
        const building = projectName || 'הבניין'

        const { data: waClient } = clientId
          ? await supabaseAdmin
              .from('clients')
              .select('whatsapp_phone_number_id, whatsapp_access_token')
              .eq('id', clientId)
              .maybeSingle()
          : { data: null }

        const residentWhatsAppCreds = {
          phoneNumberId: (waClient as { whatsapp_phone_number_id?: string | null } | null)
            ?.whatsapp_phone_number_id || undefined,
          accessToken: (waClient as { whatsapp_access_token?: string | null } | null)
            ?.whatsapp_access_token || undefined,
        }

        await sendWhatsAppTextMessage(
          reporterPhone,
          `✅ שלום! התקלה שדיווחת בבניין ${building} טופלה וסגורה.\n\nאם יש בעיה נוספת, ניתן לפנות אלינו בכל עת 🙏`,
          residentWhatsAppCreds
        )
        logger.info('TICKET_API', 'Resident WhatsApp sent on close', { requestId, ticket_id })
      } catch (waErr) {
        logger.warn('TICKET_API', 'Failed to send WhatsApp on ticket close', {
          requestId,
          ticket_id,
          error: waErr instanceof Error ? waErr.message : String(waErr),
        })
      }
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
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('TICKET_API', 'Close ticket route error', err, { requestId })
    console.error('❌ Error closing ticket:', error)
    return NextResponse.json(
      {
        error: 'Server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}