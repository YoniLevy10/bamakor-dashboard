import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { mergeTicketsBodySchema } from '@/lib/api-body-schemas'
import { checkAuthenticatedPostRouteLimit } from '@/lib/rate-limit'
import { requireSessionClientId } from '@/lib/api-auth'
import { getLogger, getAuditLogger } from '@/lib/logging'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `merge-ticket-${Date.now()}`
  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('[merge-ticket]', envError)
      return NextResponse.json({ error: 'internal' }, { status: 500 })
    }

    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const bamakorClientId = auth.ctx.clientId

    const rl = await checkAuthenticatedPostRouteLimit(supabaseAdmin, auth.ctx.userId, 'merge-ticket')
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const rawBody = await req.json()
    const validated = mergeTicketsBodySchema.safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }
    const { source_ticket_id: sourceTicketId, target_ticket_id: targetTicketId } = validated.data

    if (sourceTicketId === targetTicketId) {
      return NextResponse.json({ error: 'לא ניתן למזג תקלה לעצמה', requestId }, { status: 400 })
    }

    const sourceQuery = supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, project_id, description, status, client_id')
      .eq('id', sourceTicketId)
      .eq('client_id', bamakorClientId)
      .is('deleted_at', null)
    const { data: source, error: sErr } = await sourceQuery.single()

    if (sErr || !source) {
      return NextResponse.json({ error: 'תקלת מקור לא נמצאה', requestId }, { status: 404 })
    }

    const clientId = bamakorClientId

    const { data: target, error: tErr } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, project_id, status')
      .eq('id', targetTicketId)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .single()

    if (tErr || !target) {
      return NextResponse.json({ error: 'תקלת יעד לא נמצאה', requestId }, { status: 404 })
    }

    if (source.project_id !== target.project_id) {
      return NextResponse.json({ error: 'ניתן למזג רק תקלות מאותו בניין', requestId }, { status: 400 })
    }

    if (source.status === 'CLOSED') {
      return NextResponse.json({ error: 'תקלת המקור כבר סגורה', requestId }, { status: 409 })
    }

    if (target.status === 'CLOSED') {
      return NextResponse.json({ error: 'לא ניתן למזג לתקלה סגורה', requestId }, { status: 409 })
    }

    const mergeNote = `מוזג לתקלה #${target.ticket_number}`
    const newDescription = `${source.description || ''}\n\n${mergeNote}`.trim()

    const { error: upErr } = await supabaseAdmin
      .from('tickets')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        description: newDescription,
        merged_into_ticket_id: targetTicketId,
        is_merged: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceTicketId)
      .eq('client_id', clientId)
      .is('deleted_at', null)

    if (upErr) {
      logger.error('TICKET_API', 'Merge update failed', new Error(upErr.message), { requestId, sourceTicketId, targetTicketId })
      audit.logFailedOperation('MERGE', 'TICKET', sourceTicketId, clientId, upErr.message)
      return NextResponse.json(
        { error: 'עדכון תקלה נכשל', requestId },
        { status: 500 }
      )
    }

    await supabaseAdmin.from('ticket_logs').insert({
      ticket_id: sourceTicketId,
      action_type: 'TICKET_CLOSED',
      performed_by: 'system',
      notes: mergeNote,
      created_at: new Date().toISOString(),
    })

    audit.logAction('MERGE', 'TICKET', sourceTicketId, clientId, 'dashboard')

    await logAudit({
      clientId,
      userId: auth.ctx.userId,
      action: 'MERGE_TICKETS',
      entityType: 'ticket',
      entityId: sourceTicketId,
      oldValues: { merged_from_ticket_number: (source as { ticket_number?: number }).ticket_number, status: (source as { status?: string }).status },
      newValues: {
        merged_into_ticket_id: targetTicketId,
        merged_into_ticket_number: (target as { ticket_number?: number }).ticket_number,
        status: 'CLOSED',
        is_merged: true,
      },
    })

    return NextResponse.json({ success: true, merged_into_ticket_number: target.ticket_number, requestId })
  } catch (e) {
    console.error('[merge-ticket]', e)
    logger.error('TICKET_API', 'Unhandled merge-ticket error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
