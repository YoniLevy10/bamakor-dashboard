'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/error-handler'
import { AddResidentModal, type ResidentProjectRow } from '../components/residents/AddResidentModal'
import { ImportResidentsModal } from '../components/residents/ImportResidentsModal'
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
import { getIsMobileViewport } from '@/lib/mobile-viewport'

function mainTabStyle(active: boolean): CSSProperties {
  return {
    padding: '10px 18px',
    borderRadius: theme.radius.md,
    border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
    background: active ? theme.colors.primaryMuted : theme.colors.surface,
    color: active ? theme.colors.primaryText : theme.colors.textSecondary,
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  }
}

type ResidentRow = {
  id: string
  project_id: string
  client_id?: string | null
  full_name: string
  phone: string | null
  apartment_number: string | null
  notes?: string | null
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
  const [projects, setProjects] = useState<ResidentProjectRow[]>([])
  const [residents, setResidents] = useState<ResidentRow[]>([])
  const [residentsTableMissing, setResidentsTableMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [editResidentId, setEditResidentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingResident, setDeletingResident] = useState(false)
  const [addError, setAddError] = useState('')
  const [addProjectId, setAddProjectId] = useState('')
  const [addFullName, setAddFullName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addApartment, setAddApartment] = useState('')
  const [addNotes, setAddNotes] = useState('')

  const [importOpen, setImportOpen] = useState(false)

  const [mainTab, setMainTab] = useState<'active' | 'pending'>('active')
  const [pendingItems, setPendingItems] = useState<
    Array<{
      id: string
      project_id: string
      reporter_phone_normalized: string
      created_at: string
      project_name: string
      project_code: string
      ticket_number?: number
    }>
  >([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [pendingBadge, setPendingBadge] = useState(0)
  const [pendingNames, setPendingNames] = useState<Record<string, string>>({})
  const [pendingBusyId, setPendingBusyId] = useState<string | null>(null)

  async function loadPending() {
    setPendingLoading(true)
    try {
      const res = await fetch('/api/pending-residents')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'טעינה נכשלה')
      const items = (data.items as typeof pendingItems) || []
      setPendingItems(items)
      setPendingBadge(items.length)
    } catch {
      setPendingItems([])
      setPendingBadge(0)
    } finally {
      setPendingLoading(false)
    }
  }

  async function load() {
    setLoading(true)
    setResidentsTableMissing(false)
    try {
      const pRes = await supabase
        .from('projects')
        .select('id, name, project_code, client_id')
        .order('name')
      if (pRes.error) throw pRes.error
      setProjects((pRes.data as ResidentProjectRow[]) || [])

      const rRes = await supabase
        .from('residents')
        .select('id, project_id, client_id, full_name, phone, apartment_number, notes')
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
    void loadPending()
  }

  function openAdd() {
    setEditResidentId(null)
    setAddError('')
    setAddFullName('')
    setAddPhone('')
    setAddApartment('')
    setAddNotes('')
    setAddProjectId(projectFilter !== 'ALL' ? projectFilter : '')
    setAddOpen(true)
  }

  function openEdit(r: ResidentRow) {
    setEditResidentId(r.id)
    setAddError('')
    setAddProjectId(r.project_id)
    setAddFullName(r.full_name)
    setAddPhone(r.phone?.trim() || '')
    setAddApartment(r.apartment_number?.trim() || '')
    setAddNotes(r.notes?.trim() || '')
    setAddOpen(true)
  }

  function closeResidentModal() {
    setAddOpen(false)
    setEditResidentId(null)
    setAddError('')
  }

  function openImport() {
    setImportOpen(true)
  }

  async function deleteResident() {
    if (residentsTableMissing || !editResidentId) return
    const name = addFullName.trim() || 'הדייר'
    if (!window.confirm(`למחוק את ${name} מהרשימה? הפעולה לא ניתנת לשחזור.`)) return

    setDeletingResident(true)
    setAddError('')
    try {
      const { error } = await supabase.from('residents').delete().eq('id', editResidentId)
      if (error) throw error
      setResidents((prev) => prev.filter((x) => x.id !== editResidentId))
      closeResidentModal()
      toast.success('הדייר נמחק')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'מחיקת דייר נכשלה')
    } finally {
      setDeletingResident(false)
    }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (residentsTableMissing) return

    const projectId = addProjectId
    const fullName = addFullName.trim()
    if (!projectId) {
      setAddError('בחרו בניין')
      return
    }
    if (!fullName) {
      setAddError('שם מלא הוא שדה חובה')
      return
    }

    const project = projects.find((p) => p.id === projectId)
    const clientId = project?.client_id ?? null

    setSaving(true)
    setAddError('')
    try {
      if (editResidentId) {
        const updateRes = await supabase
          .from('residents')
          .update({
            project_id: projectId,
            client_id: clientId,
            full_name: fullName,
            phone: addPhone.trim() || null,
            apartment_number: addApartment.trim() || null,
            notes: addNotes.trim() || null,
          })
          .eq('id', editResidentId)
          .select('id, project_id, client_id, full_name, phone, apartment_number, notes')
          .single()

        if (updateRes.error) {
          setAddError(updateRes.error.message || 'עדכון דייר נכשל')
          return
        }

        const row = updateRes.data as ResidentRow
        setResidents((prev) => prev.map((x) => (x.id === row.id ? row : x)))
        closeResidentModal()
        toast.success('הדייר עודכן')
        return
      }

      const insertRes = await supabase
        .from('residents')
        .insert({
          project_id: projectId,
          client_id: clientId,
          full_name: fullName,
          phone: addPhone.trim() || null,
          apartment_number: addApartment.trim() || null,
          notes: addNotes.trim() || null,
        })
        .select('id, project_id, client_id, full_name, phone, apartment_number, notes')
        .single()

      if (insertRes.error) {
        setAddError(insertRes.error.message || 'שמירת דייר נכשלה')
        return
      }

      setResidents((prev) => [insertRes.data as ResidentRow, ...prev])
      closeResidentModal()
      toast.success('דייר נוסף בהצלחה')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'שמירת דייר נכשלה')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const check = () => setIsMobile(getIsMobileViewport())
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial residents list
    void load()
  }, [])

  useEffect(() => {
    if (mainTab === 'pending') {
      void loadPending()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPending is stable enough for tab refresh
  }, [mainTab])

  function displayPendingPhone(digits: string) {
    const d = digits.replace(/\D/g, '')
    if (d.startsWith('972')) return `+${d}`
    if (d.startsWith('0')) return `+972${d.slice(1)}`
    return d ? `+${d}` : '—'
  }

  async function approvePending(id: string) {
    setPendingBusyId(id)
    try {
      const res = await fetch('/api/pending-residents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'approve',
          full_name: pendingNames[id]?.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error([data.error, data.hint].filter(Boolean).join('\n') || 'פעולה נכשלה')
      toast.success('הדייר אושר')
      await loadPending()
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'פעולה נכשלה')
    } finally {
      setPendingBusyId(null)
    }
  }

  async function rejectPending(id: string) {
    setPendingBusyId(id)
    try {
      const res = await fetch('/api/pending-residents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error([data.error, data.hint].filter(Boolean).join('\n') || 'פעולה נכשלה')
      toast.success('הבקשה נדחתה')
      await loadPending()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'פעולה נכשלה')
    } finally {
      setPendingBusyId(null)
    }
  }

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
        (r.apartment_number || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
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
            title="דיירים"
            subtitle="ניהול שמות דיירים לפי בניין (לאחר הרצת מיגרציה ב-Supabase)"
            actions={
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openImport}
                  disabled={residentsTableMissing}
                >
                  ייבוא דיירים
                </Button>
                <Button variant="primary" size="sm" onClick={openAdd} disabled={residentsTableMissing}>
                  הוספת דייר
                </Button>
              </div>
            }
          />
        )}

        <Card noPadding>
          <div className="app-error-log-tabs" style={styles.mainTabs}>
            <button
              type="button"
              style={mainTabStyle(mainTab === 'active')}
              onClick={() => setMainTab('active')}
            >
              פעילים
            </button>
            <button
              type="button"
              style={mainTabStyle(mainTab === 'pending')}
              onClick={() => setMainTab('pending')}
            >
              ממתינים לאישור
              {pendingBadge > 0 && <span style={styles.pendingBadge}>{pendingBadge}</span>}
            </button>
          </div>

          {mainTab === 'pending' ? (
            <div style={styles.pendingWrap}>
              {pendingLoading ? (
                <div style={styles.loading}>
                  <LoadingSpinner />
                </div>
              ) : pendingItems.length === 0 ? (
                <p style={styles.empty}>אין בקשות ממתינות.</p>
              ) : (
                <div style={styles.pendingList}>
                  {pendingItems.map((p) => (
                    <div key={p.id} style={styles.pendingCard}>
                      <div style={styles.pendingRow}>
                        <span style={styles.pendingLabel}>טלפון</span>
                        <span>{displayPendingPhone(p.reporter_phone_normalized)}</span>
                      </div>
                      <div style={styles.pendingRow}>
                        <span style={styles.pendingLabel}>פרויקט</span>
                        <span>
                          {p.project_name} ({p.project_code})
                        </span>
                      </div>
                      {p.ticket_number != null && (
                        <div style={styles.pendingRow}>
                          <span style={styles.pendingLabel}>תקלה</span>
                          <span>#{p.ticket_number}</span>
                        </div>
                      )}
                      <label style={styles.pendingNameLab}>שם דייר (לאישור)</label>
                      <input
                        value={pendingNames[p.id] || ''}
                        onChange={(e) =>
                          setPendingNames((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        placeholder="שם מלא"
                        style={styles.pendingInput}
                      />
                      <div style={styles.pendingActions}>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={pendingBusyId === p.id}
                          onClick={() => approvePending(p.id)}
                        >
                          אישור
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={pendingBusyId === p.id}
                          onClick={() => rejectPending(p.id)}
                        >
                          דחייה
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
          <div style={styles.filters}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="חיפוש לפי שם, טלפון, דירה, הערות..."
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
            <Button variant="secondary" size="sm" onClick={openImport} disabled={residentsTableMissing}>
              ייבוא דיירים
            </Button>
            <Button variant="primary" size="sm" onClick={openAdd} disabled={residentsTableMissing}>
              הוספת דייר
            </Button>
          </div>

          {loading ? (
            <div style={styles.loading}>
              <LoadingSpinner />
            </div>
          ) : residentsTableMissing ? (
            <div style={styles.friendlyEmpty}>
              <p style={styles.friendlyEmptyTitle}>טבלת הדיירים עדיין לא הוגדרה במערכת.</p>
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
                    <th style={styles.th}>הערות</th>
                    <th style={{ ...styles.th, width: '100px' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.full_name}</td>
                      <td style={styles.td}>{r.phone || '—'}</td>
                      <td style={styles.td}>{r.apartment_number || '—'}</td>
                      <td style={styles.td}>{projectName[r.project_id] || '—'}</td>
                      <td style={{ ...styles.td, maxWidth: '220px', color: theme.colors.textSecondary }}>
                        {r.notes ? (
                          <span title={r.notes}>
                            {r.notes.length > 80 ? `${r.notes.slice(0, 80)}…` : r.notes}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={styles.td}>
                        <Button variant="secondary" size="sm" type="button" onClick={() => openEdit(r)}>
                          עריכה
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p style={styles.empty}>אין דיירים להצגה. הוסיפו רשומות ב-Supabase.</p>
              )}
            </div>
          )}
            </>
          )}
        </Card>
      </div>

      <AddResidentModal
        open={addOpen}
        onClose={closeResidentModal}
        isMobile={isMobile}
        projects={projects}
        projectId={addProjectId}
        fullName={addFullName}
        phone={addPhone}
        apartmentNumber={addApartment}
        notes={addNotes}
        error={addError}
        loading={saving}
        variant={editResidentId ? 'edit' : 'add'}
        onDelete={editResidentId ? deleteResident : undefined}
        deleteLoading={deletingResident}
        onProjectIdChange={setAddProjectId}
        onFullNameChange={setAddFullName}
        onPhoneChange={setAddPhone}
        onApartmentNumberChange={setAddApartment}
        onNotesChange={setAddNotes}
        onSubmit={submitAdd}
      />

      <ImportResidentsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        isMobile={isMobile}
        projects={projects}
        defaultProjectId={projectFilter !== 'ALL' ? projectFilter : ''}
        onImported={(newRows) => {
          setResidents((prev) => [...(newRows as ResidentRow[]), ...prev])
        }}
      />
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: { padding: '32px 40px', maxWidth: '1200px', margin: '0 auto' },
  mainTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  pendingBadge: {
    background: theme.colors.warning,
    color: '#fff',
    fontSize: '11px',
    minWidth: '22px',
    height: '22px',
    borderRadius: '11px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 7px',
  },
  pendingWrap: { padding: '0 0 8px' },
  pendingList: { padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  pendingCard: {
    padding: '16px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.muted,
  },
  pendingRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', fontSize: '14px' },
  pendingLabel: { color: theme.colors.textMuted, fontWeight: 600 },
  pendingNameLab: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textSecondary,
    marginTop: '8px',
    marginBottom: '6px',
  },
  pendingInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: '15px',
    marginBottom: '12px',
    boxSizing: 'border-box',
  },
  pendingActions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
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
