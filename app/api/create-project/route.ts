import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getClientPlanRow, effectiveMaxBuildings } from '@/lib/plan-limits'
import { checkRateLimitDistributed, sanitizeId, sanitizeString } from '@/lib/api-validation'
import { getLogger, getAuditLogger } from '@/lib/logging'
import { requireSessionClientId } from '@/lib/api-auth'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `create-project-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response

    const supabase = getSupabaseAdmin()
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin: supabase,
      key: `ip:${ip}:create-project`,
      windowMs: 60_000,
      maxRequests: 30,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const body = await req.json()
    const clientId = auth.ctx.clientId

    let organizationId = sanitizeId((body as { organization_id?: unknown })?.organization_id)
    if (!organizationId) {
      const { data: mem, error: memErr } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', auth.ctx.userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!memErr && mem?.organization_id) {
        organizationId = sanitizeId(mem.organization_id)
      }
    }
    if (!organizationId) {
      return NextResponse.json({ error: 'חסר organization_id', requestId }, { status: 400 })
    }
    const { data: orgCheck, error: orgVerErr } = await supabase
      .from('organizations')
      .select('client_id')
      .eq('id', organizationId)
      .maybeSingle()
    if (orgVerErr || !orgCheck || (orgCheck as { client_id?: string }).client_id !== clientId) {
      return NextResponse.json({ error: 'ארגון לא תקף', requestId }, { status: 403 })
    }

    const { data: client, error: cErr } = await getClientPlanRow(supabase, clientId)
    if (cErr || !client) {
      audit.logFailedOperation('READ', 'CLIENT', clientId, clientId, 'client_not_found')
      return NextResponse.json({ error: 'לקוח לא נמצא', requestId }, { status: 404 })
    }

    const maxB = effectiveMaxBuildings(client)
    const { count, error: countErr } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (countErr) {
      logger.error('PROJECT_API', 'Count projects failed', new Error(countErr.message), { requestId, clientId })
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    const current = count ?? 0
    if (maxB !== null && current >= maxB) {
      return NextResponse.json(
        {
          error: `הגעת למגבלת הבניינים בחבילה שלך (${maxB}). שדרג את החבילה להוסיף עוד.`,
          requestId,
        },
        { status: 403 }
      )
    }

    const payload: Record<string, unknown> = {
      name: sanitizeString(body?.name),
      project_code: sanitizeString(body?.project_code).toUpperCase(),
      address: body?.address ? sanitizeString(body.address) || null : null,
      qr_identifier: body?.qr_identifier ? sanitizeString(body.qr_identifier) || null : null,
      is_active: body?.is_active !== false,
      client_id: clientId,
      assigned_worker_id: body?.assigned_worker_id ? String(body.assigned_worker_id) : null,
    }
    if (organizationId) {
      payload.organization_id = organizationId
    }

    const projectCode = String(payload.project_code || '')
    const projectName = String(payload.name || '')
    if (!projectName || !projectCode) {
      return NextResponse.json({ error: 'שם וקוד פרויקט נדרשים', requestId }, { status: 400 })
    }
    if (!/^[A-Z0-9_]{2,20}$/.test(projectCode)) {
      return NextResponse.json({ error: 'קוד פרויקט לא תקין', requestId }, { status: 400 })
    }

    const insertPayload = { ...payload, name: projectName, project_code: projectCode }

    const { data: created, error: insErr } = await supabase
      .from('projects')
      .insert(insertPayload)
      .select()
      .single()

    if (insErr) {
      logger.error('PROJECT_API', 'Create project failed', new Error(insErr.message), { requestId, clientId })
      audit.logFailedOperation('CREATE', 'PROJECT', 'unknown', clientId, insErr.message)
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    audit.logAction('CREATE', 'PROJECT', (created as { id?: string } | null)?.id || 'unknown', clientId, 'dashboard')
    logger.info('PROJECT_API', 'Project created', { requestId, clientId })
    return NextResponse.json({ project: created, requestId })
  } catch (e) {
    logger.error('PROJECT_API', 'Unhandled create-project error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
