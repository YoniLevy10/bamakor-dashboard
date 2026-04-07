import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { parseIncomingWhatsAppMessage } from '@/lib/whatsapp-parser'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'bamakor_verify_123'

function parseStartCode(text: string) {
  const match = text.trim().toUpperCase().match(/^START_(BMK\d+)(?:_(.+))?$/i)

  if (!match) return null

  return {
    projectCode: match[1],
    buildingNumber: match[2] ? match[2].trim() : null,
  }
}

// Search for projects by free-text building/address
async function searchProjectsByBuilding(searchText: string, supabaseAdmin: any) {
  const trimmed = searchText.trim()
  
  // Require minimum 2 characters to search
  if (trimmed.length < 2) {
    return []
  }

  const lowerSearch = trimmed.toLowerCase()

  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, project_code')
    .order('project_code', { ascending: true })

  if (error) {
    console.error('❌ Error searching projects:', error)
    return []
  }

  // Filter projects by name match (never expose full list)
  const matches = (projects || [])
    .filter((p: any) =>
      p.name.toLowerCase().includes(lowerSearch) ||
      p.project_code.toLowerCase().includes(lowerSearch)
    )
    .slice(0, 3) // Max 3 results to prevent data leakage

  return matches
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

    // STEP 1: START_<PROJECT_CODE> or START_<PROJECT_CODE>_<BUILDING>
    if (textBody.toUpperCase().startsWith('START_')) {
      const parsedStart = parseStartCode(textBody)

      if (!parsedStart) {
        try {
          await sendWhatsAppTextMessage(
            from,
            'פורמט קוד ה-QR לא תקין. אנא סרקו שוב את הקוד או פנו למנהלת הבניין.'
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send invalid-start-code reply:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'invalid_start_code',
            from,
          },
          { status: 200 }
        )
      }

      const { projectCode, buildingNumber } = parsedStart

      console.log('🚀 Start flow detected for project code:', projectCode)
      console.log('🏢 Building number:', buildingNumber || 'none')

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
        const buildingText = buildingNumber ? ` (בניין ${buildingNumber})` : ''

        await sendWhatsAppTextMessage(
          from,
          `ברוכים הבאים למערכת דיווח התקלות של Bamakor${buildingText}.\n\nאנא כתבו בקצרה את התקלה שברצונכם לדווח.`
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
          buildingNumber,
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
      // STEP 2.5: FREE-TEXT BUILDING SEARCH FALLBACK (when no active session)
      console.log('ℹ️ No active session found. Attempting free-text building search...')

      const searchResults = await searchProjectsByBuilding(textBody, supabaseAdmin)

      if (searchResults.length === 0) {
        // No matches found - send safe error message
        console.log('❌ No building matches found for search:', textBody)

        try {
          await sendWhatsAppTextMessage(
            from,
            'לא הצלחנו לזהות את הבניין. אנא:\n1. סרקו את קוד ה-QR בבניין, או\n2. פנו למנהלת הבניין ודרשו את קוד הגישה.'
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send no-match message:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'search_no_match',
            from,
          },
          { status: 200 }
        )
      }

      if (searchResults.length === 1) {
        // Exactly 1 match - auto-create session
        const matchedProject = searchResults[0]
        console.log('✅ Found 1 matching building:', matchedProject.name)

        const { data: createdSession, error: sessionCreateError } = await supabaseAdmin
          .from('sessions')
          .insert({
            phone_number: from,
            project_id: matchedProject.id,
            is_active: true,
            active_ticket_id: null,
            last_activity_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (sessionCreateError) {
          console.error('❌ Error creating session from search match:', sessionCreateError)
          return NextResponse.json(
            { error: 'Session creation failed' },
            { status: 500 }
          )
        }

        // Send confirmation message with project name
        try {
          await sendWhatsAppTextMessage(
            from,
            `מצאנו את הבניין: ${matchedProject.name}\n\nאנא כתבו בקצרה את התקלה שברצונכם לדווח.`
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send search-match confirmation:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'search_auto_match',
            from,
            projectId: matchedProject.id,
            sessionId: createdSession.id,
            buildingName: matchedProject.name,
          },
          { status: 200 }
        )
      }

      // Multiple matches (2-3) - send list with project codes
      console.log(`⚠️ Found ${searchResults.length} matching buildings`)

      let matchList = 'מצאנו כמה בניינים תואמים:\n\n'
      searchResults.forEach((project: any, index: number) => {
        matchList += `${index + 1}. ${project.name} [${project.project_code}]\n`
      })
      matchList +=
        '\n📌 אנא חזרו לדף ההתחלה, סרקו את קוד ה-QR של הבניין הנכון, או פנו למנהלת הבניין.'

      try {
        await sendWhatsAppTextMessage(from, matchList)
      } catch (sendError) {
        console.error('⚠️ Failed to send multi-match list:', sendError)
      }

      return NextResponse.json(
        {
          received: true,
          type: 'search_multiple_matches',
          from,
          matchCount: searchResults.length,
        },
        { status: 200 }
      )
    }

    const { data: existingProject, error: existingProjectError } = await supabaseAdmin
      .from('projects')
      .select('project_code, qr_identifier')
      .eq('id', session.project_id)
      .maybeSingle()

    if (existingProjectError) {
      console.error('⚠️ Failed to fetch project for building extraction:', existingProjectError)
    }

    let buildingNumber: string | null = null

    if (existingProject?.qr_identifier) {
      const parsedStart = parseStartCode(existingProject.qr_identifier)
      buildingNumber = parsedStart?.buildingNumber || null
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
        building_number: buildingNumber,
      })
      .select('id, ticket_number, project_id, building_number')
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
        action_type: 'CREATED_FROM_WHATSAPP',
        notes: `Ticket opened from WhatsApp by ${from}`,
        created_by: 'system',
        meta: {
          phone: from,
          source: 'whatsapp',
          building_number: buildingNumber,
        },
      })

    if (logError) {
      console.error('⚠️ Ticket log insert failed (non-blocking):', logError)
    }

    console.log('✅ Ticket created:', createdTicket.ticket_number)

    try {
      const { data: projectForNotification, error: projectNotificationError } = await supabaseAdmin
        .from('projects')
        .select('name, manager_phone')
        .eq('id', session.project_id)
        .single()

      if (projectNotificationError) {
        console.error('⚠️ Failed to fetch project manager phone:', projectNotificationError)
      } else if (projectForNotification?.manager_phone) {
        const buildingText = buildingNumber ? `\nבניין: ${buildingNumber}` : ''

        await sendWhatsAppTextMessage(
          projectForNotification.manager_phone,
          `נכנסה תקלה חדשה במערכת.\n\nפרויקט: ${projectForNotification.name}${buildingText}\nפנייה: ${createdTicket.ticket_number}\nתיאור: ${textBody}\nמדווח: ${from}`
        )
      }
    } catch (notifyManagerError) {
      console.error('⚠️ Failed to notify manager:', notifyManagerError)
    }

    try {
      const buildingText = buildingNumber ? `\nבניין: ${buildingNumber}` : ''

      await sendWhatsAppTextMessage(
        from,
        `התקלה התקבלה בהצלחה.${buildingText}\nמספר הפנייה שלך: ${createdTicket.ticket_number}\nנעדכן כשיהיה טיפול.\nלפתיחת תקלה חדשה נוספת, סרקו שוב את קוד ה-QR.`
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
        buildingNumber,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 500 })
  }
}

