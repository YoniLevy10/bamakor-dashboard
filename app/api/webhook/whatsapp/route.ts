import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { parseIncomingWhatsAppMessage } from '@/lib/whatsapp-parser'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'


const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'bamakor_verify_123'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge || 'OK', { status: 200 })
  }

  return new NextResponse('Verification failed', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabaseAdmin = getSupabaseAdmin()

    console.log('✅ WEBHOOK DB VERSION ACTIVE')
    console.log('📩 WhatsApp webhook payload:', JSON.stringify(body, null, 2))

    const parsedMessage = parseIncomingWhatsAppMessage(body)

    if (!parsedMessage) {
      console.log('ℹ️ No incoming user message in payload')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const { from, messageType, textBody } = parsedMessage

    console.log('📞 From:', from)
    console.log('🧩 Message Type:', messageType)
    console.log('💬 Message body:', textBody)

    if (messageType !== 'text') {
      console.log('ℹ️ Non-text message received. Ignoring for MVP.')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    if (!textBody) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // STEP 1: START_<PROJECT_CODE>
    if (textBody.toUpperCase().startsWith('START_')) {
      const projectCode = textBody.replace(/^START_/i, '').trim().toUpperCase()

      console.log('🚀 Start flow detected for project code:', projectCode)

      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id, name, project_code')
        .eq('project_code', projectCode)
        .maybeSingle()

      if (projectError) {
        console.error('❌ Error fetching project:', projectError)
        return NextResponse.json({ error: 'Project lookup failed' }, { status: 500 })
      }

     if (!project) {
  console.log('⚠️ No project found for code:', projectCode)

  try {
    await sendWhatsAppTextMessage(
      from,
      'לא הצלחנו לזהות את קוד הפרויקט. אנא סרקו שוב את ה-QR או פנו למנהלת הבניין.'
    )
  } catch (sendError) {
    console.error('⚠️ Failed to send project-not-found reply:', sendError)
  }

  return NextResponse.json(
    {
      received: true,
      projectFound: false,
      projectCode,
    },
    { status: 200 }
  )
}


      const { error: deactivateError } = await supabaseAdmin
        .from('sessions')
        .update({
          is_active: false,
          last_activity_at: new Date().toISOString(),
        })
        .eq('phone_number', from)
        .eq('is_active', true)

      if (deactivateError) {
        console.error('❌ Error deactivating old sessions:', deactivateError)
        return NextResponse.json({ error: 'Session cleanup failed' }, { status: 500 })
      }

      const { data: createdSession, error: sessionInsertError } = await supabaseAdmin
        .from('sessions')
        .insert({
          phone_number: from,
          project_id: project.id,
          is_active: true,
          active_ticket_id: null,
          last_activity_at: new Date().toISOString(),
        })
        .select('id, phone_number, project_id, is_active')
        .single()

      if (sessionInsertError) {
        console.error('❌ Error creating session:', sessionInsertError)
        return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
      }

      console.log('✅ Session created:', createdSession.id)
      console.log('🏗️ Project linked:', project.name)
      
      try {
  await sendWhatsAppTextMessage(
    from,
    `ברוכים הבאים למערכת דיווח התקלות של Bamakor.\n\nאנא כתבו בקצרה את התקלה שברצונכם לדווח.`
  )
} catch (sendError) {
  console.error('⚠️ Failed to send start-flow reply:', sendError)
}


      return NextResponse.json(
        {
          received: true,
          type: 'start_flow',
          from,
          projectCode,
          projectId: project.id,
          sessionId: createdSession.id,
        },
        { status: 200 }
      )
    }

    // STEP 2: create ticket from active session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('id, phone_number, project_id, active_ticket_id, is_active')
      .eq('phone_number', from)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionError) {
      console.error('❌ Error fetching session:', sessionError)
      return NextResponse.json({ error: 'Session lookup failed' }, { status: 500 })
    }

    if (!session) {
      console.log('ℹ️ No active session found. Ignoring free text for now.')
      return NextResponse.json(
        {
          received: true,
          type: 'no_active_session',
          from,
        },
        { status: 200 }
      )
    }

    const { data: createdTicket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        project_id: session.project_id,
        reporter_phone: from,
        description: textBody,
        status: 'NEW',
        priority: 'NORMAL',
        language: 'he',
        source: 'whatsapp',
      })
      .select('id, ticket_number, project_id')
      .single()

    if (ticketError) {
      console.error('❌ Error creating ticket:', ticketError)
      return NextResponse.json({ error: 'Ticket creation failed' }, { status: 500 })
    }

    const { error: sessionUpdateError } = await supabaseAdmin
      .from('sessions')
      .update({
        active_ticket_id: createdTicket.id,
        is_active: false,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (sessionUpdateError) {
      console.error('❌ Error updating session after ticket creation:', sessionUpdateError)
    }

    // best-effort logging only - do not fail the request if this breaks
const { error: logError } = await supabaseAdmin
  .from('ticket_logs')
  .insert({
    ticket_id: createdTicket.id,
    action_type: 'CREATED_FROM_WHATSAPP',
    notes: `Ticket opened from WhatsApp by ${from}`,
    created_by: 'system',
    meta: {
      phone: from,
      source: 'whatsapp',
    },
  })

if (logError) {
  console.error('⚠️ Ticket log insert failed (non-blocking):', logError)
}

console.log('✅ Ticket created:', createdTicket.ticket_number)

try {
  await sendWhatsAppTextMessage(
    from,
    `התקלה התקבלה בהצלחה.\nמספר הפנייה שלך: ${createdTicket.ticket_number}\nנעדכן כשיהיה טיפול.\nלפתיחת תקלה חדשה נוספת, סרקו שוב את קוד ה-QR.`
  )
} catch (sendError) {
  console.error('⚠️ Failed to send ticket-created reply:', sendError)
}

return NextResponse.json(
  {
    received: true,
    type: 'ticket_created',
    from,
    ticketId: createdTicket.id,
    ticketNumber: createdTicket.ticket_number,
  },
  { status: 200 }
)

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 500 })
  }
}
