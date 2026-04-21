import { NextRequest, NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSingletonClientId } from '@/lib/singleton-client-server'
import {
  parseIncomingWhatsAppMessage,
  isAddressLikeText,
  extractWhatsAppPhoneNumberId,
} from '@/lib/whatsapp-parser'
import { webhookDedupeMessageId } from '@/lib/whatsapp-webhook-dedupe'
import { isUrgentAngryMessage } from '@/lib/whatsapp-intent'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp-send'
import { sendManagerSMS, sendWorkerSMS, getManagerPhoneFromEnv } from '@/lib/sms-send'
import {
  downloadWhatsAppMedia,
  uploadWhatsAppMediaToStorage,
  createAttachmentRecord,
} from '@/lib/whatsapp-media'
import { getLogger } from '@/lib/logging'
import { getPublicTicketsUrl } from '@/lib/public-app-url'
import { isWhatsAppTestSender, whatsappDbPhoneKey, displayReporterForExternalMessage } from '@/lib/whatsapp-test-phone'
import { queuePendingResidentApproval } from '@/lib/pending-resident-from-ticket'

// ARCHIVED: Old WhatsApp manager notification
// This module previously sent WhatsApp messages to project managers
// CURRENT STATUS: Using SMS for manager notifications (temporary, while awaiting WhatsApp template approval)

const VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN ||
  (() => {
    throw new Error('WHATSAPP_VERIFY_TOKEN not set')
  })()
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
async function searchProjectsByBuilding(
  searchText: string,
  supabaseAdmin: SupabaseClient,
  clientId: string
) {
  const trimmed = searchText.trim()

  // Require minimum 2 characters to search
  if (trimmed.length < 2) {
    return []
  }

  const lowerSearch = trimmed.toLowerCase()

  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, project_code, address')
    .eq('client_id', clientId)
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
  supabaseAdmin: SupabaseClient,
  clientId: string
) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  const { error } = await supabaseAdmin.from('pending_selections').insert({
    phone_number: phoneNumber,
    client_id: clientId,
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
async function getPendingSelection(
  phoneNumber: string,
  supabaseAdmin: SupabaseClient,
  clientId: string
) {
  const { data, error } = await supabaseAdmin
    .from('pending_selections')
    .select('id, candidate_projects, created_at, expires_at')
    .eq('phone_number', phoneNumber)
    .eq('client_id', clientId)
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
    await clearPendingSelection(phoneNumber, supabaseAdmin, clientId)
    return null
  }

  return data
}

// Clear pending selection for a phone number
async function clearPendingSelection(
  phoneNumber: string,
  supabaseAdmin: SupabaseClient,
  clientId: string
) {
  const { error } = await supabaseAdmin
    .from('pending_selections')
    .delete()
    .eq('phone_number', phoneNumber)
    .eq('client_id', clientId)

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

function logWhatsAppRuntimePath(
  tag: string,
  params: {
    textBody: string
    phone_number: string
    session: { project_id?: unknown; active_ticket_id?: unknown } | null | undefined
  }
) {
  const { textBody, phone_number, session } = params
  console.log(tag, {
    textBody,
    phone_number,
    session_exists: !!session,
    project_id: session && 'project_id' in session ? (session as { project_id?: unknown }).project_id : null,
    active_ticket_id:
      session && 'active_ticket_id' in session
        ? (session as { active_ticket_id?: unknown }).active_ticket_id
        : null,
  })
}

// Expire temporary WhatsApp session flow state if inactive
// Sessions without tickets expire after 20 minutes (incomplete flow)
// Sessions with active tickets expire after 30 minutes (follow-up context)
// This does NOT close actual tickets - only clears temporary session state
async function expireInactiveSessions(supabaseAdmin: SupabaseClient, clientId: string) {
  const now = new Date()
  
  // Threshold 1: Sessions without tickets (incomplete flow) - 20 minutes
  const incompleteThreshold = new Date(now.getTime() - 20 * 60 * 1000)
  
  // Threshold 2: Sessions with tickets (follow-up context) - 30 minutes
  const followUpThreshold = new Date(now.getTime() - 30 * 60 * 1000)

  try {
    // Expire incomplete sessions (no active_ticket_id) after 20 minutes
    const { error: incompleteError } = await supabaseAdmin
      .from('sessions')
      .update({
        is_active: false,
        updated_at: now.toISOString(),
      })
      .eq('client_id', clientId)
      .eq('is_active', true)
      .is('active_ticket_id', null)
      .lt('last_activity_at', incompleteThreshold.toISOString())

    if (incompleteError) {
      console.error('⚠️ Error expiring incomplete sessions:', incompleteError)
    } else {
      console.log('✅ Expired incomplete WhatsApp sessions (no ticket, 20min+ inactive)')
    }

    // Expire follow-up sessions (with active_ticket_id) after 30 minutes
    const { error: followUpError } = await supabaseAdmin
      .from('sessions')
      .update({
        is_active: false,
        active_ticket_id: null,
        updated_at: now.toISOString(),
      })
      .eq('client_id', clientId)
      .eq('is_active', true)
      .not('active_ticket_id', 'is', null)
      .lt('last_activity_at', followUpThreshold.toISOString())

    if (followUpError) {
      console.error('⚠️ Error expiring follow-up sessions:', followUpError)
    } else {
      console.log('✅ Expired follow-up WhatsApp sessions (with ticket, 30min+ inactive)')
    }
  } catch (error) {
    console.error('⚠️ Unexpected error in expireInactiveSessions:', error)
  }
}

type SessionRow = {
  id: string
  phone_number: string
  project_id: string | null
  active_ticket_id: string | null
  is_active: boolean
  pending_whatsapp_media_id?: string | null
  pending_apartment_detail?: string | null
}

async function getActiveSession(
  from: string,
  supabaseAdmin: SupabaseClient,
  clientId: string
): Promise<SessionRow | null> {
  // Core columns only — migrations 013/014 add optional columns; selecting missing columns returns null session and breaks the flow.
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('id, phone_number, project_id, active_ticket_id, is_active')
    .eq('phone_number', from)
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('❌ Error fetching active session:', error)
    return null
  }

  return (data as SessionRow | null) || null
}

async function resetSessionCompletely(
  from: string,
  supabaseAdmin: SupabaseClient,
  clientId: string,
  reason: string
) {
  const nowIso = new Date().toISOString()
  console.log('🧼 SESSION_RESET: Clearing WhatsApp session state', { from, reason })

  // 1) Clear any pending multi-match selection state (prevents being stuck on "reply 1/2/3")
  await clearPendingSelection(from, supabaseAdmin, clientId)

  // 2) Deactivate all active sessions for this phone (prevents old project/ticket context leaking)
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({
      is_active: false,
      active_ticket_id: null,
      last_activity_at: nowIso,
      updated_at: nowIso,
    })
    .eq('phone_number', from)
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (error) {
    console.error('⚠️ SESSION_RESET_FAILED: Could not deactivate sessions', { from, reason, error })
  }
}

async function getTicketStatus(ticketId: string, supabaseAdmin: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .maybeSingle()

  if (error) {
    console.error('⚠️ Failed to fetch ticket status:', { ticketId, error })
    return null
  }

  return (data as { status?: string } | null)?.status || null
}

async function findRecentTicketForPhone(
  from: string,
  supabaseAdmin: SupabaseClient,
  clientId: string
): Promise<{ id: string; status: string; created_at: string } | null> {
  // Product rule: sessions reset after ticket creation, but user may send an image immediately after.
  // So we allow attaching an image to the most recent ticket for this phone within a short window.
  const windowMinutes = 10
  const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('id, status, created_at')
    .eq('reporter_phone', from)
    .eq('client_id', clientId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('⚠️ Failed to find recent ticket for phone:', { from, error })
    return null
  }

  if (!data?.id || !data?.created_at || !data?.status) return null
  return data as { id: string; status: string; created_at: string }
}

/** If the user sent an image before the first text in this session, attach it to the new ticket. */
async function attachPendingWhatsAppImageToTicketIfAny(
  from: string,
  clientId: string,
  ticketId: string,
  supabaseAdmin: SupabaseClient
): Promise<boolean> {
  const { data: openSession, error } = await supabaseAdmin
    .from('sessions')
    .select('id, pending_whatsapp_media_id')
    .eq('phone_number', from)
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    const msg = String((error as { message?: string }).message || '')
    if (msg.includes('pending_whatsapp_media_id') || (error as { code?: string }).code === '42703') {
      return false
    }
    console.error('⚠️ pending image: could not load session', { from, error })
    return false
  }

  const pendingId = (openSession as { pending_whatsapp_media_id?: string | null } | null)
    ?.pending_whatsapp_media_id
  const sessionId = (openSession as { id?: string } | null)?.id
  if (!pendingId || !sessionId) return false

  const { error: clearPendingErr } = await supabaseAdmin
    .from('sessions')
    .update({
      pending_whatsapp_media_id: null,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (clearPendingErr) {
    const m = String((clearPendingErr as { message?: string }).message || '')
    if (m.includes('pending_whatsapp_media_id') || (clearPendingErr as { code?: string }).code === '42703') {
      await supabaseAdmin
        .from('sessions')
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    }
  }

  const mediaData = await downloadWhatsAppMedia(pendingId, 'image')
  if (!mediaData) {
    console.error('⚠️ pending image: download failed', { pendingId, ticketId })
    return false
  }

  const uploadResult = await uploadWhatsAppMediaToStorage(
    ticketId,
    mediaData.buffer,
    mediaData.fileName,
    mediaData.mimeType
  )
  if (!uploadResult) {
    console.error('⚠️ pending image: storage upload failed', { ticketId })
    return false
  }

  const ok = await createAttachmentRecord(
    supabaseAdmin,
    ticketId,
    mediaData.fileName,
    uploadResult.filePath,
    uploadResult.fileSize,
    mediaData.mimeType,
    pendingId,
    'whatsapp_image'
  )
  return !!ok
}

async function logIncomingFreeTextToTicket(
  ticketId: string,
  from: string,
  textBody: string,
  supabaseAdmin: SupabaseClient
) {
  try {
    const { error } = await supabaseAdmin.from('ticket_logs').insert({
      ticket_id: ticketId,
      action_type: 'USER_MESSAGE',
      notes: textBody,
      created_by: 'whatsapp_user',
      meta: { phone: from },
    })

    if (error) {
      console.error('⚠️ Failed to insert USER_MESSAGE log (non-blocking):', { ticketId, error })
    }
  } catch (e) {
    console.error('⚠️ Unexpected error inserting USER_MESSAGE log (non-blocking):', e)
  }
}

/** Same reporter + project, non-closed ticket opened within the last N minutes (duplicate follow-up guard). */
async function findOpenTicketForReporterInWindow(
  from: string,
  clientId: string,
  projectId: string,
  windowMinutes: number,
  supabaseAdmin: SupabaseClient
): Promise<{ id: string; ticket_number: number; description: string | null; status: string } | null> {
  const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_number, description, status')
    .eq('reporter_phone', from)
    .eq('client_id', clientId)
    .eq('project_id', projectId)
    .neq('status', 'CLOSED')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data as { id: string; ticket_number: number; description: string | null; status: string }
}

async function appendFollowUpToOpenTicket(
  ticketId: string,
  text: string,
  from: string,
  supabaseAdmin: SupabaseClient
) {
  const { data: row } = await supabaseAdmin.from('tickets').select('description').eq('id', ticketId).maybeSingle()
  const prev = (row as { description?: string | null } | null)?.description
  const next = prev && String(prev).trim() ? `${String(prev).trim()}\n${text}` : text
  await supabaseAdmin.from('tickets').update({ description: next }).eq('id', ticketId)
  await logIncomingFreeTextToTicket(ticketId, from, text, supabaseAdmin)
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

    const webhookClientId = await getSingletonClientId(supabaseAdmin)

    const body = await req.json()

    console.log('✅ WEBHOOK DB VERSION ACTIVE')
    console.log('📩 WhatsApp webhook payload:', JSON.stringify(body, null, 2))
    logger.debug('WEBHOOK', 'Full webhook payload', { requestId, payload: body })

    const parsedMessage = parseIncomingWhatsAppMessage(body)

    if (!parsedMessage) {
      console.log('ℹ️ No incoming user message in payload')
      logger.debug('WEBHOOK', 'No incoming message in payload', { requestId })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const dedupeMessageId = webhookDedupeMessageId(parsedMessage)
    const { error: dupErr } = await supabaseAdmin.from('processed_webhooks').insert({
      message_id: dedupeMessageId,
    })
    if (dupErr && dupErr.code === '23505') {
      console.log('⚠️ Duplicate webhook, skipping:', dedupeMessageId)
      return NextResponse.json({ received: true }, { status: 200 })
    }
    if (dupErr) {
      console.error('⚠️ processed_webhooks insert (non-blocking):', dupErr)
    }

    const phoneNumberId = extractWhatsAppPhoneNumberId(body)
    if (!phoneNumberId) {
      console.error('❌ Missing WhatsApp phone_number_id in webhook metadata')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const { data: waClient, error: waClientErr } = await supabaseAdmin
      .from('clients')
      .select('id, name, sms_sender_name, whatsapp_phone_number_id, whatsapp_access_token, manager_phone')
      .eq('id', webhookClientId)
      .maybeSingle()

    if (waClientErr) {
      console.error('❌ Failed to load client WhatsApp credentials:', waClientErr)
      return NextResponse.json({ received: true }, { status: 200 })
    }
    if (
      waClient &&
      (waClient as { whatsapp_phone_number_id?: string | null }).whatsapp_phone_number_id &&
      (waClient as { whatsapp_phone_number_id?: string | null }).whatsapp_phone_number_id !== phoneNumberId
    ) {
      console.error('❌ WhatsApp phone_number_id does not match BAMAKOR client configuration', {
        incomingPhoneNumberId: phoneNumberId,
        expectedPhoneNumberId: (waClient as { whatsapp_phone_number_id?: string | null }).whatsapp_phone_number_id,
      })
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const residentWhatsAppCreds = {
      phoneNumberId: (waClient as { whatsapp_phone_number_id?: string | null } | null)
        ?.whatsapp_phone_number_id || undefined,
      accessToken: (waClient as { whatsapp_access_token?: string | null } | null)
        ?.whatsapp_access_token || undefined,
    }

    const clientName = (waClient as { name?: string | null } | null)?.name || 'המערכת'
    const smsSenderName = (waClient as { sms_sender_name?: string | null } | null)?.sms_sender_name || 'במקור'
    const clientManagerPhone = (waClient as { manager_phone?: string | null } | null)?.manager_phone || null

    // Expire temporary WhatsApp session state if inactive (scoped to this tenant)
    await expireInactiveSessions(supabaseAdmin, webhookClientId)

    const { from: waFrom, messageType, textBody, mediaId, mediaType } = parsedMessage
    const waRecipient = waFrom
    const from = whatsappDbPhoneKey(waFrom)
    const isTestWhatsAppSender = isWhatsAppTestSender(waFrom)

    console.log('📞 From:', isTestWhatsAppSender ? '(מספר בדיקות — לא נשמר במערכת)' : waRecipient)
    console.log('🧩 Message Type:', messageType)
    console.log('💬 Message body:', textBody)
    console.log('📎 Media ID:', mediaId)
    console.log('📎 Media Type:', mediaType)
    
    logger.info('WEBHOOK', 'Parsed incoming message', {
      requestId,
      from: isTestWhatsAppSender ? '(test)' : waRecipient,
      messageType,
      hasText: !!textBody,
      hasMedia: !!mediaId,
    })

    /** מוצג כשאין טקסט תקין — שתי הזרימות: QR או חיפוש בניין ואז תיאור, ואז אופציה לתמונה */
    const flowHelpMessage =
      'לדיווח תקלה: כתבו בטקסט את תיאור הבעיה, או סרקו את קוד ה־QR בבניין.\n' +
      'אחרי שנפתחה פנייה – אפשר לשלוח גם תמונה של התקלה.'

    if (
      messageType === 'location' ||
      messageType === 'contacts' ||
      messageType === 'sticker' ||
      messageType === 'audio' ||
      messageType === 'video' ||
      messageType === 'document'
    ) {
      try {
        await sendWhatsAppTextMessage(waRecipient, flowHelpMessage, residentWhatsAppCreds)
      } catch (sendError) {
        console.error('⚠️ Failed to send non-text flow guidance:', sendError)
      }
      return NextResponse.json({ received: true, type: 'non_text_guidance' }, { status: 200 })
    }

    // HANDLE IMAGE MESSAGES
    if (messageType === 'image' && mediaId && mediaType === 'image') {
      console.log('🖼️ Image message received - downloading and attaching to ticket')

      // Check if user has an active session/ticket context
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('id, phone_number, project_id, active_ticket_id, is_active')
        .eq('phone_number', from)
        .eq('client_id', webhookClientId)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sessionError) {
        console.error('❌ Error fetching session for image attachment:', sessionError)
      }

      // Case A: Active ticket exists - attach image to it
      if (session?.active_ticket_id) {
        const ticketId = session.active_ticket_id
        let failureReason = ''

        console.log(`📍 Active ticket found for ${from} - attaching image to ticket: ${ticketId}`)

        // Step 1: Download media from WhatsApp
        console.log(`⏳ PIPELINE_STEP: 1/4 Downloading image from WhatsApp (mediaId: ${mediaId})`)
        const mediaData = await downloadWhatsAppMedia(mediaId, 'image')

        if (!mediaData) {
          failureReason = 'DOWNLOAD_FAILED'
          console.error(`❌ PIPELINE_FAILURE: Step 1 DOWNLOAD - Could not download media from WhatsApp`, {
            failureReason,
            mediaId,
            ticketId,
          })
          // Fall through to fallback message (ticket already exists, preserve it)
        } else {
          console.log(`✅ PIPELINE_SUCCESS: Step 1 DOWNLOAD - Downloaded ${mediaData.fileName} (${mediaData.mimeType}, ${mediaData.buffer.length} bytes)`)

          // Step 2: Upload to Supabase Storage
          console.log(`⏳ PIPELINE_STEP: 2/4 Uploading to Supabase Storage`)
          const uploadResult = await uploadWhatsAppMediaToStorage(
            ticketId,
            mediaData.buffer,
            mediaData.fileName,
            mediaData.mimeType
          )

          if (uploadResult) {
            console.log(`✅ PIPELINE_SUCCESS: Step 2 UPLOAD - File stored at ${uploadResult.filePath}`)

            // Step 3: Create database record
            console.log(`⏳ PIPELINE_STEP: 3/4 Creating attachment database record`)
            const attachmentCreated = await createAttachmentRecord(
              supabaseAdmin,
              ticketId,
              mediaData.fileName,
              uploadResult.filePath,
              uploadResult.fileSize,
              mediaData.mimeType,
              mediaId,
              'whatsapp_image'
            )

            if (attachmentCreated) {
              console.log(`✅ PIPELINE_SUCCESS: Step 3 DB_INSERT - Attachment record created`)

              // Step 4: Send confirmation message
              console.log(`⏳ PIPELINE_STEP: 4/4 Sending WhatsApp confirmation`)
              try {
                await sendWhatsAppTextMessage(
                  waRecipient,
                  '✅ התמונה התקבלה בהצלחה וצורפה לתקלה. צוות הטכנאים יטפל בבקשתך בהקדם.',
                  residentWhatsAppCreds
                )
                console.log(`✅ PIPELINE_SUCCESS: Step 4 USER_MSG - Confirmation message sent`)
              } catch (sendError) {
                console.error('⚠️ PIPELINE_WARNING: Step 4 failed to send confirmation (attachment was successful)', {
                  error: sendError,
                  ticketId,
                })
              }

              // Product rule: after image confirmation, reset to default state
              await resetSessionCompletely(from, supabaseAdmin, webhookClientId, 'image_processed_success')
              return NextResponse.json(
                {
                  received: true,
                  type: 'image_attached_to_existing_ticket',
                  ticketId,
                  status: 'SUCCESS',
                },
                { status: 200 }
              )
            } else {
              failureReason = 'DB_INSERT_FAILED'
              console.error(`❌ PIPELINE_FAILURE: Step 3 DB_INSERT - Attachment record creation failed`, {
                failureReason,
                ticketId,
                fileName: mediaData.fileName,
              })
            }
          } else {
            failureReason = 'STORAGE_UPLOAD_FAILED'
            console.error(`❌ PIPELINE_FAILURE: Step 2 UPLOAD - Supabase Storage upload failed`, {
              failureReason,
              ticketId,
              fileName: mediaData.fileName,
            })
          }
        }

        // Fallback: Image download/upload failed but ticket exists, preserve it
        console.log(`📤 PIPELINE_FALLBACK: Sending user message - attachment failed but ticket preserved`, {
          failureReason,
          ticketId,
        })
        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            '⚠️ לא הצלחנו להוסיף את התמונה, אך התקלה שלך תקבלה.\n\nנעדכן כשיהיה טיפול.',
            residentWhatsAppCreds
          )
        } catch (sendError) {
          console.error('⚠️ PIPELINE_WARNING: Failed to send fallback message', {
            error: sendError,
            ticketId,
          })
        }

        // Product rule: reset to default state after image attempt
        await resetSessionCompletely(from, supabaseAdmin, webhookClientId, 'image_processed_failure')
        return NextResponse.json(
          {
            received: true,
            type: 'image_failed_but_ticket_ok',
            ticketId,
            status: 'PARTIAL_FAILURE',
            failureReason,
          },
          { status: 200 }
        )
      }

      // Case A5: Building known (session) but ticket not created yet — keep image until first text opens ticket
      if (session?.project_id && !session.active_ticket_id && session.id) {
        console.log(`📍 Open session (no ticket row yet) — stashing image for first text: ${session.id}`)
        const { error: stashErr } = await supabaseAdmin
          .from('sessions')
          .update({
            pending_whatsapp_media_id: mediaId,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        if (stashErr) {
          console.error('❌ Failed to stash pending WhatsApp image on session:', stashErr)
        } else {
          try {
            await sendWhatsAppTextMessage(
              waRecipient,
              '🖼️ קיבלנו את התמונה!\n\nכדי לצרף אותה לתקלה, כתבו עכשיו בקצרה את תיאור התקלה בטקסט.',
              residentWhatsAppCreds
            )
          } catch (sendError) {
            console.error('⚠️ Failed to send image-before-text guidance:', sendError)
          }
        }

        return NextResponse.json(
          { received: true, type: 'image_queued_before_description', sessionId: session.id },
          { status: 200 }
        )
      }

      // Case B: No session/ticket context - attach to most recent ticket for this phone (short window)
      const recentTicket = await findRecentTicketForPhone(from, supabaseAdmin, webhookClientId)
      if (recentTicket && recentTicket.status !== 'CLOSED') {
        const ticketId = recentTicket.id
        let failureReason = ''

        console.log(`📍 No active session. Found recent ticket for ${from} - attaching image to ticket: ${ticketId}`)

        console.log(`⏳ PIPELINE_STEP: 1/4 Downloading image from WhatsApp (mediaId: ${mediaId})`)
        const mediaData = await downloadWhatsAppMedia(mediaId, 'image')

        if (!mediaData) {
          failureReason = 'DOWNLOAD_FAILED'
        } else {
          console.log(`⏳ PIPELINE_STEP: 2/4 Uploading to Supabase Storage`)
          const uploadResult = await uploadWhatsAppMediaToStorage(
            ticketId,
            mediaData.buffer,
            mediaData.fileName,
            mediaData.mimeType
          )

          if (uploadResult) {
            console.log(`⏳ PIPELINE_STEP: 3/4 Creating attachment database record`)
            const attachmentCreated = await createAttachmentRecord(
              supabaseAdmin,
              ticketId,
              mediaData.fileName,
              uploadResult.filePath,
              uploadResult.fileSize,
              mediaData.mimeType,
              mediaId,
              'whatsapp_image'
            )

            if (attachmentCreated) {
              console.log(`⏳ PIPELINE_STEP: 4/4 Sending WhatsApp confirmation`)
              try {
                await sendWhatsAppTextMessage(
                  waRecipient,
                  '✅ התמונה התקבלה בהצלחה וצורפה לתקלה. צוות הטכנאים יטפל בבקשתך בהקדם.',
                  residentWhatsAppCreds
                )
              } catch (sendError) {
                console.error('⚠️ PIPELINE_WARNING: Failed to send confirmation (recent ticket attach)', sendError)
              }

              await resetSessionCompletely(from, supabaseAdmin, webhookClientId, 'recent_ticket_image_processed_success')

              return NextResponse.json(
                { received: true, type: 'image_attached_to_recent_ticket', ticketId, status: 'SUCCESS' },
                { status: 200 }
              )
            } else {
              failureReason = 'DB_INSERT_FAILED'
            }
          } else {
            failureReason = 'STORAGE_UPLOAD_FAILED'
          }
        }

        console.log(`📤 PIPELINE_FALLBACK: recent-ticket attach failed`, { failureReason, ticketId })
        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            '⚠️ לא הצלחנו להוסיף את התמונה, אך התקלה שלך התקבלה.\n\nאם תרצו, נסו לשלוח את התמונה שוב או פנו למנהלת הבניין.',
            residentWhatsAppCreds
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send recent-ticket fallback message:', sendError)
        }

        await resetSessionCompletely(from, supabaseAdmin, webhookClientId, 'recent_ticket_image_processed_failure')

        return NextResponse.json(
          { received: true, type: 'image_failed_recent_ticket', ticketId, status: 'PARTIAL_FAILURE', failureReason },
          { status: 200 }
        )
      }

      // Case C: No context and no recent ticket - guide user to start flow
      console.log('📍 Image received but no session context and no recent ticket - guiding user to start')

      try {
        await sendWhatsAppTextMessage(waRecipient, flowHelpMessage, residentWhatsAppCreds)
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

    if (!textBody) {
      if (messageType === 'reaction') {
        try {
          await sendWhatsAppTextMessage(waRecipient, flowHelpMessage, residentWhatsAppCreds)
        } catch (sendError) {
          console.error('⚠️ Failed to send reaction reply:', sendError)
        }
        return NextResponse.json({ received: true, type: 'reaction_received' }, { status: 200 })
      }
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Product rule: WhatsApp session is single-purpose and short-lived.
    // Free-text should never be auto-logged into a previous ticket; after reset, it restarts project search flow.
    // STEP 1: START_<PROJECT_CODE> or START_<PROJECT_CODE>_<BUILDING>
    if (textBody.toUpperCase().startsWith('START_')) {
      const parsedStart = parseStartCode(textBody)

      if (!parsedStart) {
        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            'פורמט קוד ה-QR לא תקין. אנא סרקו שוב את הקוד או פנו למנהלת הבניין.',
            residentWhatsAppCreds
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
        .eq('client_id', webhookClientId)
        .maybeSingle()

      if (projectError) {
        console.error('❌ Error fetching project:', projectError)
        return NextResponse.json({ error: 'Project lookup failed' }, { status: 500 })
      }

      if (!project) {
        console.log('⚠️ No project found for code:', projectCode)

        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            '❌ לא הצלחנו לזהות את הפרויקט.\n\nנסו שוב:\n1️⃣ סרקו את QR מחדש\n2️⃣ או כתבו את כתובת הבניין (רחוב ומספר)\n3️⃣ או צרו קשר למנהלת הבניין',
            residentWhatsAppCreds
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
        .eq('client_id', webhookClientId)
        .eq('is_active', true)

      if (deactivateError) {
        console.error('❌ Error deactivating old sessions:', deactivateError)
        return NextResponse.json({ error: 'Session cleanup failed' }, { status: 500 })
      }

      const { data: createdSession, error: sessionInsertError } = await supabaseAdmin
        .from('sessions')
        .insert({
          phone_number: from,
          client_id: webhookClientId,
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
          waRecipient,
          `ברוכים הבאים! פתחנו תקלה חדשה עבורכם ב${project.name}${buildingText}. כתבו בקצרה את הבעיה 📝`,
          residentWhatsAppCreds
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

    let ticketPriority: 'HIGH' | 'MEDIUM' = 'MEDIUM'

    // סשן פעיל = אחרי סריקת QR או אחרי בחירת בניין בחיפוש (1/2/3 / התאמה אוטומטית)
    let session = await getActiveSession(from, supabaseAdmin, webhookClientId)

    if (!session) {
      logWhatsAppRuntimePath('NO_SESSION_PATH_ENTERED', {
        textBody,
        phone_number: from,
        session: null,
      })

      // STEP 2.5: PENDING SELECTION HANDLING (user replies with number 1/2/3)
      const numericSelection = isNumericSelection(textBody)
      let pendingSelection = await getPendingSelection(from, supabaseAdmin, webhookClientId)

      if (numericSelection && pendingSelection) {
        // User selected a valid number and pending selection exists
        console.log(`✅ User selected option: ${numericSelection}`)

        const candidates = pendingSelection.candidate_projects || []
        const selectedIndex = numericSelection - 1

        if (selectedIndex >= 0 && selectedIndex < candidates.length) {
          const selectedProject = candidates[selectedIndex]
          console.log('✅ Creating session for selected building:', selectedProject.name)

          // Ensure only one active session per phone_number
          await supabaseAdmin
            .from('sessions')
            .update({ is_active: false, active_ticket_id: null, last_activity_at: new Date().toISOString() })
            .eq('phone_number', from)
            .eq('client_id', webhookClientId)
            .eq('is_active', true)

          const { data: createdSession, error: sessionCreateError } = await supabaseAdmin
            .from('sessions')
            .insert({
              phone_number: from,
              client_id: webhookClientId,
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
          await clearPendingSelection(from, supabaseAdmin, webhookClientId)

          // Send confirmation
          try {
            await sendWhatsAppTextMessage(
              waRecipient,
              `ברוכים הבאים! פתחנו תקלה חדשה עבורכם ב${selectedProject.name}. כתבו בקצרה את הבעיה 📝`,
              residentWhatsAppCreds
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
            waRecipient,
            `אנא השיבו רק עם מספר האפשרות המתאים: 1, 2 או 3.`,
            residentWhatsAppCreds
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

      // Pending selection + non-numeric: either refine search (address-like) or remind to pick 1/2/3
      if (pendingSelection && !numericSelection) {
        if (isAddressLikeText(textBody)) {
          console.log('ℹ️ Pending selection cleared — user sent a new address-like query; re-searching')
          await clearPendingSelection(from, supabaseAdmin, webhookClientId)
          pendingSelection = null
        } else {
          console.log('⚠️ Pending selection exists but message is not numeric')

          try {
            await sendWhatsAppTextMessage(
              waRecipient,
              `⚠️ השיבו רק עם מספר האפשרות: 1, 2 או 3`,
              residentWhatsAppCreds
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
      }

      const addressLike = isAddressLikeText(textBody)
      logWhatsAppRuntimePath('TEXT_ADDRESS_LIKE_RESULT', {
        textBody,
        phone_number: from,
        session: null,
      })
      console.log('TEXT_ADDRESS_LIKE_RESULT_VALUE', { textBody, phone_number: from, addressLike })

      if (!addressLike) {
        console.log('ℹ️ Free-text does not look address-like; sending guidance instead of searching:', textBody)

        const fallbackMessage =
          'לא הצלחנו לזהות את הבניין.\n\n📍 כדי שנוכל לאתר אותו, כתבו את כתובת הבניין (רחוב ומספר)\n\nאו:\n1. סרקו את קוד ה-QR בבניין\n2. פנו למנהלת הבניין לקבלת קוד הגישה'

        try {
          await sendWhatsAppTextMessage(waRecipient, fallbackMessage, residentWhatsAppCreds)
        } catch (sendError) {
          console.error('⚠️ Failed to send no-match message:', sendError)
        }

        logWhatsAppRuntimePath('GUIDANCE_FALLBACK_RETURNED', {
          textBody,
          phone_number: from,
          session: null,
        })

        return NextResponse.json(
          {
            received: true,
            type: 'search_no_match',
            from,
            reason: 'text_not_address_like',
          },
          { status: 200 }
        )
      }

      console.log('ℹ️ Address-like text detected; attempting building search...')

      logWhatsAppRuntimePath('SEARCH_PROJECTS_CALLED', {
        textBody,
        phone_number: from,
        session: null,
      })

      const searchResults = await searchProjectsByBuilding(textBody, supabaseAdmin, webhookClientId)

      if (searchResults.length === 0) {
        // No matches found - send safe error message
        console.log('❌ No building matches found for search:', textBody)

        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            'לא הצלחנו לזהות את הבניין.\n\n📍 כדי שנוכל לאתר אותו, כתבו את כתובת הבניין (רחוב ומספר)\n\nאו:\n1. סרקו את קוד ה-QR בבניין\n2. פנו למנהלת הבניין לקבלת קוד הגישה',
            residentWhatsAppCreds
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

        // Ensure only one active session per phone_number
        await supabaseAdmin
          .from('sessions')
          .update({ is_active: false, active_ticket_id: null, last_activity_at: new Date().toISOString() })
          .eq('phone_number', from)
          .eq('client_id', webhookClientId)
          .eq('is_active', true)

        const { data: createdSession, error: sessionCreateError } = await supabaseAdmin
          .from('sessions')
          .insert({
            phone_number: from,
            client_id: webhookClientId,
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
            waRecipient,
            `ברוכים הבאים! פתחנו תקלה חדשה עבורכם ב${matchedProject.name}. כתבו בקצרה את הבעיה 📝`,
            residentWhatsAppCreds
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
        supabaseAdmin,
        webhookClientId
      )

      if (!pendingCreated) {
        console.error('⚠️ Failed to create pending selection, sending fallback message')

        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            'תקלה טכנית. אנא סרקו את קוד ה-QR בבניין או פנו למנהלת הבניין.',
            residentWhatsAppCreds
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
        await sendWhatsAppTextMessage(waRecipient, matchList, residentWhatsAppCreds)
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

    if (isUrgentAngryMessage(textBody)) {
      ticketPriority = 'HIGH'
    }

    logWhatsAppRuntimePath('TICKET_CREATE_PATH_ENTERED', {
      textBody,
      phone_number: from,
      session,
    })

    // Product rule: never keep active_ticket_id for text follow-ups.
    // Session is only used to bridge: (project identified) -> (ticket description) -> ticket created.

    if (session.project_id) {
      const dupTicket = await findOpenTicketForReporterInWindow(
        from,
        webhookClientId,
        session.project_id,
        5,
        supabaseAdmin
      )
      if (dupTicket) {
        await appendFollowUpToOpenTicket(dupTicket.id, textBody, from, supabaseAdmin)
        await supabaseAdmin
          .from('sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', session.id)
        try {
          await sendWhatsAppTextMessage(
            waRecipient,
            `קיבלנו את העדכון והוספנו לפנייה #${dupTicket.ticket_number} ✅`,
            residentWhatsAppCreds
          )
        } catch (sendError) {
          console.error('⚠️ Failed to send duplicate-follow-up reply:', sendError)
        }
        return NextResponse.json(
          {
            received: true,
            type: 'ticket_follow_up_appended',
            ticketId: dupTicket.id,
            ticketNumber: dupTicket.ticket_number,
          },
          { status: 200 }
        )
      }
    }

    const { data: existingProject, error: existingProjectError } = await supabaseAdmin
      .from('projects')
      .select('project_code, qr_identifier')
      .eq('id', session.project_id)
      .eq('client_id', webhookClientId)
      .maybeSingle()

    if (existingProjectError) {
      console.error('⚠️ Failed to fetch project for building extraction:', existingProjectError)
    }

    let buildingNumber: string | null = null

    if (existingProject?.qr_identifier) {
      const parsedStart = parseStartCode(existingProject.qr_identifier)
      buildingNumber = parsedStart?.buildingNumber || null
    }

    const ticketDescription = textBody

    const { data: createdTicket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        client_id: webhookClientId,
        project_id: session.project_id,
        reporter_phone: from,
        description: ticketDescription,
        status: 'NEW',
        priority: ticketPriority,
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

    const pendingImageAttached = await attachPendingWhatsAppImageToTicketIfAny(
      from,
      webhookClientId,
      createdTicket.id,
      supabaseAdmin
    )
    if (pendingImageAttached) {
      console.log('✅ Pending WhatsApp image attached to new ticket', { ticketId: createdTicket.id })
    }

    const pendingForApproval =
      !!session.project_id &&
      (await queuePendingResidentApproval({
        supabase: supabaseAdmin,
        clientId: webhookClientId,
        projectId: session.project_id as string,
        ticketId: createdTicket.id,
        waFrom: waRecipient,
      }))

    // Immediately reset session after ticket creation confirmation is sent (single-purpose session).

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
        .select('name, manager_phone, assigned_worker_id')
        .eq('id', session.project_id)
        .eq('client_id', webhookClientId)
        .single()

      if (projectNotificationError) {
        console.error('⚠️ Failed to fetch project manager phone:', projectNotificationError)
      } else if (projectForNotification) {
        const buildingLine = buildingNumber ? `בניין: ${buildingNumber}\n` : ''
        const smsMessage = `נפתחה תקלה חדשה\nפרויקט: ${projectForNotification.name}\n${buildingLine}תקלה: #${createdTicket.ticket_number}\nתיאור: ${ticketDescription || 'ללא פירוט'}\nמדווח: ${displayReporterForExternalMessage(waRecipient)}\nכניסה למערכת:\n${getPublicTicketsUrl()}\n${clientName}`

        const managerDestination = clientManagerPhone || projectForNotification.manager_phone || getManagerPhoneFromEnv()

        if (managerDestination) {
          console.log('📱 NOTIFICATION_CHANNEL: SMS (new ticket) → manager')
          const smsSent = await sendManagerSMS(managerDestination, smsMessage, smsSenderName)
          if (smsSent) {
            console.log('✅ manager_sms_sent: Manager notification sent successfully via SMS')
          } else {
            console.error('❌ manager_sms_failed: Failed to send SMS to manager')
          }
        }

        if (projectForNotification.assigned_worker_id) {
          const { data: workerRow } = await supabaseAdmin
            .from('workers')
            .select('phone, full_name')
            .eq('id', projectForNotification.assigned_worker_id)
            .eq('client_id', webhookClientId)
            .maybeSingle()

          if (workerRow?.phone) {
            const workerMsg = `תקלה חדשה ב${projectForNotification.name}\n#${createdTicket.ticket_number}\n${ticketDescription || 'ללא פירוט'}\nמדווח: ${displayReporterForExternalMessage(waRecipient)}\n${getPublicTicketsUrl()}\n${clientName}`
            console.log('📱 NOTIFICATION_CHANNEL: SMS (new ticket) → assigned worker')
            const wOk = await sendWorkerSMS(workerRow.phone, workerMsg, smsSenderName)
            if (wOk) {
              console.log('✅ worker_sms_sent: Assigned worker notified')
            } else {
              console.error('❌ worker_sms_failed')
            }
          }
        }
      }
    } catch (notifyManagerError) {
      console.error('⚠️ manager_notification_failed: Error notifying manager:', notifyManagerError)
    }

    try {
      const buildingText = buildingNumber ? `\nבניין: ${buildingNumber}` : ''

      const pendingNote = pendingForApproval
        ? '\n\nℹ️ מספר הטלפון שלכם עדיין לא מופיע ברשימת הדיירים של הבניין במערכת — הבקשה נשמרה לאישור המנהלת (שרה). אחרי האישור תופיעו ברשימה.'
        : ''

      await sendWhatsAppTextMessage(
        waRecipient,
        `התקלה התקבלה בהצלחה.${buildingText}\nמספר הפנייה שלך: ${createdTicket.ticket_number}\n\n💡 אפשר גם לשלוח תמונה של התקלה — זה יעזור לנו לטפל בה מהר יותר.\n\nנעדכן כשיהיה טיפול.\nלפתיחת תקלה נוספת: סרקו שוב את קוד ה־QR בבניין או כתבו רחוב ומספר בניין.${pendingNote}`,
        residentWhatsAppCreds
      )
    } catch (sendError) {
      console.error('⚠️ Failed to send ticket-created reply:', sendError)
    }

    // Product rule: if no image is sent, session must reset after ticket creation confirmation.
    // If an image is sent right after, it will attach via recent-ticket lookup (short window).
    await resetSessionCompletely(from, supabaseAdmin, webhookClientId, 'ticket_created_text_flow_reset')

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

