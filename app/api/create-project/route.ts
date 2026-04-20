import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getClientPlanRow, effectiveMaxBuildings } from '@/lib/plan-limits'

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()
    const clientId = body?.client_id as string | undefined
    if (!clientId) {
      return NextResponse.json({ error: 'חסר client_id' }, { status: 400 })
    }

    const { data: client, error: cErr } = await getClientPlanRow(supabase, clientId)
    if (cErr || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
    }

    const maxB = effectiveMaxBuildings(client)
    const { count, error: countErr } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    const current = count ?? 0
    if (maxB !== null && current >= maxB) {
      return NextResponse.json(
        {
          error: `הגעת למגבלת הבניינים בחבילה שלך (${maxB}). שדרג את החבילה להוסיף עוד.`,
        },
        { status: 403 }
      )
    }

    const payload = {
      name: String(body?.name || '').trim(),
      project_code: String(body?.project_code || '').trim().toUpperCase(),
      address: body?.address ? String(body.address).trim() || null : null,
      qr_identifier: body?.qr_identifier ? String(body.qr_identifier).trim() || null : null,
      is_active: body?.is_active !== false,
      client_id: clientId,
      assigned_worker_id: body?.assigned_worker_id ? String(body.assigned_worker_id) : null,
    }

    if (!payload.name || !payload.project_code) {
      return NextResponse.json({ error: 'שם וקוד פרויקט נדרשים' }, { status: 400 })
    }

    const { data: created, error: insErr } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ project: created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
