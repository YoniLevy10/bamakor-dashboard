'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/lib/error-handler'
import {
  AppShell,
  MobileHeader,
  MobileMenu,
  PageHeader,
  Card,
  Button,
  LoadingSpinner,
  theme,
} from '../components/ui'

type Item = {
  id: string
  project_id: string
  ticket_id: string | null
  reporter_phone_normalized: string
  created_at: string
  project_name: string
  project_code: string
  ticket_number?: number
}

function displayPhone(digits: string) {
  const d = digits.replace(/\D/g, '')
  if (d.startsWith('972')) return `+${d}`
  if (d.startsWith('0')) return `+972${d.slice(1)}`
  return d ? `+${d}` : '—'
}

export default function PendingResidentsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [names, setNames] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pending-residents')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'טעינה נכשלה')
      setItems((data.items as Item[]) || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'טעינה נכשלה')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function approve(id: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/pending-residents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'approve',
          full_name: names[id]?.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'פעולה נכשלה')
      toast.success('הדייר נוסף לרשימת הדיירים')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'פעולה נכשלה')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/pending-residents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'פעולה נכשלה')
      toast.success('הבקשה סומנה כנדחית')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'פעולה נכשלה')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="דיירים לאישור"
          subtitle="פניות מוואטסאפ ללא רישום בבניין"
          onMenuClick={() => setMenuOpen(true)}
        />
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '16px 14px 32px' : '24px 28px 48px' }}>
        {!isMobile && (
          <PageHeader
            title="דיירים לאישור"
            subtitle="כשדייר מדווח על תקלה בוואטסאפ והטלפון שלו לא מופיע ברשימת הדיירים של אותו פרויקט, הבקשה מגיעה לכאן. אחרי אישור (למשל שרה) הדייר יתווסף לדף דיירים."
          />
        )}

        <Card style={{ padding: isMobile ? 14 : 20 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <LoadingSpinner />
            </div>
          ) : items.length === 0 ? (
            <p style={{ margin: 0, color: theme.colors.textMuted, lineHeight: 1.6 }}>
              אין כרגע בקשות ממתינות.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {items.map((row) => (
                <div
                  key={row.id}
                  style={{
                    borderBottom: `1px solid ${theme.colors.border}`,
                    paddingBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{row.project_name}</div>
                  <div style={{ fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 }}>
                    קוד: {row.project_code || '—'} · טלפון: {displayPhone(row.reporter_phone_normalized)}
                    {row.ticket_number != null ? ` · תקלה #${row.ticket_number}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: theme.colors.textMuted, marginBottom: 12 }}>
                    נוצר: {new Date(row.created_at).toLocaleString('he-IL')}
                  </div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                    שם מלא לרישום (אופציונלי)
                    <input
                      value={names[row.id] || ''}
                      onChange={(e) => setNames((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="דייר (אושר מהוואטסאפ)"
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: 320,
                        marginTop: 6,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1px solid ${theme.colors.border}`,
                        fontSize: 14,
                      }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <Button
                      variant="primary"
                      disabled={busyId === row.id}
                      onClick={() => void approve(row.id)}
                    >
                      {busyId === row.id ? 'מעבד…' : 'אשר והוסף לדיירים'}
                    </Button>
                    <Button variant="secondary" disabled={busyId === row.id} onClick={() => void reject(row.id)}>
                      דחה
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
