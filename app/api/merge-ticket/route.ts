import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSingletonClientId } from '@/lib/singleton-client-server'

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const bamakorClientId = await getSingletonClientId(supabaseAdmin)
    const body = await req.json()
    const sourceTicketId = body?.source_ticket_id as string | undefined
    const targetTicketId = body?.target_ticket_id as string | undefined

    if (!sourceTicketId || !targetTicketId) {
      return NextResponse.json(
        { error: 'נדרשים source_ticket_id ו-target_ticket_id' },
        { status: 400 }
      )
    }

    if (sourceTicketId === targetTicketId) {
      return NextResponse.json({ error: 'לא ניתן למזג תקלה לעצמה' }, { status: 400 })
    }

    const sourceQuery = supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, project_id, description, status, client_id')
      .eq('id', sourceTicketId)
      .eq('client_id', bamakorClientId)
    const { data: source, error: sErr } = await sourceQuery.single()

    if (sErr || !source) {
      return NextResponse.json({ error: 'תקלת מקור לא נמצאה' }, { status: 404 })
    }

    const clientId = bamakorClientId

    const { data: target, error: tErr } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, project_id, status')
      .eq('id', targetTicketId)
      .eq('client_id', clientId)
      .single()

    if (tErr || !target) {
      return NextResponse.json({ error: 'תקלת יעד לא נמצאה' }, { status: 404 })
    }

    if (source.project_id !== target.project_id) {
      return NextResponse.json({ error: 'ניתן למזג רק תקלות מאותו בניין' }, { status: 400 })
    }

    if (source.status === 'CLOSED') {
      return NextResponse.json({ error: 'תקלת המקור כבר סגורה' }, { status: 409 })
    }

    if (target.status === 'CLOSED') {
      return NextResponse.json({ error: 'לא ניתן למזג לתקלה סגורה' }, { status: 409 })
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
      return NextResponse.json(
        { error: 'עדכון תקלה נכשל', details: upErr.message },
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

    return NextResponse.json({ success: true, merged_into_ticket_number: target.ticket_number })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
