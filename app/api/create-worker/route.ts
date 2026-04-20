import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getClientPlanRow, effectiveMaxWorkers } from '@/lib/plan-limits'

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

    const maxW = effectiveMaxWorkers(client)
    const { count, error: countErr } = await supabase
      .from('workers')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    const current = count ?? 0
    if (maxW !== null && current >= maxW) {
      return NextResponse.json(
        {
          error: `הגעת למגבלת העובדים בחבילה שלך (${maxW}). שדרג את החבילה.`,
        },
        { status: 403 }
      )
    }

    const payload = {
      client_id: clientId,
      full_name: String(body?.full_name || '').trim(),
      phone: body?.phone ? String(body.phone).trim() : null,
      email: body?.email ? String(body.email).trim() : null,
      role: body?.role ? String(body.role).trim() : null,
      is_active: body?.is_active !== false,
    }

    if (!payload.full_name) {
      return NextResponse.json({ error: 'שם מלא נדרש' }, { status: 400 })
    }

    const { data: created, error: insErr } = await supabase
      .from('workers')
      .insert(payload)
      .select()
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ worker: created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
