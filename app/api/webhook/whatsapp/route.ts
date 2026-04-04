import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'bamakor_verify_123'

type WhatsAppMessage = {
  from?: string
  id?: string
  timestamp?: string
  type?: string
  text?: {
    body?: string
  }
  image?: {
    id?: string
    mime_type?: string
    caption?: string
  }
  audio?: {
    id?: string
    mime_type?: string
    voice?: boolean
  }
}

function generateTicketNumber() {
  return `BMK-${Math.floor(100000 + Math.random() * 900000)}`
}

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

    console.log('✅ WEBHOOK DB VERSION ACTIVE')
    console.log('📩 WhatsApp webhook payload:', JSON.stringify(body, null, 2))

    const value = body?.entry?.[0]?.changes?.[0]?.value
    const message: WhatsAppMessage | undefined = value?.messages?.[0]

    if (!message) {
      console.log('ℹ️ No incoming user message in payload')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const from = message.from || ''
    const messageType = message.type || ''

    console.log('📞 From:', from)
    console.log('🧩 Message Type:', messageType)

    if (messageType !== 'text') {
      console.log('ℹ️ Non-text message received. Ignoring for MVP.')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const textBody = message.text?.body?.trim() || ''
    console.log('💬 Message body:', textBody)

    if (!textBody) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

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
        return NextResponse.json({ received: true, projectFound: false }, { status: 200 })
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

    const ticketNumber = generateTicketNumber()

    const { data: createdTicket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        project_id: session.project_id,
        reporter_phone: from,
        description: textBody,
        status: 'NEW',
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

    const { error: logError } = await supabaseAdmin
      .from('ticket_logs')
      .insert({
        ticket_id: createdTicket.id,
        action: 'CREATED_FROM_WHATSAPP',
        notes: `Ticket opened from WhatsApp by ${from}`,
        created_by: 'system',
        meta: {
          phone: from,
          source: 'whatsapp',
        },
      })

    if (logError) {
      console.error('❌ Error creating ticket log:', logError)
    }

    console.log('✅ Ticket created:', createdTicket.ticket_number)

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
