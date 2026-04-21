import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSingletonClientId } from '@/lib/singleton-client-server'
import { normalizeWhatsAppPhoneDigits } from '@/lib/whatsapp-test-phone'

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
  try {
    const supabase = getSupabaseAdmin()
    const clientId = await getSingletonClientId(supabase)

    const { data: rows, error } = await supabase
      .from('pending_resident_join_requests')
      .select('id, client_id, project_id, ticket_id, reporter_phone_normalized, status, created_at')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const clientId = await getSingletonClientId(supabase)
    const body = (await req.json()) as {
      id?: string
      action?: 'approve' | 'reject'
      full_name?: string
    }

    if (!body?.id || !body?.action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from('pending_resident_join_requests')
      .select('id, client_id, project_id, ticket_id, reporter_phone_normalized, status')
      .eq('id', body.id)
      .eq('client_id', clientId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if ((row as { status: string }).status !== 'pending') {
      return NextResponse.json({ error: 'Already resolved' }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (body.action === 'reject') {
      const { error: up } = await supabase
        .from('pending_resident_join_requests')
        .update({
          status: 'rejected',
          resolved_at: now,
          resolved_by: 'dashboard',
        })
        .eq('id', body.id)
        .eq('client_id', clientId)

      if (up) return NextResponse.json({ error: up.message }, { status: 500 })
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    const fullName = (body.full_name || '').trim() || 'דייר (אושר מהוואטסאפ)'
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
      return NextResponse.json({ error: insErr.message }, { status: 500 })
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

    if (up) return NextResponse.json({ error: up.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'approved' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
