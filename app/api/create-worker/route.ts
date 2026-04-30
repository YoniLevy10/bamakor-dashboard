import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getClientPlanRow, effectiveMaxWorkers } from '@/lib/plan-limits'
import { checkRateLimitDistributed, sanitizeId, sanitizeString } from '@/lib/api-validation'
import { getLogger, getAuditLogger } from '@/lib/logging'
import { requireSessionClientId } from '@/lib/api-auth'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `create-worker-${Date.now()}`
  try {
    const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    let body: any = null
    try {
      body = await req.json()
    } catch (e) {
      body = { __parse_error: e instanceof Error ? e.message : String(e) }
    }
    console.log('[create-worker] start', { requestId, hasServiceRoleKey, body })

    if (!hasServiceRoleKey) {
      console.log('[create-worker] missing SUPABASE_SERVICE_ROLE_KEY (cannot use admin client)', {
        requestId,
        hasServiceRoleKey,
      })
      return NextResponse.json(
        {
          error:
            'חסר SUPABASE_SERVICE_ROLE_KEY בשרת. מלאו אותו ב-`.env.local` והפעילו מחדש את השרת.',
          requestId,
        },
        { status: 500 }
      )
    }

    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response

    let supabase
    try {
      supabase = getSupabaseAdmin()
    } catch (e) {
      console.log('[create-worker] getSupabaseAdmin failed', {
        requestId,
        hasServiceRoleKey,
        error: e instanceof Error ? { message: e.message, name: e.name, stack: e.stack } : String(e),
      })
      throw e
    }
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    const rl = await checkRateLimitDistributed({
      supabaseAdmin: supabase,
      key: `ip:${ip}:create-worker`,
      windowMs: 60_000,
      maxRequests: 60,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }
    const clientId = auth.ctx.clientId

    const orgId = sanitizeId((body as { organization_id?: unknown })?.organization_id)
    if (orgId) {
      const { data: orgCheck, error: orgVerErr } = await supabase
        .from('organizations')
        .select('client_id')
        .eq('id', orgId)
        .maybeSingle()
      if (orgVerErr || !orgCheck || (orgCheck as { client_id?: string }).client_id !== clientId) {
        if (orgVerErr) {
          console.log('[create-worker] supabase error org verify', { requestId, orgVerErr })
        }
        return NextResponse.json({ error: 'ארגון לא תקף', requestId }, { status: 403 })
      }
    }

    const { data: client, error: cErr } = await getClientPlanRow(supabase, clientId)
    if (cErr || !client) {
      if (cErr) {
        console.log('[create-worker] supabase error get client plan', { requestId, cErr })
      }
      audit.logFailedOperation('READ', 'CLIENT', clientId, clientId, 'client_not_found')
      return NextResponse.json({ error: 'לקוח לא נמצא', requestId }, { status: 404 })
    }

    const maxW = effectiveMaxWorkers(client)
    const { count, error: countErr } = await supabase
      .from('workers')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (countErr) {
      console.log('[create-worker] supabase error count workers', { requestId, countErr })
      logger.error('WORKER_API', 'Count workers failed', new Error(countErr.message), { requestId, clientId })
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    const current = count ?? 0
    if (maxW !== null && current >= maxW) {
      return NextResponse.json(
        {
          error: `הגעת למגבלת העובדים בחבילה שלך (${maxW}). שדרג את החבילה.`,
          requestId,
        },
        { status: 403 }
      )
    }

    const payload: Record<string, unknown> = {
      client_id: clientId,
      full_name: sanitizeString(body?.full_name),
      phone: body?.phone ? sanitizeString(body.phone) : null,
      email: body?.email ? sanitizeString(body.email) : null,
      role: body?.role ? sanitizeString(body.role) : null,
      is_active: body?.is_active !== false,
    }
    if (orgId) {
      payload.organization_id = orgId
    }

    const fullName = String(payload.full_name || '')
    if (!fullName) {
      return NextResponse.json({ error: 'שם מלא נדרש', requestId }, { status: 400 })
    }
    const phoneStr = payload.phone != null ? String(payload.phone) : ''
    if (phoneStr && phoneStr.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין', requestId }, { status: 400 })
    }
    const emailStr = payload.email != null ? String(payload.email) : ''
    if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return NextResponse.json({ error: 'אימייל לא תקין', requestId }, { status: 400 })
    }

    const insertPayload = { ...payload, full_name: fullName, phone: phoneStr || null, email: emailStr || null }

    const { data: created, error: insErr } = await supabase
      .from('workers')
      .insert(insertPayload)
      .select()
      .single()

    if (insErr) {
      console.log('[create-worker] supabase error insert worker', { requestId, insErr, insertPayload })
      logger.error('WORKER_API', 'Create worker failed', new Error(insErr.message), { requestId, clientId })
      audit.logFailedOperation('CREATE', 'WORKER', 'unknown', clientId, insErr.message)
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    audit.logAction('CREATE', 'WORKER', (created as { id?: string } | null)?.id || 'unknown', clientId, 'dashboard')
    logger.info('WORKER_API', 'Worker created', { requestId, clientId })
    return NextResponse.json({ worker: created, requestId })
  } catch (e) {
    logger.error('WORKER_API', 'Unhandled create-worker error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
