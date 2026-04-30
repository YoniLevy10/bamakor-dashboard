import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimitDistributed, sanitizeId } from '@/lib/api-validation'
import { getLogger, getAuditLogger } from '@/lib/logging'
import { requireSessionClientId } from '@/lib/api-auth'

/**
 * Hard-delete a project for the single-tenant client (service role).
 * Clears merge pointers into tickets of this project, then removes dependent rows
 * if the DB does not cascade everything on project delete.
 */
export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `delete-project-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const projectId = sanitizeId((body as { project_id?: unknown })?.project_id) || ''
    if (!projectId) {
      return NextResponse.json({ error: 'חסר project_id', requestId }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin: admin,
      key: `ip:${ip}:delete-project`,
      windowMs: 60_000,
      maxRequests: 10,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const clientId = auth.ctx.clientId

    const { data: project, error: pErr } = await admin
      .from('projects')
      .select('id, name, project_code, client_id')
      .eq('id', projectId)
      .maybeSingle()

    if (pErr) {
      logger.error('PROJECT_API', 'Delete project lookup failed', new Error(pErr.message), { requestId, projectId, clientId })
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }
    if (!project || (project as { client_id?: string }).client_id !== clientId) {
      audit.logFailedOperation('DELETE', 'PROJECT', projectId, clientId, 'project_not_found_or_wrong_tenant')
      return NextResponse.json({ error: 'פרויקט לא נמצא', requestId }, { status: 404 })
    }

    const { data: ticketRows, error: tListErr } = await admin
      .from('tickets')
      .select('id')
      .eq('project_id', projectId)

    if (tListErr) {
      logger.error('PROJECT_API', 'Delete project ticket list failed', new Error(tListErr.message), { requestId, projectId, clientId })
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }
    const ticketIds = ((ticketRows as { id: string }[] | null) || []).map((r) => r.id)

    if (ticketIds.length > 0) {
      const { error: mErr } = await admin
        .from('tickets')
        .update({ merged_into_ticket_id: null })
        .in('merged_into_ticket_id', ticketIds)
      if (mErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })

      const { error: attErr } = await admin.from('ticket_attachments').delete().in('ticket_id', ticketIds)
      if (attErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })

      const { error: logErr } = await admin.from('ticket_logs').delete().in('ticket_id', ticketIds)
      if (logErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })

      const { error: delTicketsErr } = await admin.from('tickets').delete().eq('project_id', projectId)
      if (delTicketsErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    const { error: resDelErr } = await admin.from('residents').delete().eq('project_id', projectId)
    if (resDelErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })

    const { error: sessDelErr } = await admin.from('sessions').delete().eq('project_id', projectId)
    if (sessDelErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })

    const { error: delProjErr } = await admin.from('projects').delete().eq('id', projectId).eq('client_id', clientId)
    if (delProjErr) return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })

    audit.logAction('DELETE', 'PROJECT', projectId, clientId, 'dashboard')
    logger.warn('PROJECT_API', 'Project hard-deleted', { requestId, projectId, clientId })
    return NextResponse.json({
      success: true,
      requestId,
      deleted: {
        project_id: projectId,
        name: (project as { name?: string }).name,
        project_code: (project as { project_code?: string }).project_code,
      },
    })
  } catch (e) {
    logger.error('PROJECT_API', 'Unhandled delete-project error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
