import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendWorkerSMS } from '@/lib/sms-send'
import { getLogger, getAuditLogger } from '@/lib/logging'

// ARCHIVED: Old WhatsApp notification
// import { sendWhatsAppTextWithTemplateFallback } from '@/lib/whatsapp-send'
// const WORKER_TEMPLATE_NAME = 'worker_assignment_notice'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `assign-ticket-${Date.now()}`
  
  logger.info('TICKET_API', 'Assign ticket request received', { requestId })
  
  try {
    const bamakorClientId = process.env.BAMAKOR_CLIENT_ID
    if (!bamakorClientId) {
      return NextResponse.json(
        { error: 'Server configuration error. BAMAKOR_CLIENT_ID is not set.' },
        { status: 500 }
      )
    }

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('❌ Environment configuration error:', envError)
      const error = envError instanceof Error ? envError : new Error(String(envError))
      logger.error('TICKET_API', 'Failed to initialize Supabase admin', error, { requestId })
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
      logger.error('TICKET_API', 'Missing required parameters', undefined, { requestId, ticket_id, worker_id })
      return NextResponse.json(
        { error: 'ticket_id and worker_id are required' },
        { status: 400 }
      )
    }

    const ticketQuery = supabaseAdmin
      .from('tickets')
      .select(`
        id,
        ticket_number,
        description,
        project_id,
        client_id,
        status,
        projects (
          name,
          project_code
        )
      `)
      .eq('id', ticket_id)
      .eq('client_id', bamakorClientId)

    const { data: ticket, error: ticketError } = await ticketQuery.single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const clientId = bamakorClientId

    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('name, sms_sender_name')
      .eq('id', clientId)
      .maybeSingle()

    const clientName = (clientRow as { name?: string | null } | null)?.name || 'המערכת'
    const smsSenderName =
      (clientRow as { sms_sender_name?: string | null } | null)?.sms_sender_name || 'במקור'

    const { data: worker, error: workerError } = await supabaseAdmin
      .from('workers')
      .select('id, full_name, phone, role, is_active')
      .eq('id', worker_id)
      .eq('client_id', clientId)
      .single()

    if (workerError || !worker) {
      return NextResponse.json(
        { error: 'Worker not found' },
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
      .eq('client_id', clientId)
      .select()
      .single()

    if (updateError) {
      logger.error('TICKET_API', 'Failed to assign ticket', updateError, { requestId, ticket_id, worker_id })
      audit.logFailedOperation('UPDATE', 'TICKET', ticket_id, 'unknown', `Assignment failed: ${updateError.message}`)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    audit.logTicketAssigned('unknown', ticket_id, worker_id)
    logger.info('TICKET_API', 'Ticket assigned successfully', { requestId, ticket_id, worker_id })

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
        console.log('� NOTIFICATION_CHANNEL: SMS (worker assignment)')
        console.log('📱 Sending worker notification to:', worker.phone)

        // CURRENT CHANNEL: SMS for worker notifications
        const smsMessage = `תקלה חדשה הוקצתה לך\nפרויקט: ${projectName}\nתקלה: #${ticket.ticket_number}\nתיאור: ${ticket.description || 'ללא פירוט'}\nכניסה למערכת:\nhttps://bamakor.vercel.app/tickets\n${clientName}`
        const smsSent = await sendWorkerSMS(worker.phone, smsMessage, smsSenderName)

        if (smsSent) {
          console.log('✅ worker_sms_sent: Worker notification sent successfully via SMS to:', worker.phone)
        } else {
          console.error('❌ worker_sms_failed: Failed to send SMS to worker:', worker.phone)
        }

        // ARCHIVED: Old WhatsApp notification (kept for reference, can be restored later)
        // Once WhatsApp templates are approved by Meta, uncomment and modify:
        /*
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
        console.log('✅ worker_whatsapp_archived: Old WhatsApp channel was here')
        */
      } catch (sendError) {
        console.error('⚠️ worker_notification_failed: Error sending worker notification:', sendError)
      }
    } else {
      console.log('ℹ️ Worker has no phone number, skipping notification')
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('TICKET_API', 'Assign ticket route error', err, { requestId })
    console.error('❌ assign-ticket route error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

