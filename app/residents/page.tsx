'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/error-handler'
import {
  AppShell,
  MobileHeader,
  MobileMenu,
  PageHeader,
  Card,
  Button,
  SearchInput,
  LoadingSpinner,
  theme,
} from '../components/ui'

type ProjectRow = { id: string; name: string; project_code: string }

type ResidentRow = {
  id: string
  project_id: string
  full_name: string
  phone: string | null
  apartment_number: string | null
}

function isResidentsTableMissingError(err: { message?: string } | null): boolean {
  if (!err?.message) return false
  const m = err.message.toLowerCase()
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find') ||
    (m.includes('relation') && m.includes('residents'))
  )
}

export default function ResidentsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [residents, setResidents] = useState<ResidentRow[]>([])
  const [residentsTableMissing, setResidentsTableMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  async function load() {
    setLoading(true)
    setResidentsTableMissing(false)
    try {
      const pRes = await supabase.from('projects').select('id, name, project_code').order('name')
      if (pRes.error) throw pRes.error
      setProjects((pRes.data as ProjectRow[]) || [])

      const rRes = await supabase
        .from('residents')
        .select('id, project_id, full_name, phone, apartment_number')
        .order('full_name')

      if (rRes.error) {
        if (isResidentsTableMissingError(rRes.error)) {
          setResidents([])
          setResidentsTableMissing(true)
        } else {
          toast.error(rRes.error.message || 'טעינת דיירים נכשלה')
        }
      } else {
        setResidents((rRes.data as ResidentRow[]) || [])
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'טעינת נתונים נכשלה')
    }
    setLoading(false)
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial residents list
    void load()
  }, [])

  const projectName = useMemo(() => {
    const m: Record<string, string> = {}
    projects.forEach((p) => {
      m[p.id] = p.name
    })
    return m
  }, [projects])

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return residents.filter((r) => {
      const byProject = projectFilter === 'ALL' || r.project_id === projectFilter
      const text =
        !q ||
        r.full_name.toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        (r.apartment_number || '').toLowerCase().includes(q)
      return byProject && text
    })
  }, [residents, searchTerm, projectFilter])

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="דיירים"
          subtitle={`${filtered.length} רשומות`}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="דיירים"
            subtitle="ניהול שמות דיירים לפי בניין (לאחר הרצת מיגרציה ב-Supabase)"
          />
        )}

        <Card noPadding>
          <div style={styles.filters}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="חיפוש לפי שם, טלפון, דירה..."
              style={{ flex: 1, maxWidth: '360px' }}
            />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={styles.select}
            >
              <option value="ALL">כל הבניינים</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={() => load()}>
              רענון
            </Button>
          </div>

          {loading ? (
            <div style={styles.loading}>
              <LoadingSpinner />
            </div>
          ) : residentsTableMissing ? (
            <div style={styles.friendlyEmpty}>
              <p style={styles.friendlyEmptyTitle}>טבלת דיירים עדיין לא מוגדרת</p>
              <p style={styles.friendlyEmptyText}>
                הריצו את מיגרציית ה-SQL ב-Supabase (קובץ `supabase/migrations/003_residents_table.sql`) כדי ליצור את
                הטבלה `residents`. לאחר מכן רעננו את הדף.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>שם</th>
                    <th style={styles.th}>טלפון</th>
                    <th style={styles.th}>דירה</th>
                    <th style={styles.th}>בניין</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.full_name}</td>
                      <td style={styles.td}>{r.phone || '—'}</td>
                      <td style={styles.td}>{r.apartment_number || '—'}</td>
                      <td style={styles.td}>{projectName[r.project_id] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p style={styles.empty}>אין דיירים להצגה. הוסיפו רשומות ב-Supabase.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: { padding: '32px 40px', maxWidth: '1200px', margin: '0 auto' },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  select: {
    padding: '10px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: '15px',
    minWidth: '200px',
  },
  loading: { padding: '48px', display: 'flex', justifyContent: 'center' },
  tableWrap: { padding: '0 0 24px', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'start',
    padding: '12px 20px',
    fontSize: '12px',
    fontWeight: 600,
    color: theme.colors.textMuted,
    background: theme.colors.muted,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  td: {
    padding: '14px 20px',
    fontSize: '14px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  empty: { padding: '32px 24px', color: theme.colors.textMuted, textAlign: 'center' },
  friendlyEmpty: {
    padding: '48px 28px',
    textAlign: 'center',
    maxWidth: '520px',
    margin: '0 auto',
  },
  friendlyEmptyTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: '0 0 12px',
  },
  friendlyEmptyText: {
    fontSize: '15px',
    color: theme.colors.textSecondary,
    lineHeight: 1.6,
    margin: 0,
  },
}
