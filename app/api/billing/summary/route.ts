import { NextResponse } from 'next/server'
import { requireSessionClientId } from '@/lib/api-auth'

function startOfMonthIso() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function weekKeyMonday(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

export async function GET() {
  const auth = await requireSessionClientId()
  if (!auth.ok) return auth.response

  const { admin, clientId } = auth.ctx
  const monthStart = startOfMonthIso()

  try {
    const [ticketsMonth, residentsCount, workersActive, ticketsForWeeks] = await Promise.all([
      admin
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .gte('created_at', monthStart),
      admin
        .from('residents')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId),
      admin
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('is_active', true),
      admin
        .from('tickets')
        .select('created_at')
        .eq('client_id', clientId)
        .gte('created_at', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    if (ticketsMonth.error || residentsCount.error || workersActive.error || ticketsForWeeks.error) {
      return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
    }

    const weekMap = new Map<string, number>()
    const rows = (ticketsForWeeks.data || []) as { created_at: string }[]
    for (const r of rows) {
      const k = weekKeyMonday(new Date(r.created_at))
      weekMap.set(k, (weekMap.get(k) || 0) + 1)
    }
    const chart = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week_start, count]) => ({ week_start, count }))

    return NextResponse.json({
      ticketsThisMonth: ticketsMonth.count ?? 0,
      residentsTotal: residentsCount.count ?? 0,
      workersActive: workersActive.count ?? 0,
      ticketsByWeek: chart,
    })
  } catch {
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
