'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import {
  AppShell,
  MobileHeader,
  MobileMenu,
  PageHeader,
  Card,
  KpiCard,
  LoadingSpinner,
  theme,
} from '../components/ui'
import { getIsMobileViewport } from '@/lib/mobile-viewport'
import { asyncHandler } from '@/lib/error-handler'

type Summary = {
  ticketsThisMonth: number
  residentsTotal: number
  workersActive: number
  ticketsByWeek: { week_start: string; count: number }[]
}

export default function BillingPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Summary | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(getIsMobileViewport())
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await asyncHandler(
        async () => {
          const res = await fetch('/api/billing/summary')
          const json = (await res.json()) as Summary & { error?: string }
          if (!res.ok) throw new Error(json.error || 'טעינה נכשלה')
          setData({
            ticketsThisMonth: json.ticketsThisMonth,
            residentsTotal: json.residentsTotal,
            workersActive: json.workersActive,
            ticketsByWeek: json.ticketsByWeek || [],
          })
          return true
        },
        { context: 'billing summary', showErrorToast: true }
      )
      setLoading(false)
    })()
  }, [])

  const maxWeek = Math.max(1, ...(data?.ticketsByWeek.map((w) => w.count) || [1]))

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader title="חיוב ושימוש" subtitle="סיכום למנהל" onMenuClick={() => setMenuOpen(true)} />
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div
        style={{
          ...styles.content,
          ...(isMobile ? { padding: '16px 16px 8px', maxWidth: '100%', boxSizing: 'border-box' } : {}),
        }}
      >
        {!isMobile && <PageHeader title="חיוב ושימוש" subtitle="מדדי שימוש ותמחור עתידי" />}

        {loading ? (
          <div style={styles.loading}>
            <LoadingSpinner />
          </div>
        ) : !data ? null : (
          <>
            <div
              style={{
                ...styles.kpiGrid,
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              }}
            >
              <KpiCard label="טיקטים החודש" value={data.ticketsThisMonth} accent="primary" />
              <KpiCard label="דיירים (סה״כ ברשומה)" value={data.residentsTotal} accent="success" />
              <KpiCard label="עובדים פעילים" value={data.workersActive} />
            </div>

            <Card noPadding style={{ marginTop: '20px' }}>
              <div style={styles.cardPad}>
                <h2 style={styles.h2}>טיקטים לפי שבוע (8 שבועות אחרונים)</h2>
                <div style={styles.chartRow}>
                  {data.ticketsByWeek.length === 0 ? (
                    <p style={styles.muted}>אין נתונים בתקופה</p>
                  ) : (
                    data.ticketsByWeek.map((w) => (
                      <div key={w.week_start} style={styles.barCol}>
                        <div style={styles.barTrack}>
                          <div
                            style={{
                              ...styles.barFill,
                              height: `${Math.max(6, (w.count / maxWeek) * 100)}%`,
                            }}
                            title={`${w.count}`}
                          />
                        </div>
                        <span style={styles.barLabel}>{w.week_start.slice(5)}</span>
                        <span style={styles.barCount}>{w.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <Card noPadding style={{ marginTop: '16px' }}>
              <div style={styles.cardPad}>
                <p style={styles.note}>
                  חיוב חודשי מחושב לפי תוכנית — כאן מוצגים נתוני שימוש בלבד. תמחור וחשבוניות יתווספו בהמשך.
                </p>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: {
    padding: '32px 40px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  loading: { padding: '64px', display: 'flex', justifyContent: 'center' },
  kpiGrid: { display: 'grid', gap: '16px' },
  cardPad: { padding: '20px 24px' },
  h2: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 16px',
    color: theme.colors.textPrimary,
  },
  chartRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    minHeight: '140px',
    flexWrap: 'wrap',
  },
  barCol: {
    flex: '1 1 40px',
    minWidth: '36px',
    maxWidth: '56px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  barTrack: {
    width: '100%',
    height: '100px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    background: theme.colors.muted,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    background: theme.colors.primary,
    borderRadius: `${theme.radius.sm} ${theme.radius.sm} 0 0`,
    minHeight: '4px',
    transition: 'height 0.2s ease',
  },
  barLabel: { fontSize: '10px', color: theme.colors.textMuted },
  barCount: { fontSize: '12px', fontWeight: 600, color: theme.colors.textPrimary },
  muted: { color: theme.colors.textMuted, fontSize: '14px' },
  note: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.55,
    color: theme.colors.textSecondary,
  },
}
