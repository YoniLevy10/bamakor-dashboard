import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type ImportRow = {
  full_name?: unknown
  phone?: unknown
  apartment_number?: unknown
  notes?: unknown
  project_code?: unknown
  project_name?: unknown
}

function normalizeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
}

function normalizeProjectCode(v: unknown): string {
  return normalizeString(v).toUpperCase()
}

export async function POST(req: Request) {
  try {
    const bamakorClientId = process.env.BAMAKOR_CLIENT_ID
    if (!bamakorClientId) {
      return NextResponse.json(
        { error: 'Server configuration error. BAMAKOR_CLIENT_ID is not set.' },
        { status: 500 }
      )
    }

    const supabase = getSupabaseAdmin()
    const body = (await req.json()) as { rows?: ImportRow[] } | null
    const rows = body?.rows
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows is required' }, { status: 400 })
    }

    // Load projects once for matching
    const { data: projects, error: pErr } = await supabase
      .from('projects')
      .select('id, name, project_code, client_id')
      .eq('client_id', bamakorClientId)
      .order('name')

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    const byCode = new Map<string, { id: string; name: string }>()
    const byName = new Map<string, { id: string; name: string }>()
    ;(projects as { id: string; name: string; project_code: string }[] | null)?.forEach((p) => {
      byCode.set((p.project_code || '').toUpperCase(), { id: p.id, name: p.name })
      byName.set((p.name || '').trim().toLowerCase(), { id: p.id, name: p.name })
    })

    const toInsert: {
      project_id: string
      client_id: string
      full_name: string
      phone: string | null
      apartment_number: string | null
      notes: string | null
    }[] = []

    const errors: { rowIndex: number; error: string }[] = []

    rows.forEach((r, idx) => {
      const fullName = normalizeString(r.full_name)
      if (!fullName) {
        errors.push({ rowIndex: idx, error: 'שם מלא חסר' })
        return
      }

      const projectCode = normalizeProjectCode(r.project_code)
      const projectName = normalizeString(r.project_name).toLowerCase()
      const match =
        (projectCode && byCode.get(projectCode)) || (projectName && byName.get(projectName)) || null

      if (!match) {
        errors.push({ rowIndex: idx, error: 'לא נמצא בניין תואם (project_code / project_name)' })
        return
      }

      toInsert.push({
        project_id: match.id,
        client_id: bamakorClientId,
        full_name: fullName,
        phone: normalizeString(r.phone) || null,
        apartment_number: normalizeString(r.apartment_number) || null,
        notes: normalizeString(r.notes) || null,
      })
    })

    if (toInsert.length === 0) {
      return NextResponse.json(
        { inserted: 0, failed: errors.length, errors },
        { status: 200 }
      )
    }

    // Bulk insert
    const { data: insertedRows, error: insErr } = await supabase
      .from('residents')
      .insert(toInsert)
      .select('id, project_id, client_id, full_name, phone, apartment_number, notes')

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({
      inserted: (insertedRows as unknown[] | null)?.length ?? toInsert.length,
      failed: errors.length,
      errors,
      residents: insertedRows,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

