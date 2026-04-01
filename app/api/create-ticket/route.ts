import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { message, phone, description } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      )
    }

    // 1. בדיקה אם יש session פעיל למספר הזה
    const { data: existingSession, error: sessionLookupError } = await supabase
      .from('sessions')
      .select('*')
      .eq('phone_number', phone)
      .eq('is_active', true)
      .maybeSingle()

    if (sessionLookupError) {
      return NextResponse.json(
        { error: `Session lookup error: ${sessionLookupError.message}` },
        { status: 500 }
      )
    }

    // 2. אם יש session פעיל -> לא יוצרים ticket חדש
    // אלא מוסיפים log ומעדכנים זמן פעילות
    if (existingSession?.active_ticket_id) {
      const { data: updatedTicket, error: updateError } = await supabase
        .from('tickets')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSession.active_ticket_id)
        .select()

      if (updateError) {
        return NextResponse.json(
          { error: `Ticket update error: ${updateError.message}` },
          { status: 500 }
        )
      }

      const { error: logError } = await supabase
        .from('ticket_logs')
        .insert([
          {
            ticket_id: existingSession.active_ticket_id,
            action_type: 'USER_MESSAGE',
            new_value: description || message || 'ללא תוכן',
            performed_by: phone,
            notes: 'Incoming follow-up message from user',
          },
        ])

      if (logError) {
        return NextResponse.json(
          { error: `Ticket log error: ${logError.message}` },
          { status: 500 }
        )
      }

      const { error: sessionUpdateError } = await supabase
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

    // 3. אם אין session פעיל -> חייבים START_BMK תקין
    if (!message) {
      return NextResponse.json(
        { error: 'message is required when no active session exists' },
        { status: 400 }
      )
    }

    const match = message.match(/START_(BMK\d+)/)

    if (!match) {
      return NextResponse.json(
        { error: 'Invalid project code and no active session found' },
        { status: 400 }
      )
    }

    const projectCode = match[1]

    // 4. שליפת פרויקט
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('project_code', projectCode)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: `Project not found for code ${projectCode}` },
        { status: 404 }
      )
    }

    // 5. יצירת ticket חדש
    const { data: createdTickets, error: ticketError } = await supabase
      .from('tickets')
      .insert([
        {
          project_id: project.id,
          reporter_phone: phone,
          description: description || 'ללא תיאור',
          status: 'NEW',
        },
      ])
      .select()

    if (ticketError || !createdTickets || createdTickets.length === 0) {
      return NextResponse.json(
        { error: ticketError?.message || 'Failed to create ticket' },
        { status: 500 }
      )
    }

    const createdTicket = createdTickets[0]

    // 6. יצירת session חדש
    const { data: createdSession, error: createSessionError } = await supabase
      .from('sessions')
      .insert([
        {
          phone_number: phone,
          project_id: project.id,
          active_ticket_id: createdTicket.id,
          is_active: true,
          last_activity_at: new Date().toISOString(),
        },
      ])
      .select()

    if (createSessionError) {
      return NextResponse.json(
        {
          error: `Session creation error: ${createSessionError.message}`,
          ticket: createdTicket,
        },
        { status: 500 }
      )
    }

    // 7. יצירת log ראשון
    const { error: firstLogError } = await supabase
      .from('ticket_logs')
      .insert([
        {
          ticket_id: createdTicket.id,
          action_type: 'TICKET_CREATED',
          new_value: description || message || 'ללא תוכן',
          performed_by: phone,
          notes: 'Initial ticket creation from user',
        },
      ])

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
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}