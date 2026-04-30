'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
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
import { getIsMobileViewport } from '@/lib/mobile-viewport'

type Row = {
  id: string
  created_at: string
  context: string
  message: string
  details: Record<string, unknown> | null
  resolved: boolean
  whatsapp_attempts?: number | null
}

type Filter = 'all' | 'unresolved' | 'resolved'

function isMissingTable(err: { message?: string } | null): boolean {
  if (!err?.message) return false
  const m = err.message.toLowerCase()
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('error_logs')
}

export default function ErrorLogsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [missing, setMissing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unresolvedCount, setUnresolvedCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setMissing(false)
    try {
      const { count: openCount } = await supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false)
      setUnresolvedCount(openCount ?? 0)

      let q = supabase.from('error_logs').select('*').order('created_at', { ascending: false }).limit(500)
      if (filter === 'unresolved') q = q.eq('resolved', false)
      if (filter === 'resolved') q = q.eq('resolved', true)
      const { data, error } = await q
      if (error) {
        if (isMissingTable(error)) {
          setRows([])
          setMissing(true)
        } else {
          toast.error(error.message)
        }
        return
      }
      setRows((data as Row[]) || [])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    const check = () => setIsMobile(getIsMobileViewport())
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function markResolved(id: string) {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, resolved: true } : r)))
      toast.success('סומן כטופל')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'עדכון נכשל')
    } finally {
      setBusyId(null)
    }
  }

  async function deleteAllResolved() {
    if (!window.confirm('למחוק את כל הרשומות שסומנו כטופלו?')) return
    setBulkBusy(true)
    try {
      const { error } = await supabase.from('error_logs').delete().eq('resolved', true)
      if (error) throw error
      toast.success('נמחקו רשומות שטופלו')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'מחיקה נכשלה')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="יומן שגיאות"
          subtitle={missing ? 'טבלה לא מוגדרת' : `${rows.length} רשומות`}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div
        style={{
          ...styles.content,
          ...(isMobile
            ? { padding: '16px 16px 8px', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }
            : {}),
        }}
      >
        {!isMobile && (
          <PageHeader
            title="יומן שגיאות"
            subtitle="שגיאות מערכת, כולל שליחות וואטסאפ שנכשלו"
            actions={
              <Button variant="danger" size="sm" onClick={deleteAllResolved} loading={bulkBusy} disabled={missing}>
                מחק כל הטופלו
              </Button>
            }
          />
        )}

        <div className="app-error-log-tabs" style={styles.tabs}>
          <button
            type="button"
            style={tabStyle(filter === 'all')}
            onClick={() => setFilter('all')}
          >
            הכל
          </button>
          <button
            type="button"
            style={tabStyle(filter === 'unresolved')}
            onClick={() => setFilter('unresolved')}
          >
            לא טופלו
            {unresolvedCount > 0 && <span style={styles.badge}>{unresolvedCount}</span>}
          </button>
          <button
            type="button"
            style={tabStyle(filter === 'resolved')}
            onClick={() => setFilter('resolved')}
          >
            טופלו
          </button>
        </div>

        {isMobile && (
          <div style={{ marginBottom: '12px' }}>
            <Button variant="danger" size="sm" onClick={deleteAllResolved} loading={bulkBusy} disabled={missing}>
              מחק כל הטופלו
            </Button>
          </div>
        )}

        <Card noPadding>
          {loading ? (
            <div style={styles.loading}>
              <LoadingSpinner />
            </div>
          ) : missing ? (
            <p style={styles.empty}>הריצו את המיגרציה supabase/migrations/020_saas_audit_features.sql ב-Supabase.</p>
          ) : rows.length === 0 ? (
            <p style={styles.empty}>אין רשומות להצגה.</p>
          ) : (
            <div style={styles.list}>
              {rows.map((r) => (
                <div key={r.id} style={styles.item}>
                  <div style={styles.itemTop}>
                    <span style={styles.ctx}>{r.context}</span>
                    <span style={styles.date}>
                      {new Date(r.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <pre style={styles.msg}>{r.message}</pre>
                  {r.whatsapp_attempts != null && r.context === 'whatsapp_send' && (
                    <div style={styles.meta}>ניסיונות שליחה: {r.whatsapp_attempts}</div>
                  )}
                  {!r.resolved && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyId === r.id}
                      onClick={() => markResolved(r.id)}
                    >
                      סמן כטופל
                    </Button>
                  )}
                  {r.resolved && <span style={styles.ok}>טופל</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
    background: active ? theme.colors.primaryMuted : theme.colors.surface,
    color: active ? theme.colors.primary : theme.colors.textSecondary,
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  }
}

const styles: Record<string, CSSProperties> = {
  content: { padding: '32px 40px', maxWidth: '960px', margin: '0 auto' },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' },
  badge: {
    background: theme.colors.warning,
    color: '#fff',
    fontSize: '11px',
    minWidth: '20px',
    height: '20px',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
  },
  loading: { padding: '48px', display: 'flex', justifyContent: 'center' },
  empty: { padding: '32px', textAlign: 'center', color: theme.colors.textMuted },
  list: { display: 'flex', flexDirection: 'column', gap: '0' },
  item: {
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  itemTop: { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  ctx: { fontSize: '13px', fontWeight: 600, color: theme.colors.primary },
  date: { fontSize: '12px', color: theme.colors.textMuted },
  msg: {
    margin: 0,
    fontSize: '13px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'inherit',
    color: theme.colors.textPrimary,
    lineHeight: 1.5,
  },
  meta: { fontSize: '12px', color: theme.colors.textMuted },
  ok: { fontSize: '13px', color: theme.colors.success, fontWeight: 600 },
}
