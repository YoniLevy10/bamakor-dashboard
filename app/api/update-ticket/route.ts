import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getLogger, getAuditLogger } from '@/lib/logging'
import { checkRateLimitDistributed, sanitizeId, sanitizeString } from '@/lib/api-validation'
import { requireSessionClientId } from '@/lib/api-auth'

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

    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const bamakorClientId = auth.ctx.clientId

    const body = await req.json()
    const ticket_id = sanitizeId((body as { ticket_id?: unknown })?.ticket_id)
    const priority = (body as { priority?: unknown })?.priority
    const status = (body as { status?: unknown })?.status

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin,
      key: `ip:${ip}:update-ticket`,
      windowMs: 60_000,
      maxRequests: 120,
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

    // Validate ticket exists
    const existsQuery = supabaseAdmin
      .from('tickets')
      .select('id, client_id')
      .eq('id', ticket_id)
      .eq('client_id', bamakorClientId)
    const { data: ticket, error: ticketError } = await existsQuery.single()

    if (ticketError || !ticket) {
      logger.error('TICKET_API', 'Ticket not found', ticketError, { requestId, ticket_id })
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const clientId = bamakorClientId

    // Prepare update payload
    const updatePayload: Record<string, unknown> = {}
    if (priority !== undefined && priority !== null) {
      const p = sanitizeString(priority).toUpperCase()
      if (!['HIGH', 'MEDIUM', 'LOW'].includes(p)) {
        return NextResponse.json({ error: 'עדיפות לא תקינה', requestId }, { status: 400 })
      }
      updatePayload.priority = p
    }
    if (status !== undefined && status !== null) {
      const s = sanitizeString(status).toUpperCase()
      if (!['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'CLOSED'].includes(s)) {
        return NextResponse.json({ error: 'סטטוס לא תקין', requestId }, { status: 400 })
      }
      updatePayload.status = s
    }

    if (Object.keys(updatePayload).length === 0) {
      logger.error('TICKET_API', 'No fields to update', undefined, { requestId, ticket_id })
      return NextResponse.json(
        { error: 'No fields to update', requestId },
        { status: 400 }
      )
    }

    // Update ticket
    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticket_id)
      .eq('client_id', clientId)
      .select()

    if (updateError) {
      logger.error('TICKET_API', 'Failed to update ticket', updateError, { requestId, ticket_id, updates: Object.keys(updatePayload) })
      audit.logFailedOperation('UPDATE', 'TICKET', ticket_id, 'unknown', `Update failed: ${updateError.message}`)
      return NextResponse.json(
        { error: 'Server error', requestId },
        { status: 500 }
      )
    }
    
    logger.info('TICKET_API', 'Ticket updated successfully', { requestId, ticket_id, updates: Object.keys(updatePayload) })

    return NextResponse.json({
      success: true,
      data: updatedTicket,
      requestId,
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('TICKET_API', 'Update ticket route error', err, { requestId })
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Server error', requestId },
      { status: 500 }
    )
  }
}
