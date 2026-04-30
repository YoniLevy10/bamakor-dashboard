import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizeWhatsAppPhoneDigits } from '@/lib/whatsapp-test-phone'
import { requireSessionClientId } from '@/lib/api-auth'
import { pendingResidentsQueryUnavailable } from '@/lib/supabase-table-errors'
import { checkRateLimitDistributed, sanitizeId, sanitizeString } from '@/lib/api-validation'
import { getLogger, getAuditLogger } from '@/lib/logging'

const MIGRATION_HINT =
  'הריצו ב-Supabase את המיגרציה supabase/migrations/015_pending_resident_join_requests.sql (או supabase db push) כדי ליצור את הטבלה.'

function formatPhoneForResident(digits: string): string {
  const d = normalizeWhatsAppPhoneDigits(digits)
  if (!d) return ''
  if (d.startsWith('972')) return `+${d}`
  if (d.startsWith('0')) return `+972${d.slice(1)}`
  return `+${d}`
}

type PendingRow = {
  id: string
  client_id: string
  project_id: string
  ticket_id: string | null
  reporter_phone_normalized: string
  status: string
  created_at: string
}

export async function GET() {
  const logger = getLogger()
  const requestId = `pending-residents-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const clientId = auth.ctx.clientId

    const supabase = getSupabaseAdmin()
    // light rate limit: list is sensitive PII-ish
    const rl = await checkRateLimitDistributed({
      supabaseAdmin: supabase,
      key: `global:pending-residents:GET`,
      windowMs: 60_000,
      maxRequests: 120,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const { data: rows, error } = await supabase
      .from('pending_resident_join_requests')
      .select('id, client_id, project_id, ticket_id, reporter_phone_normalized, status, created_at')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      if (pendingResidentsQueryUnavailable(error)) {
        return NextResponse.json({
          items: [] as unknown[],
          tableMissing: true,
          hint: MIGRATION_HINT,
          requestId,
        })
      }
      logger.error('RESIDENTS_API', 'pending-residents query failed', new Error(error.message), { requestId, clientId })
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    const list = (rows || []) as PendingRow[]
    const projectIds = [...new Set(list.map((r) => r.project_id))]
    const ticketIds = list.map((r) => r.ticket_id).filter((id): id is string => !!id)
    const { data: projects } =
      projectIds.length > 0
        ? await supabase.from('projects').select('id, name, project_code').in('id', projectIds)
        : { data: [] as { id: string; name: string; project_code: string }[] }
    const { data: tickets } =
      ticketIds.length > 0
        ? await supabase.from('tickets').select('id, ticket_number').in('id', ticketIds)
        : { data: [] as { id: string; ticket_number: number }[] }

    const byProject = new Map((projects as { id: string; name: string; project_code: string }[] | null)?.map((p) => [p.id, p]) || [])
    const byTicket = new Map((tickets as { id: string; ticket_number: number }[] | null)?.map((t) => [t.id, t]) || [])

    return NextResponse.json({
      items: list.map((r) => ({
        ...r,
        project_name: byProject.get(r.project_id)?.name || '',
        project_code: byProject.get(r.project_id)?.project_code || '',
        ticket_number: r.ticket_id ? byTicket.get(r.ticket_id)?.ticket_number : undefined,
      })),
      requestId,
    })
  } catch (e) {
    logger.error('RESIDENTS_API', 'Unhandled pending-residents GET error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `pending-residents-patch-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const clientId = auth.ctx.clientId

    const supabase = getSupabaseAdmin()
    const rl = await checkRateLimitDistributed({
      supabaseAdmin: supabase,
      key: `global:pending-residents:PATCH`,
      windowMs: 60_000,
      maxRequests: 60,
    })
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }
    const body = (await req.json()) as {
      id?: string
      action?: 'approve' | 'reject'
      full_name?: string
    }

    const id = sanitizeId(body?.id)
    const action = body?.action
    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required', requestId }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from('pending_resident_join_requests')
      .select('id, client_id, project_id, ticket_id, reporter_phone_normalized, status')
      .eq('id', id)
      .eq('client_id', clientId)
      .maybeSingle()

    if (fetchErr && pendingResidentsQueryUnavailable(fetchErr)) {
      return NextResponse.json(
        { error: 'טבלת בקשות דיירים עדיין לא קיימת במסד הנתונים.', hint: MIGRATION_HINT, code: 'MIGRATION_REQUIRED', requestId },
        { status: 503 }
      )
    }
    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Not found', requestId }, { status: 404 })
    }

    if ((row as { status: string }).status !== 'pending') {
      return NextResponse.json({ error: 'Already resolved', requestId }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === 'reject') {
      const { error: up } = await supabase
        .from('pending_resident_join_requests')
        .update({
          status: 'rejected',
          resolved_at: now,
          resolved_by: 'dashboard',
        })
        .eq('id', id)
        .eq('client_id', clientId)

      if (up) {
        if (pendingResidentsQueryUnavailable(up)) {
          return NextResponse.json({ error: up.message, hint: MIGRATION_HINT, code: 'MIGRATION_REQUIRED', requestId }, { status: 503 })
        }
        logger.error('RESIDENTS_API', 'Reject pending resident failed', new Error(up.message), { requestId, id, clientId })
        audit.logFailedOperation('REJECT', 'PENDING_RESIDENT', id, clientId, up.message)
        return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
      }
      audit.logAction('REJECT', 'PENDING_RESIDENT', id, clientId, 'dashboard')
      return NextResponse.json({ ok: true, status: 'rejected', requestId })
    }

    const fullName = sanitizeString(body.full_name) || 'דייר (אושר מהוואטסאפ)'
    const digits = normalizeWhatsAppPhoneDigits((row as { reporter_phone_normalized: string }).reporter_phone_normalized)
    const phone = formatPhoneForResident(digits)

    const { error: insErr } = await supabase.from('residents').insert({
      project_id: (row as { project_id: string }).project_id,
      client_id: clientId,
      full_name: fullName,
      phone,
      apartment_number: null,
      notes: 'נוסף לאחר אישור בקשת הצטרפות מוואטסאפ',
    })

    if (insErr) {
      logger.error('RESIDENTS_API', 'Insert resident failed', new Error(insErr.message), { requestId, id, clientId })
      audit.logFailedOperation('APPROVE', 'PENDING_RESIDENT', id, clientId, insErr.message)
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }

    const { error: up } = await supabase
      .from('pending_resident_join_requests')
      .update({
        status: 'approved',
        resolved_at: now,
        resolved_by: 'dashboard',
      })
      .eq('id', body.id)
      .eq('client_id', clientId)

    if (up) {
      if (pendingResidentsQueryUnavailable(up)) {
        return NextResponse.json({ error: up.message, hint: MIGRATION_HINT, code: 'MIGRATION_REQUIRED', requestId }, { status: 503 })
      }
      logger.error('RESIDENTS_API', 'Approve pending resident update failed', new Error(up.message), { requestId, id, clientId })
      audit.logFailedOperation('APPROVE', 'PENDING_RESIDENT', id, clientId, up.message)
      return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
    }
    audit.logAction('APPROVE', 'PENDING_RESIDENT', id, clientId, 'dashboard')
    return NextResponse.json({ ok: true, status: 'approved', requestId })
  } catch (e) {
    logger.error('RESIDENTS_API', 'Unhandled pending-residents PATCH error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
