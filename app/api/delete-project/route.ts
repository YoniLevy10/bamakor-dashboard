import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSingletonClientId } from '@/lib/singleton-client-server'

/**
 * Hard-delete a project for the single-tenant client (service role).
 * Clears merge pointers into tickets of this project, then removes dependent rows
 * if the DB does not cascade everything on project delete.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const projectId = typeof body?.project_id === 'string' ? body.project_id.trim() : ''
    if (!projectId) {
      return NextResponse.json({ error: 'חסר project_id' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const clientId = await getSingletonClientId(admin)

    const { data: project, error: pErr } = await admin
      .from('projects')
      .select('id, name, project_code, client_id')
      .eq('id', projectId)
      .maybeSingle()

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!project || (project as { client_id?: string }).client_id !== clientId) {
      return NextResponse.json({ error: 'פרויקט לא נמצא' }, { status: 404 })
    }

    const { data: ticketRows, error: tListErr } = await admin
      .from('tickets')
      .select('id')
      .eq('project_id', projectId)

    if (tListErr) return NextResponse.json({ error: tListErr.message }, { status: 500 })
    const ticketIds = ((ticketRows as { id: string }[] | null) || []).map((r) => r.id)

    if (ticketIds.length > 0) {
      const { error: mErr } = await admin
        .from('tickets')
        .update({ merged_into_ticket_id: null })
        .in('merged_into_ticket_id', ticketIds)
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

      const { error: attErr } = await admin.from('ticket_attachments').delete().in('ticket_id', ticketIds)
      if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 })

      const { error: logErr } = await admin.from('ticket_logs').delete().in('ticket_id', ticketIds)
      if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 })

      const { error: delTicketsErr } = await admin.from('tickets').delete().eq('project_id', projectId)
      if (delTicketsErr) return NextResponse.json({ error: delTicketsErr.message }, { status: 500 })
    }

    const { error: resDelErr } = await admin.from('residents').delete().eq('project_id', projectId)
    if (resDelErr) return NextResponse.json({ error: resDelErr.message }, { status: 500 })

    const { error: sessDelErr } = await admin.from('sessions').delete().eq('project_id', projectId)
    if (sessDelErr) return NextResponse.json({ error: sessDelErr.message }, { status: 500 })

    const { error: delProjErr } = await admin.from('projects').delete().eq('id', projectId).eq('client_id', clientId)
    if (delProjErr) return NextResponse.json({ error: delProjErr.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      deleted: {
        project_id: projectId,
        name: (project as { name?: string }).name,
        project_code: (project as { project_code?: string }).project_code,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
