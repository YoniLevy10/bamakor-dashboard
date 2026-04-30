import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimitDistributed, sanitizeId } from '@/lib/api-validation'
import { requireSessionClientId } from '@/lib/api-auth'
import { getLogger, getAuditLogger } from '@/lib/logging'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `merge-ticket-${Date.now()}`
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin,
      key: `ip:${ip}:merge-ticket`,
      windowMs: 60_000,
      maxRequests: 30,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const bamakorClientId = auth.ctx.clientId
    const body = await req.json()
    const sourceTicketId = sanitizeId((body as { source_ticket_id?: unknown })?.source_ticket_id)
    const targetTicketId = sanitizeId((body as { target_ticket_id?: unknown })?.target_ticket_id)

    if (!sourceTicketId || !targetTicketId) {
      return NextResponse.json(
        { error: 'נדרשים source_ticket_id ו-target_ticket_id', requestId },
        { status: 400 }
      )
    }

    if (sourceTicketId === targetTicketId) {
      return NextResponse.json({ error: 'לא ניתן למזג תקלה לעצמה', requestId }, { status: 400 })
    }

    const sourceQuery = supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, project_id, description, status, client_id')
      .eq('id', sourceTicketId)
      .eq('client_id', bamakorClientId)
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceTicketId)
      .eq('client_id', clientId)

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
    return NextResponse.json({ success: true, merged_into_ticket_number: target.ticket_number, requestId })
  } catch (e) {
    logger.error('TICKET_API', 'Unhandled merge-ticket error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
