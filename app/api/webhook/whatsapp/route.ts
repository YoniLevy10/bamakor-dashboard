import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { parseIncomingWhatsAppMessage } from '@/lib/whatsapp-parser'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'
import {
  downloadWhatsAppMedia,
  uploadWhatsAppMediaToStorage,
  createAttachmentRecord,
} from '@/lib/whatsapp-media'
import { getLogger } from '@/lib/logging'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'bamakor_verify_123'
const logger = getLogger()

type ProjectRow = {
  id: string
  name: string
  project_code: string
  address?: string | null
}

function parseStartCode(text: string) {
  const match = text.trim().toUpperCase().match(/^START_(BMK\d+)(?:_(.+))?$/i)

  if (!match) return null

  return {
    projectCode: match[1],
    buildingNumber: match[2] ? match[2].trim() : null,
  }
}

// Search for projects by free-text building/address
async function searchProjectsByBuilding(searchText: string, supabaseAdmin: SupabaseClient) {
  const trimmed = searchText.trim()

  // Require minimum 2 characters to search
  if (trimmed.length < 2) {
    return []
  }

  const lowerSearch = trimmed.toLowerCase()

  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, project_code, address')
    .order('project_code', { ascending: true })

  if (error) {
    console.error('❌ Error searching projects:', error)
    return []
  }

  // Filter projects by name, address, or code match (never expose full list)
  const matches = (projects || [])
    .filter((p: ProjectRow) =>
      p.name?.toLowerCase().includes(lowerSearch) ||
      p.address?.toLowerCase().includes(lowerSearch) ||
      p.project_code?.toLowerCase().includes(lowerSearch)
    )
    .slice(0, 3) // Max 3 results to prevent data leakage

  return matches
}

// Create pending selection state for multi-match scenario
async function createPendingSelection(
  phoneNumber: string,
  candidateProjects: ProjectRow[],
  supabaseAdmin: SupabaseClient
) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  const { error } = await supabaseAdmin.from('pending_selections').insert({
    phone_number: phoneNumber,
    candidate_projects: candidateProjects,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  })

  if (error) {
    console.error('❌ Error creating pending selection:', error)
    return null
  }

  return true
}

// Get pending selection for a phone number
async function getPendingSelection(phoneNumber: string, supabaseAdmin: SupabaseClient) {
  const { data, error } = await supabaseAdmin
    .from('pending_selections')
    .select('id, candidate_projects, created_at, expires_at')
    .eq('phone_number', phoneNumber)
    .maybeSingle()

  if (error) {
    console.error('⚠️ Error fetching pending selection:', error)
    return null
  }

  if (!data) {
    return null
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    console.log('⏰ Pending selection expired, clearing it')
    await clearPendingSelection(phoneNumber, supabaseAdmin)
    return null
  }

  return data
}

// Clear pending selection for a phone number
async function clearPendingSelection(phoneNumber: string, supabaseAdmin: SupabaseClient) {
  const { error } = await supabaseAdmin
    .from('pending_selections')
    .delete()
    .eq('phone_number', phoneNumber)

  if (error) {
    console.error('⚠️ Error clearing pending selection:', error)
  }
}

