import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendWhatsAppTextWithTemplateFallback } from '@/lib/whatsapp-send'

const WORKER_TEMPLATE_NAME = 'worker_assignment_notice'

export async function POST(req: Request) {
  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('❌ Environment configuration error:', envError)
      return NextResponse.json(
        {
          error: 'Server configuration error. Required environment variables are not set.',
          details: process.env.NODE_ENV === 'development' ? String(envError) : undefined,
        },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { ticket_id, worker_id } = body

    if (!ticket_id || !worker_id) {
      return NextResponse.json(
        { error: 'ticket_id and worker_id are required' },
        { status: 400 }
      )
    }

    const { data: worker, error: workerError } = await supabaseAdmin
      .from('workers')
      .select('id, full_name, phone, role, is_active')
      .eq('id', worker_id)
      .single()

    if (workerError || !worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
        { status: 404 }
      )
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select(`
        id,
        ticket_number,
        description,
        project_id,
        status,
        projects (
          name,
          project_code
        )
      `)
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({
        assigned_worker_id: worker_id,
        status: 'ASSIGNED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    const project = Array.isArray(ticket.projects) ? ticket.projects[0] : ticket.projects
    const projectName = project?.name || 'ללא שם פרויקט'

    const { error: logError } = await supabaseAdmin
      .from('ticket_logs')
      .insert({
        ticket_id,
        action_type: 'ASSIGNED_TO_WORKER',
        notes: `Ticket assigned to worker ${worker.full_name}`,
        created_by: 'system',
        meta: {
          worker_id: worker.id,
          worker_name: worker.full_name,
        },
      })

    if (logError) {
      console.error('⚠️ Failed to insert assign log:', logError)
    }

    if (worker.phone) {
      try {
        console.log('📤 Sending worker notification to:', worker.phone)

        await sendWhatsAppTextWithTemplateFallback(
          worker.phone,
          `הוקצתה לך תקלה חדשה.\n\nפרויקט: ${projectName}\nפנייה: ${ticket.ticket_number}\nתיאור: ${ticket.description || 'ללא תיאור'}`,
          WORKER_TEMPLATE_NAME,
          [
            projectName,
            String(ticket.ticket_number),
            ticket.description || 'ללא תיאור',
          ],
          'he'
        )

        console.log('✅ Worker notification sent successfully to:', worker.phone)
      } catch (sendError) {
        console.error('⚠️ Failed to notify worker:', sendError)
      }
    } else {
      console.log('ℹ️ Worker has no phone number, skipping WhatsApp notification')
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    })
  } catch (error) {
    console.error('❌ assign-ticket route error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

