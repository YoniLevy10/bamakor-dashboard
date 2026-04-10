import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getLogger, getAuditLogger } from '@/lib/logging'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `update-ticket-${Date.now()}`
  
  logger.info('TICKET_API', 'Update ticket request received', { requestId })
  
  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      const error = envError instanceof Error ? envError : new Error(String(envError))
      logger.error('TICKET_API', 'Failed to initialize Supabase admin', error, { requestId })
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    const body = await req.json()
    const { ticket_id, priority, status } = body

    if (!ticket_id) {
      logger.error('TICKET_API', 'Missing ticket_id parameter', undefined, { requestId })
      return NextResponse.json(
        { error: 'ticket_id is required' },
        { status: 400 }
      )
    }

    // Validate ticket exists
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id')
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      logger.error('TICKET_API', 'Ticket not found', ticketError, { requestId, ticket_id })
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Prepare update payload
    const updatePayload: Record<string, unknown> = {}
    if (priority !== undefined && priority !== null) {
      updatePayload.priority = priority
    }
    if (status !== undefined && status !== null) {
      updatePayload.status = status
    }

    if (Object.keys(updatePayload).length === 0) {
      logger.error('TICKET_API', 'No fields to update', undefined, { requestId, ticket_id })
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update ticket
    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticket_id)
      .select()

    if (updateError) {
      logger.error('TICKET_API', 'Failed to update ticket', updateError, { requestId, ticket_id, updates: Object.keys(updatePayload) })
      audit.logFailedOperation('UPDATE', 'TICKET', ticket_id, 'unknown', `Update failed: ${updateError.message}`)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    logger.info('TICKET_API', 'Ticket updated successfully', { requestId, ticket_id, updates: Object.keys(updatePayload) })

    return NextResponse.json({
      success: true,
      data: updatedTicket,
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('TICKET_API', 'Update ticket route error', err, { requestId })
    console.error('Error updating ticket:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
