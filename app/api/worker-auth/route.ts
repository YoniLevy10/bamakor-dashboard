import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeId } from '@/lib/api-validation'

/**
 * Field worker deep link: validate access_token without Google session.
 */
export async function GET(req: NextRequest) {
  try {
    const token = sanitizeId(req.nextUrl.searchParams.get('token'))
    if (!token) {
      return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('workers')
      .select('id, client_id, full_name, is_active')
      .eq('access_token', token)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data || !data.is_active) {
      return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
    }

    return NextResponse.json({
      worker_id: data.id,
      client_id: data.client_id,
      full_name: data.full_name,
    })
  } catch {
    return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
  }
}
