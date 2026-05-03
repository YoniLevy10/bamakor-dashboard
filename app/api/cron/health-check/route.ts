import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getLogger } from '@/lib/logging'

/**
 * Periodic probe: pings DB + appends system_logs (Vercel cron).
 */
export async function GET(req: NextRequest) {
  const logger = getLogger()
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ts = new Date().toISOString()
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('clients').select('id').limit(1)

    const ok = !error

    await admin.from('system_logs').insert({
      level: ok ? 'info' : 'error',
      source: 'cron.health-check',
      message: ok ? 'db_connected' : 'db_failed',
      payload: ok ? { ts } : { ts, detail: error?.message },
    })

    if (!ok) {
      logger.error('CRON', 'health-check DB failed', new Error(error?.message || 'unknown'))
      return NextResponse.json({ status: 'error', db: 'disconnected', ts }, { status: 503 })
    }

    return NextResponse.json({ status: 'ok', db: 'connected', ts })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('CRON', 'health-check exception', e instanceof Error ? e : new Error(msg))
    try {
      const admin = getSupabaseAdmin()
      await admin.from('system_logs').insert({
        level: 'error',
        source: 'cron.health-check',
        message: 'exception',
        payload: { ts, detail: msg },
      })
    } catch {
      /* ignore secondary failure */
    }
    return NextResponse.json({ status: 'error', db: 'disconnected', ts, detail: msg }, { status: 503 })
  }
}
