import { NextResponse } from 'next/server'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route-handler'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    const supabase = await createSupabaseRouteHandlerClient()
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser()
    if (uErr || !user) {
      return NextResponse.json({ error: 'נדרשת התחברות' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('organization_users')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      organization_id:
        ((data as Array<{ organization_id?: string | null }> | null) || []).find(
          (row) => typeof row.organization_id === 'string' && row.organization_id.trim().length > 0
        )?.organization_id ?? null,
    })
  } catch (e) {
    console.error('[onboarding/session]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
