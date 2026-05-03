/**
 * Alias merge endpoint: POST body { source_id, target_id } maps to merge-ticket behavior.
 */
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { mergeTicketsByIdBodySchema } from '@/lib/api-body-schemas'
import { checkAuthenticatedPostRouteLimit } from '@/lib/rate-limit'
import { requireSessionClientId } from '@/lib/api-auth'
import { getLogger, getAuditLogger } from '@/lib/logging'
import { logAudit } from '@/lib/audit'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `tickets-merge-${Date.now()}`
  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('[tickets/merge]', envError)
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
    const validated = mergeTicketsByIdBodySchema.safeParse(rawBody)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }
    const sourceTicketId = validated.data.source_id
    const targetTicketId = validated.data.target_id

    if (sourceTicketId === targetTicketId) {
      return NextResponse.json({ error: 'לא ניתן למזג תקלה לעצמה', requestId }, { status: 400 })
    }

    const { data: source, error: sErr } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, project_id, description, status, client_id')
      .eq('id', sourceTicketId)
      .eq('client_id', bamakorClientId)
      .is('deleted_at', null)
      .single()

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
      logger.error('TICKET_API', 'Merge update failed', new Error(upErr.message), {
        requestId,
        sourceTicketId,
        targetTicketId,
      })
      audit.logFailedOperation('MERGE', 'TICKET', sourceTicketId, clientId, upErr.message)
      return NextResponse.json({ error: 'עדכון תקלה נכשל', requestId }, { status: 500 })
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
      oldValues: { ticket_number: source.ticket_number, status: source.status },
      newValues: {
        merged_into_ticket_id: targetTicketId,
        merged_into_ticket_number: target.ticket_number,
        status: 'CLOSED',
        is_merged: true,
      },
    })

    return NextResponse.json({ success: true, merged_into_ticket_number: target.ticket_number, requestId })
  } catch (e) {
    console.error('[tickets/merge]', e)
    logger.error(
      'TICKET_API',
      'Unhandled tickets/merge error',
      e instanceof Error ? e : new Error(String(e)),
      { requestId }
    )
    return NextResponse.json({ error: 'internal', requestId }, { status: 500 })
  }
}