// Check if message is a valid numeric selection (1, 2, or 3)
function isNumericSelection(text: string): number | null {
  const trimmed = text.trim()
  const num = parseInt(trimmed, 10)

  if (!isNaN(num) && num >= 1 && num <= 3 && trimmed === String(num)) {
    return num
  }

  return null
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
  const requestId = `webhook-whatsapp-${Date.now()}`
  logger.info('WEBHOOK', 'WhatsApp webhook POST received', { requestId })
  
  try {
    const body = await req.json()
    
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      const error = envError instanceof Error ? envError : new Error(String(envError))
      logger.error('WEBHOOK', 'Failed to initialize Supabase admin', error, { requestId })
      console.error('❌ Environment configuration error:', envError)
      return NextResponse.json(
        {
          error: 'Server configuration error',
          details: process.env.NODE_ENV === 'development' ? String(envError) : undefined,
        },
        { status: 500 }
      )
    }

    console.log('✅ WEBHOOK DB VERSION ACTIVE')
    console.log('📩 WhatsApp webhook payload:', JSON.stringify(body, null, 2))
    logger.debug('WEBHOOK', 'Full webhook payload', { requestId, payload: body })

    const parsedMessage = parseIncomingWhatsAppMessage(body)

    if (!parsedMessage) {
      console.log('ℹ️ No incoming user message in payload')
      logger.debug('WEBHOOK', 'No incoming message in payload', { requestId })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const { from, messageType, textBody, mediaId, mediaType } = parsedMessage

    console.log('📞 From:', from)
    console.log('🧩 Message Type:', messageType)
    console.log('💬 Message body:', textBody)
    console.log('📎 Media ID:', mediaId)
    console.log('📎 Media Type:', mediaType)
    
    logger.info('WEBHOOK', 'Parsed incoming message', { 
      requestId, 
      from, 
      messageType, 
      hasText: !!textBody,
      hasMedia: !!mediaId 
    })

    // HANDLE VOICE/AUDIO MESSAGES SAFELY
    if (messageType === 'audio') {
      console.log('🎙️ Voice/audio message received - sending fallback guidance')

      try {
        await sendWhatsAppTextMessage(
          from,
          '🎙️ קיבלנו הודעת קול, אך לא נוכל לעבד אותה.\n\nבשביל לדווח תקלה:\n1️⃣ כתבו את התקלה בטקסט\n2️⃣ או שלחו תמונה של התקלה\n\nרוצים להתחיל? סרקו את קוד ה-QR בבניין או כתבו את כתובת הבניין.'
        )
      } catch (sendError) {
        console.error('⚠️ Failed to send voice-message guidance:', sendError)
      }

      return NextResponse.json({ received: true, type: 'voice_message_fallback' }, { status: 200 })
    }

    // HANDLE IMAGE MESSAGES
    if (messageType === 'image' && mediaId && mediaType === 'image') {
      console.log('🖼️ Image message received - downloading and attaching to ticket')

      // Check if user has an active session/ticket context
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('id, phone_number, project_id, active_ticket_id, is_active')
        .eq('phone_number', from)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionError) {
        console.error('❌ Error fetching session for image attachment:', sessionError)
      }

      // Case A: Active ticket exists - attach image to it
      if (session?.active_ticket_id) {
        console.log(`📍 Active ticket found for ${from} - attaching image to ticket: ${session.active_ticket_id}`)

        // Step 1: Download media from WhatsApp
        console.log(`⏳ Step 1/4: Downloading image from WhatsApp (mediaId: ${mediaId})...`)
        const mediaData = await downloadWhatsAppMedia(mediaId, 'image')

        if (!mediaData) {
          console.error(`❌ Step 1 FAILED: Could not download media from WhatsApp for ticket ${session.active_ticket_id}. MediaId: ${mediaId}`, {
            reason: 'Meta Graph API download failed',
            mediaId,
            ticketId: session.active_ticket_id,
          })
          // Continue to fallback message below (ticket already exists, so don't lose it)
        } else {
          console.log(`✅ Step 1 SUCCESS: Downloaded ${mediaData.fileName} (${mediaData.mimeType}, ${mediaData.buffer.length} bytes)`)

          // Step 2: Upload to Supabase Storage
          console.log(`⏳ Step 2/4: Uploading to Supabase Storage...`)
          const uploadResult = await uploadWhatsAppMediaToStorage(
            session.active_ticket_id,
            mediaData.buffer,
            mediaData.fileName,
            mediaData.mimeType
          )

          if (uploadResult) {
            console.log(`✅ Step 2 SUCCESS: Uploaded to ${uploadResult.filePath}`)

            // Step 3: Create database record
            console.log(`⏳ Step 3/4: Creating attachment database record...`)
            const attachmentCreated = await createAttachmentRecord(
              supabaseAdmin,
              session.active_ticket_id,
              mediaData.fileName,
              uploadResult.filePath,
              uploadResult.fileSize,
              mediaData.mimeType,
              mediaId,
              'whatsapp_image'
            )

            if (attachmentCreated) {
              console.log(`✅ Step 3 SUCCESS: Attachment record created in database`)

              // Step 4: Send confirmation message
              console.log(`⏳ Step 4/4: Sending WhatsApp confirmation...`)
              try {
                await sendWhatsAppTextMessage(
                  from,
                  '✅ התמונה התקבלה וצורפה לתקלה.\n\nצוות כבר טוען על זה — תשמעו ממנו בקרוב!'
                )
                console.log(`✅ Step 4 SUCCESS: Confirmation message sent`)
              } catch (sendError) {
                console.error('⚠️ Step 4 WARNING: Failed to send confirmation (attachment was successful)', sendError)
              }

              return NextResponse.json(
                {
                  received: true,
                  type: 'image_attached_to_existing_ticket',
                  ticketId: session.active_ticket_id,
                },
                { status: 200 }
              )
            } else {
              console.error(`❌ Step 3 FAILED: Database record creation failed for ticket ${session.active_ticket_id}`, {
                reason: 'Attachment record insert failed - possible schema violation',
                ticketId: session.active_ticket_id,
                fileName: mediaData.fileName,
              })
            }
          } else {
            console.error(`❌ Step 2 FAILED: Storage upload failed for ticket ${session.active_ticket_id}`, {
              reason: 'Supabase Storage upload failed - check bucket permissions',
              ticketId: session.active_ticket_id,
              fileName: mediaData.fileName,
            })
          }
        }

        // Fallback: Image download/upload failed but don't lose the ticket
        console.log(`📤 Sending fallback message: attachment failed but ticket preserved`)
        try {
          await sendWhatsAppTextMessage(
            from,
            '⚠️ לא הצלחנו להוסיף את התמונה, אך התקלה שלך תקבלה.\n\nנעדכן כשיהיה טיפול.'
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send fallback message:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'image_failed_but_ticket_ok',
            ticketId: session.active_ticket_id,
            warning: 'Image upload failed but ticket was created',
          },
          { status: 200 }
        )
      }

      // Case B: No context - guide user to start flow
      console.log('📍 Image received but no active ticket context - guiding user to start')

      try {
        await sendWhatsAppTextMessage(
          from,
          '🖼️ קיבלנו את התמונה!\n\nכדי לצרף אותה לתקלה, צריך קודם:\n1️⃣ סרקו QR בבניין\n2️⃣ כתבו תיאור התקלה\n3️⃣ אז שלחו תמונה\n\nהשתדלו!'
        )
      } catch (sendError) {
        console.error('⚠️ Failed to send image-context-needed message:', sendError)
      }

      return NextResponse.json(
        {
          received: true,
          type: 'image_received_no_context',
        },
        { status: 200 }
      )
    }

    // HANDLE OTHER MEDIA TYPES (video, document) - NOT SUPPORTED YET
    if (messageType === 'video' || messageType === 'document') {
      console.log(`📽️ Media message received (${messageType}) - sending fallback`)

      try {
        const mediaLabel = messageType === 'video' ? 'סרטון' : 'קובץ'
        await sendWhatsAppTextMessage(
          from,
          `קיבלנו ${mediaLabel} 📎\n\nבשביל דיווח תקלה, אנא שלחו תמונה או כתבו תיאור.\n\nרוצים להתחיל? סרקו את קוד ה-QR בבניין.`
        )
      } catch (sendError) {
        console.error(`⚠️ Failed to send ${messageType}-message guidance:`, sendError)
      }

      return NextResponse.json(
        {
          received: true,
          type: 'unsupported_media_type',
          mediaType,
        },
        { status: 200 }
      )
    }

    // If no text body and no valid media, ignore
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
            '❌ לא הצלחנו לזהות את הפרויקט.\n\nנסו שוב:\n1️⃣ סרקו את QR מחדש\n2️⃣ או כתבו את כתובת הבניין (רחוב ומספר)\n3️⃣ או צרו קשר למנהלת הבניין'
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
      // STEP 2.5: PENDING SELECTION HANDLING (user replies with number 1/2/3)
      const numericSelection = isNumericSelection(textBody)
      const pendingSelection = await getPendingSelection(from, supabaseAdmin)

      if (numericSelection && pendingSelection) {
        // User selected a valid number and pending selection exists
        console.log(`✅ User selected option: ${numericSelection}`)

        const candidates = pendingSelection.candidate_projects || []
        const selectedIndex = numericSelection - 1

        if (selectedIndex >= 0 && selectedIndex < candidates.length) {
          const selectedProject = candidates[selectedIndex]
          console.log('✅ Creating session for selected building:', selectedProject.name)

          const { data: createdSession, error: sessionCreateError } = await supabaseAdmin
            .from('sessions')
            .insert({
              phone_number: from,
              project_id: selectedProject.id,
              is_active: true,
              active_ticket_id: null,
              last_activity_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (sessionCreateError) {
            console.error('❌ Error creating session from selection:', sessionCreateError)
            return NextResponse.json(
              { error: 'Session creation failed' },
              { status: 500 }
            )
          }

          // Clear pending selection
          await clearPendingSelection(from, supabaseAdmin)

          // Send confirmation
          try {
            await sendWhatsAppTextMessage(
              from,
              `✅ בחרתם ${selectedProject.name}!\n\nעכשיו כתבו בקצרה את התקלה 📝\n\n💡 טיפ: אפשר גם לצרף תמונה של התקלה — זה יעזור לנו לטפל בה מהר יותר!`
            )
          } catch (sendError) {
            console.error('⚠️ Failed to send selection confirmation:', sendError)
          }

          return NextResponse.json(
            {
              received: true,
              type: 'selection_confirmed',
              from,
              projectId: selectedProject.id,
              sessionId: createdSession.id,
            },
            { status: 200 }
          )
        }
      }

      // INVALID NUMERIC SELECTION (number outside range while pending exists)
      if (numericSelection && pendingSelection) {
        console.log(`⚠️ Invalid selection (out of range): ${numericSelection}`)

        try {
          await sendWhatsAppTextMessage(
            from,
            `אנא השיבו רק עם מספר האפשרות המתאים: 1, 2 או 3.`
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send invalid-selection message:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'invalid_selection',
            from,
          },
          { status: 200 }
        )
      }

      // If there's a pending selection but message is NOT numeric, send reminder
      if (pendingSelection && !numericSelection) {
        console.log('⚠️ Pending selection exists but message is not numeric')

        try {
          await sendWhatsAppTextMessage(
            from,
            `⚠️ השיבו רק עם מספר האפשרות: 1, 2 או 3`
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send pending-reminder message:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'pending_reminder',
            from,
          },
          { status: 200 }
        )
      }

      // NO PENDING SELECTION: Do building search
      console.log('ℹ️ No active session and no pending selection. Attempting building search...')

      const searchResults = await searchProjectsByBuilding(textBody, supabaseAdmin)

      if (searchResults.length === 0) {
        // No matches found - send safe error message
        console.log('❌ No building matches found for search:', textBody)

        try {
          await sendWhatsAppTextMessage(
            from,
            'לא הצלחנו לזהות את הבניין.\n\n📍 כדי שנוכל לאתר אותו, כתבו את כתובת הבניין (רחוב ומספר)\n\nאו:\n1. סרקו את קוד ה-QR בבניין\n2. פנו למנהלת הבניין לקבלת קוד הגישה'
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

      // Multiple matches (2-3) - store pending selection and send numbered list
      console.log(`⚠️ Found ${searchResults.length} matching buildings`)

      // Create pending selection state
      const pendingCreated = await createPendingSelection(
        from,
        searchResults,
        supabaseAdmin
      )

      if (!pendingCreated) {
        console.error('⚠️ Failed to create pending selection, sending fallback message')

        try {
          await sendWhatsAppTextMessage(
            from,
            'תקלה טכנית. אנא סרקו את קוד ה-QR בבניין או פנו למנהלת הבניין.'
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send error message:', sendError)
        }

        return NextResponse.json(
          {
            received: true,
            type: 'search_error',
            from,
          },
          { status: 200 }
        )
      }

      // Build and send numbered list
      let matchList = 'מצאנו כמה בניינים תואמים:\n\n'
      searchResults.forEach((project: ProjectRow, index: number) => {
        const addressText = project.address ? ` (${project.address})` : ''
        matchList += `${index + 1}. ${project.name}${addressText}\n`
      })
      matchList +=
        '\n📌 להמשך, השיבו רק עם מספר האפשרות: 1, 2 או 3'

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
        is_active: true,
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
        `התקלה התקבלה בהצלחה.${buildingText}\nמספר הפנייה שלך: ${createdTicket.ticket_number}\n\n💡 טיפ: אפשר גם לשלוח תמונה של התקלה - זה יעזור לנו לטפל בה מהר יותר.\n\nנעדכן כשיהיה טיפול.\nלפתיחת תקלה חדשה נוספת, סרקו שוב את קוד ה-QR.`
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
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('WEBHOOK', 'WhatsApp webhook POST error', err, { requestId })
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      {
        error: 'Invalid payload',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}

