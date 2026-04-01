import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ticket_id, worker_id } = body

    if (!ticket_id || !worker_id) {
      return NextResponse.json(
        { error: 'ticket_id and worker_id are required' },
        { status: 400 }
      )
    }

    const { data: worker } = await supabase
      .from('workers')
      .select('*')
      .eq('id', worker_id)
      .single()

    if (!worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }

    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single()

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .update({
        assigned_worker_id: worker_id,
        status: 'ASSIGNED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
      .select()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    await supabase.from('ticket_logs').insert([
      {
        ticket_id,
        action_type: 'ASSIGNED_TO_WORKER',
        new_value: worker_id,
        performed_by: 'system',
      },
    ])

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}