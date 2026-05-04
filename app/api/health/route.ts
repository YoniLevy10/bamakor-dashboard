import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Lightweight readiness: verifies Supabase service connectivity.
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('clients').select('id').limit(1)
    if (error) {
      console.error('[health]', error.message)
      return NextResponse.json(
        { status: 'error', db: 'disconnected', ts: new Date().toISOString() },
        { status: 503 }
      )
    }
    return NextResponse.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
  } catch (e) {
    console.error('[health]', e instanceof Error ? e.message : String(e))
    return NextResponse.json(
      { status: 'error', db: 'disconnected', ts: new Date().toISOString() },
      { status: 503 }
    )
  }
}
