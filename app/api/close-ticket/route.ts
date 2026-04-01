import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ticket_id } = body

    if (!ticket_id) {
      return NextResponse.json(
        { error: 'ticket_id is required' },
        { status: 400 }
      )
    }

    // בדיקה שהטיקט קיים
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // עדכון סטטוס
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
      .select()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // ביטול session פעיל
    await supabase
      .from('sessions')
      .update({
        active_ticket_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('active_ticket_id', ticket_id)

    // לוג
    await supabase.from('ticket_logs').insert([
      {
        ticket_id,
        action_type: 'TICKET_CLOSED',
        performed_by: 'system',
        notes: 'Ticket closed successfully',
      },
    ])

    return NextResponse.json({
      success: true,
      mode: 'closed_ticket',
      ticket: updatedTicket,
    })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}