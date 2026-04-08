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

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, ticket_number, status')
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      console.warn('Ticket not found:', ticket_id)
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    if (ticket.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Ticket is already closed', code: 'ALREADY_CLOSED' },
        { status: 409 }
      )
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update ticket:', updateError)
      return NextResponse.json(
        {
          error: 'Failed to close ticket',
          details: process.env.NODE_ENV === 'development' ? updateError.message : undefined,
        },
        { status: 500 }
      )
    }

    const { error: sessionError } = await supabase
      .from('sessions')
      .update({
        active_ticket_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('active_ticket_id', ticket_id)

    if (sessionError) {
      console.error('⚠️ Failed to clear session:', sessionError)
    }

    const { error: logError } = await supabase.from('ticket_logs').insert([
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
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    })
  } catch (error) {
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