import { NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route-handler'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getClientPlanRow, effectiveMaxBuildings } from '@/lib/plan-limits'
import { sanitizeString } from '@/lib/api-validation'

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteHandlerClient()
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser()
  if (uErr || !user) {
    return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: mem, error: mErr } = await admin
    .from('organization_users')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (mErr || !mem?.organization_id) {
    return NextResponse.json({ error: 'יש להשלים קודם את שלב הארגון' }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown
    project_code?: unknown
  }
  const name = sanitizeString(body?.name)
  const project_code = sanitizeString(body?.project_code).toUpperCase()
  if (!name || !project_code) {
    return NextResponse.json({ error: 'שם פרויקט וקוד נדרשים' }, { status: 400 })
  }
  if (!/^[A-Z0-9_]{2,20}$/.test(project_code)) {
    return NextResponse.json({ error: 'קוד פרויקט לא תקין' }, { status: 400 })
  }

  const { data: orgRow, error: orgErr } = await admin
    .from('organizations')
    .select('client_id')
    .eq('id', mem.organization_id as string)
    .maybeSingle()

  if (orgErr || !orgRow?.client_id) {
    return NextResponse.json({ error: 'ארגון ללא לקוח — פנו לתמיכה' }, { status: 400 })
  }

  const clientId = orgRow.client_id as string

  const { data: client, error: cErr } = await getClientPlanRow(admin, clientId)
  if (cErr || !client) {
    return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
  }

  const maxB = effectiveMaxBuildings(client)
  const { count, error: countErr } = await admin
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('is_active', true)

  if (countErr) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
  const current = count ?? 0
  if (maxB !== null && current >= maxB) {
    return NextResponse.json(
      { error: `הגעת למגבלת הבניינים (${maxB})` },
      { status: 403 }
    )
  }

  const { data: created, error: insErr } = await admin
    .from('projects')
    .insert({
      name,
      project_code,
      client_id: clientId,
      organization_id: mem.organization_id as string,
      is_active: true,
    })
    .select('id')
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ project_id: (created as { id: string }).id })
}
