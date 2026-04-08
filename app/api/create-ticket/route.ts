import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function parseStartCode(message: string) {
  const match = message.trim().toUpperCase().match(/^START_(BMK\d+)(?:_(.+))?$/i)

  if (!match) return null

  return {
    projectCode: match[1],
    buildingNumber: match[2] ? match[2].trim() : null,
  }
}

async function uploadAttachments(
  supabaseAdmin: any,
  ticketId: string,
  files: File[]
): Promise<{ success: number; failed: number; warning?: string }> {
  let successCount = 0
  let failCount = 0

  for (const file of files) {
    try {
      // Generate unique file path
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(7)
      const extension = file.name.split('.').pop()
      const filePath = `${ticketId}/${timestamp}-${randomStr}.${extension}`

      // Upload to Supabase Storage
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('ticket-attachments')
        .upload(filePath, uint8Array, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error(`❌ Failed to upload file ${file.name}:`, uploadError)
        failCount++
        continue
      }

      // Create attachment record in database
      const { error: dbError } = await supabaseAdmin
        .from('ticket_attachments')
        .insert({
          ticket_id: ticketId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        })

      if (dbError) {
        console.error(`❌ Failed to create attachment record for ${file.name}:`, dbError)
        // Try to delete the uploaded file
        await supabaseAdmin.storage.from('ticket-attachments').remove([filePath])
        failCount++
        continue
      }

      successCount++
    } catch (err) {
      console.error(`❌ Unexpected error uploading ${file.name}:`, err)
      failCount++
    }
  }

  const warning =
    failCount > 0
      ? `⚠️ ${failCount} of ${files.length} image(s) failed to upload. Ticket created successfully.`
      : undefined

  return { success: successCount, failed: failCount, warning }
}

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
    
    // Check if request has FormData (multipart) or JSON
    const contentType = req.headers.get('content-type') || ''
    let body: any
    let files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      
      // Extract text fields
      body = {
        message: formData.get('message') || '',
        phone: formData.get('phone') || '',
        description: formData.get('description') || '',
        reporter_name: formData.get('reporter_name') || '',
        source: formData.get('source') || '',
        project_code: formData.get('project_code') || '',
        building_number: formData.get('building_number') || '',
      }

      // Extract file attachments
      const attachmentFiles = formData.getAll('attachments')
      files = attachmentFiles.filter((f) => f instanceof File) as File[]
    } else {
      body = await req.json()
    }

    const message = body?.message ? String(body.message).trim() : ''
    const phone = body?.phone ? String(body.phone).trim() : ''
    const description = body?.description ? String(body.description).trim() : ''
    const reporterName = body?.reporter_name ? String(body.reporter_name).trim() : null
    const source = body?.source ? String(body.source).trim() : 'web_form'
    const projectCodeFromBody = body?.project_code
      ? String(body.project_code).trim().toUpperCase()
      : ''
    const buildingNumberFromBody = body?.building_number
      ? String(body.building_number).trim()
      : null

    // MODE 1: WEB FORM
    if (projectCodeFromBody) {
      if (description.length < 3) {
        return NextResponse.json(
          { error: 'description must be at least 3 characters' },
          { status: 400 }
        )
      }

      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id, name, project_code, client_id')
        .eq('project_code', projectCodeFromBody)
        .maybeSingle()

      if (projectError) {
        console.error('❌ Failed to fetch project:', projectError)
        return NextResponse.json(
          { error: 'Failed to fetch project' },
          { status: 500 }
        )
      }

      if (!project) {
        return NextResponse.json(
          { error: `Project not found for code ${projectCodeFromBody}` },
          { status: 404 }
        )
      }

      const { data: createdTicket, error: ticketError } = await supabaseAdmin
        .from('tickets')
        .insert({
          project_id: project.id,
          client_id: project.client_id,
          reporter_name: reporterName,
          reporter_phone: null,
          description,
          status: 'NEW',
          priority: 'NORMAL',
          source,
          language: 'he',
          building_number: buildingNumberFromBody,
        })
        .select('id, ticket_number, project_id, status, building_number')
        .single()

      if (ticketError) {
        console.error('❌ Failed to create ticket from web form:', ticketError)
        return NextResponse.json(
          { error: ticketError.message || 'Failed to create ticket' },
          { status: 500 }
        )
      }

      const { error: logError } = await supabaseAdmin
        .from('ticket_logs')
        .insert({
          ticket_id: createdTicket.id,
          action_type: 'CREATED_FROM_WEB_FORM',
          notes: `Ticket created from web form for project ${project.project_code}`,
          created_by: 'system',
          meta: {
            source: 'web_form',
            project_code: project.project_code,
            reporter_name: reporterName,
            building_number: buildingNumberFromBody,
          },
        })

      if (logError) {
        console.error('⚠️ Ticket log insert failed (non-blocking):', logError)
      }

      // Handle file attachments if present
      let imageUploadWarning: string | undefined
      if (files.length > 0) {
        const uploadResult = await uploadAttachments(supabaseAdmin, createdTicket.id, files)
        imageUploadWarning = uploadResult.warning
      }

      return NextResponse.json({
        success: true,
        mode: 'created_from_web_form',
        ticketId: createdTicket.id,
        ticketNumber: createdTicket.ticket_number,
        projectCode: project.project_code,
        buildingNumber: createdTicket.building_number,
        imageUploadWarning,
      })
    }

    // MODE 2: WHATSAPP / LEGACY FLOW
    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      )
    }

    const { data: existingSession, error: sessionLookupError } = await supabaseAdmin
      .from('sessions')
      .select('id, phone_number, project_id, active_ticket_id, is_active')
      .eq('phone_number', phone)
      .eq('is_active', true)
      .maybeSingle()

    if (sessionLookupError) {
      return NextResponse.json(
        { error: `Session lookup error: ${sessionLookupError.message}` },
        { status: 500 }
      )
    }

    if (existingSession?.active_ticket_id) {
      const followUpText = description || message || 'ללא תוכן'

      const { data: updatedTicket, error: updateError } = await supabaseAdmin
        .from('tickets')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSession.active_ticket_id)
        .select('id, ticket_number, updated_at, status')
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: `Ticket update error: ${updateError.message}` },
          { status: 500 }
        )
      }

      const { error: logError } = await supabaseAdmin
        .from('ticket_logs')
        .insert({
          ticket_id: existingSession.active_ticket_id,
          action_type: 'USER_MESSAGE',
          new_value: followUpText,
          performed_by: phone,
          notes: 'Incoming follow-up message from user',
          created_by: 'system',
          meta: {
            source: 'whatsapp_followup',
            phone,
          },
        })

      if (logError) {
        return NextResponse.json(
          { error: `Ticket log error: ${logError.message}` },
          { status: 500 }
        )
      }

      const { error: sessionUpdateError } = await supabaseAdmin
        .from('sessions')
        .update({
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', existingSession.id)

      if (sessionUpdateError) {
        return NextResponse.json(
          { error: `Session update error: ${sessionUpdateError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'updated_existing_ticket',
        ticket: updatedTicket,
        session: existingSession,
      })
    }

    if (!message) {
      return NextResponse.json(
        { error: 'message is required when no active session exists' },
        { status: 400 }
      )
    }

    const parsedStart = parseStartCode(message)

    if (!parsedStart) {
      return NextResponse.json(
        { error: 'Invalid project code and no active session found' },
        { status: 400 }
      )
    }

    const { projectCode, buildingNumber } = parsedStart

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, project_code, client_id')
      .eq('project_code', projectCode)
      .maybeSingle()

    if (projectError || !project) {
      return NextResponse.json(
        { error: `Project not found for code ${projectCode}` },
        { status: 404 }
      )
    }

    const initialDescription = description || 'ללא תיאור'

    const { data: createdTicket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        project_id: project.id,
        client_id: project.client_id,
        reporter_phone: phone,
        reporter_name: reporterName,
        description: initialDescription,
        status: 'NEW',
        priority: 'NORMAL',
        source: 'whatsapp',
        language: 'he',
        building_number: buildingNumber,
      })
      .select('id, ticket_number, project_id, status, building_number')
      .single()

    if (ticketError) {
      return NextResponse.json(
        { error: ticketError.message || 'Failed to create ticket' },
        { status: 500 }
      )
    }

    const { data: createdSession, error: createSessionError } = await supabaseAdmin
      .from('sessions')
      .insert({
        phone_number: phone,
        project_id: project.id,
        active_ticket_id: createdTicket.id,
        is_active: true,
        last_activity_at: new Date().toISOString(),
      })
      .select('id, phone_number, project_id, active_ticket_id, is_active')
      .single()

    if (createSessionError) {
      return NextResponse.json(
        {
          error: `Session creation error: ${createSessionError.message}`,
          ticket: createdTicket,
        },
        { status: 500 }
      )
    }

    const { error: firstLogError } = await supabaseAdmin
      .from('ticket_logs')
      .insert({
        ticket_id: createdTicket.id,
        action_type: 'TICKET_CREATED',
        new_value: initialDescription,
        performed_by: phone,
        notes: 'Initial ticket creation from user',
        created_by: 'system',
        meta: {
          source: 'whatsapp',
          phone,
          project_code: project.project_code,
          building_number: buildingNumber,
        },
      })

    if (firstLogError) {
      return NextResponse.json(
        {
          error: `Initial log error: ${firstLogError.message}`,
          ticket: createdTicket,
          session: createdSession,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mode: 'created_new_ticket_and_session',
      ticket: createdTicket,
      session: createdSession,
      buildingNumber,
    })
  } catch (err) {
    console.error('❌ create-ticket route error:', err)
    return NextResponse.json(
      {
        error: 'Server error',
        details: process.env.NODE_ENV === 'development' ? String(err) : undefined,
      },
      { status: 500 }
    )
  }
}

