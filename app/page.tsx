'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'
import { 
  AppShell, 
  MobileHeader, 
  MobileMenu, 
  KpiCard,
  Card,
  Button,
  StatusBadge,
  LoadingSpinner,
  theme 
} from './components/ui'
import { TicketDetailDrawer } from './components/tickets/TicketDetailDrawer'
import { AddTicketModal } from './components/tickets/AddTicketModal'

type TicketRow = {
  id: string
  ticket_number: number
  project_id?: string
  project_code?: string
  project_name?: string
  reporter_phone: string
  description: string
  status: string
  priority?: string
  assigned_worker_id: string | null
  created_at: string
  closed_at: string | null
}

type TicketLog = {
  id: string
  ticket_id: string
  action_type: string
  old_value: string | null
  new_value: string | null
  performed_by: string | null
  notes: string | null
  created_at: string
}

type ProjectRow = {
  id: string
  name: string
  project_code: string
}

type AttachmentRow = {
  id: string
  ticket_id: string
  file_name: string
  file_url: string | null
  file_size?: number | null
  mime_type: string
  created_at: string
  signed_url?: string | null
}

type TicketWithProjects = TicketRow & {
  projects?: Array<{ project_code: string; name: string }> | { project_code: string; name: string }
}

export default function DashboardPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [workersMap, setWorkersMap] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null)
  const [ticketLogs, setTicketLogs] = useState<TicketLog[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [savingTicket, setSavingTicket] = useState(false)
  const [draftDescription, setDraftDescription] = useState('')
  const [draftStatus, setDraftStatus] = useState('NEW')
  const [draftWorkerId, setDraftWorkerId] = useState('')
  const [selectedTicketAttachments, setSelectedTicketAttachments] = useState<AttachmentRow[]>([])
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  const [showAddTicketModal, setShowAddTicketModal] = useState(false)
  const [addTicketProjectCode, setAddTicketProjectCode] = useState('')
  const [addTicketDescription, setAddTicketDescription] = useState('')
  const [addTicketReporterName, setAddTicketReporterName] = useState('')
  const [addTicketReporterPhone, setAddTicketReporterPhone] = useState('')
  const [addingTicket, setAddingTicket] = useState(false)
  const [addTicketError, setAddTicketError] = useState('')

  const [activeKpi, setActiveKpi] = useState<'ALL' | 'NEW' | 'IN_PROGRESS' | 'CLOSED'>('ALL')

  type ActivityItem = {
    id: string
    type: 'created' | 'updated' | 'closed'
    ticket_number: number
    project_label: string
    description: string
    time: string
  }

  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    await asyncHandler(
      async () => {
        const [ticketsResult, projectsResult, workersResult, logsResult] = await Promise.all([
          supabase
            .from('tickets')
            .select(`
              id, ticket_number, project_id, reporter_phone, description, 
              status, priority, assigned_worker_id, created_at, closed_at,
              projects (project_code, name)
            `)
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, name, project_code')
            .order('project_code', { ascending: true }),
          supabase
            .from('workers')
            .select('id, full_name')
            .order('full_name', { ascending: true }),
          supabase
            .from('ticket_logs')
            .select(
              `
              id, action_type, created_at,
              tickets (
                ticket_number,
                description,
                status,
                projects (name, project_code)
              )
            `
            )
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        if (ticketsResult.error) throw ticketsResult.error
        if (projectsResult.error) throw projectsResult.error
        if (workersResult.error) throw workersResult.error

        const formatted: TicketRow[] = (ticketsResult.data || []).map((row: TicketWithProjects) => ({
          id: row.id,
          ticket_number: row.ticket_number,
          project_id: row.project_id,
          project_code: Array.isArray(row.projects) ? row.projects?.[0]?.project_code || '' : row.projects?.project_code || '',
          project_name: Array.isArray(row.projects) ? row.projects?.[0]?.name || '' : row.projects?.name || '',
          reporter_phone: row.reporter_phone,
          description: row.description,
          status: row.status,
          priority: row.priority,
          assigned_worker_id: row.assigned_worker_id,
          created_at: row.created_at,
          closed_at: row.closed_at,
        }))

        setTickets(formatted)
        setProjects(projectsResult.data || [])

        const map: Record<string, string> = {}
        workersResult.data?.forEach((worker: { id: string; full_name: string }) => {
          map[worker.id] = worker.full_name
        })
        setWorkersMap(map)

        const fromLogs = buildActivityFromLogs(logsResult.data, logsResult.error)
        if (fromLogs.length > 0) {
          setRecentActivity(fromLogs)
        } else {
          setRecentActivity(
            formatted.slice(0, 5).map((ticket) => ({
              id: ticket.id,
              type:
                ticket.status === 'CLOSED' ? 'closed' : ticket.status === 'NEW' ? 'created' : 'updated',
              ticket_number: ticket.ticket_number,
              project_label: ticket.project_name || ticket.project_code || '',
              description: ticket.description,
              time: formatRelativeTime(ticket.created_at),
            }))
          )
        }
        return true
      },
      { context: 'Failed to load dashboard data', showErrorToast: true }
    )
    setLoading(false)
  }

  function buildActivityFromLogs(
    data: unknown,
    err: { message?: string } | null
  ): ActivityItem[] {
    if (err || !Array.isArray(data)) return []
    const items: ActivityItem[] = []
    for (const row of data) {
      const log = row as {
        id: string
        action_type?: string | null
        created_at?: string
        tickets?:
          | {
              ticket_number?: number
              description?: string | null
              status?: string
              projects?: { name?: string; project_code?: string } | { name?: string; project_code?: string }[]
            }
          | Array<{
              ticket_number?: number
              description?: string | null
              status?: string
              projects?: { name?: string; project_code?: string } | { name?: string; project_code?: string }[]
            }>
      }
      const rawT = log.tickets
      const ticket = Array.isArray(rawT) ? rawT[0] : rawT
      if (!ticket || !log.created_at) continue
      const proj = ticket.projects
      const p = Array.isArray(proj) ? proj[0] : proj
      const project_label = p?.name || p?.project_code || ''
      const at = (log.action_type || '').toUpperCase()
      let type: ActivityItem['type'] = 'updated'
      if (at.includes('CLOSE') || ticket.status === 'CLOSED') type = 'closed'
      else if (at.includes('CREAT') || at.includes('OPEN') || at.includes('NEW')) type = 'created'
      items.push({
        id: log.id,
        type,
        ticket_number: ticket.ticket_number ?? 0,
        project_label,
        description: ticket.description || '',
        time: formatRelativeTime(log.created_at),
      })
    }
    return items
  }

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'NEW').length
    const inProgress = tickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length
    const closed = tickets.filter((t) => t.status === 'CLOSED').length
    return { total, open, inProgress, closed }
  }, [tickets])

  const filteredTickets = useMemo(() => {
    let filtered = tickets
    if (activeKpi === 'NEW') filtered = tickets.filter((t) => t.status === 'NEW')
    else if (activeKpi === 'IN_PROGRESS') filtered = tickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS')
    else if (activeKpi === 'CLOSED') filtered = tickets.filter((t) => t.status === 'CLOSED')
    return filtered.slice(0, 8)
  }, [tickets, activeKpi])

  const projectStats = useMemo(() => {
    return projects.map((project) => {
      const projectTickets = tickets.filter((t) => t.project_code === project.project_code)
      const open = projectTickets.filter((t) => t.status !== 'CLOSED').length
      const total = projectTickets.length
      const progress = total > 0 ? Math.round(((total - open) / total) * 100) : 0
      return { ...project, open, total, progress }
    }).filter(p => p.total > 0).sort((a, b) => b.open - a.open).slice(0, 6)
  }, [projects, tickets])

  function formatRelativeTime(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    if (diffMins < 1) return 'עכשיו'
    if (diffMins < 60) return `לפני ${diffMins} דק׳`
    if (diffHours < 24) return `לפני ${diffHours} שע׳`
    if (diffDays < 7) return `לפני ${diffDays} ימים`
    return date.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })
  }

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'בוקר טוב'
    if (hour < 18) return 'צהריים טובים'
    return 'ערב טוב'
  }

  function formatDate() {
    return new Date().toLocaleDateString('he-IL', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  function getImageUrl(attachment: AttachmentRow): string {
    return attachment.signed_url || attachment.file_url || ''
  }

  async function loadTicketLogs(ticketId: string) {
    setDrawerLoading(true)
    const { data } = await supabase
      .from('ticket_logs')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
    setTicketLogs((data as TicketLog[]) || [])
    setDrawerLoading(false)
  }

  async function loadTicketAttachments(ticketId: string) {
    try {
      const { data } = await supabase
        .from('ticket_attachments')
        .select('id, ticket_id, file_name, file_url, mime_type, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        const attachmentsWithUrls = await Promise.all(
          data.map(async (attachment: AttachmentRow) => {
            try {
              const { data: signedUrlData } = await supabase.storage
                .from('ticket-attachments')
                .createSignedUrl(attachment.file_url || '', 3600)
              return { ...attachment, signed_url: signedUrlData?.signedUrl || null }
            } catch {
              return { ...attachment, signed_url: null }
            }
          })
        )
        setSelectedTicketAttachments(attachmentsWithUrls)
      } else {
        setSelectedTicketAttachments([])
      }
    } catch {
      setSelectedTicketAttachments([])
    }
  }

  function openTicket(ticket: TicketRow) {
    setSelectedTicket(ticket)
    setDraftDescription(ticket.description || '')
    setDraftStatus(ticket.status)
    setDraftWorkerId(ticket.assigned_worker_id || '')
    loadTicketLogs(ticket.id)
    loadTicketAttachments(ticket.id)
  }

  function closeDrawer() {
    setSelectedTicket(null)
    setDraftDescription('')
    setDraftStatus('NEW')
    setDraftWorkerId('')
    setSelectedTicketAttachments([])
    setTicketLogs([])
  }

  async function saveSelectedTicket() {
    if (!selectedTicket) return
    setSavingTicket(true)
    await asyncHandler(
      async () => {
        const workerChanged = (selectedTicket.assigned_worker_id || '') !== (draftWorkerId || '')
        if (workerChanged && draftWorkerId) {
          await fetch('/api/assign-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_id: selectedTicket.id, worker_id: draftWorkerId }),
          })
        }
        const payload: Record<string, string | null> = {
          description: draftDescription,
          status: draftStatus,
          assigned_worker_id: draftWorkerId || null,
        }
        if (draftStatus === 'CLOSED') {
          payload.closed_at = selectedTicket.closed_at || new Date().toISOString()
        } else {
          payload.closed_at = null
        }
        const { error } = await supabase.from('tickets').update(payload).eq('id', selectedTicket.id)
        if (error) throw error
        toast.success('נשמר')
        await loadData()
        return true
      },
      { context: 'Failed to save ticket', showErrorToast: true }
    )
    setSavingTicket(false)
  }

  async function handleCloseTicket() {
    if (!selectedTicket) return
    setSavingTicket(true)
    await asyncHandler(
      async () => {
        const response = await fetch('/api/close-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: selectedTicket.id }),
        })
        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Failed to close ticket')
        }
        toast.success('התקלה נסגרה')
        await loadData()
        closeDrawer()
        return true
      },
      { context: 'Failed to close ticket', showErrorToast: true }
    )
    setSavingTicket(false)
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!addTicketProjectCode || !addTicketDescription.trim()) {
      setAddTicketError('נא למלא את כל השדות הנדרשים')
      return
    }
    setAddingTicket(true)
    setAddTicketError('')
    try {
      const formData = new FormData()
      formData.append('project_code', addTicketProjectCode)
      formData.append('description', addTicketDescription)
      if (addTicketReporterName) formData.append('reporter_name', addTicketReporterName)
      if (addTicketReporterPhone) formData.append('reporter_phone', addTicketReporterPhone)
      formData.append('source', 'manual')
      const response = await fetch('/api/create-ticket', { method: 'POST', body: formData })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to create ticket')
      }
      const result = await response.json()
      toast.success(`תקלה #${result.ticketNumber} נוצרה`)
      setAddTicketProjectCode('')
      setAddTicketDescription('')
      setAddTicketReporterName('')
      setAddTicketReporterPhone('')
      setShowAddTicketModal(false)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket'
      setAddTicketError(message)
      toast.error(message)
    }
    setAddingTicket(false)
  }

  const openTicketsCount = stats.open

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="לוח בקרה"
          subtitle={formatDate()}
          subtitleSuppressHydrationWarning
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div style={styles.heroText}>
              <h1 style={styles.heroTitle} suppressHydrationWarning>
                {getGreeting()}
              </h1>
              <p style={styles.heroDate} suppressHydrationWarning>
                {formatDate()}
              </p>
              {openTicketsCount > 0 && (
                <p style={styles.heroStatus}>
                  <span style={styles.statusDot} />
                  {openTicketsCount} תקלות פתוחות דורשות טיפול
                </p>
              )}
            </div>
            <div style={styles.heroActions}>
              <Button variant="primary" size="lg" onClick={() => setShowAddTicketModal(true)}>
                תקלה חדשה
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div style={{
              ...styles.kpiGrid,
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            }}>
              <KpiCard label="סה״כ תקלות" value={stats.total} accent="primary" onClick={() => setActiveKpi('ALL')} />
              <KpiCard label="פתוחות" value={stats.open} accent="warning" onClick={() => setActiveKpi('NEW')} />
              <KpiCard label="בטיפול" value={stats.inProgress} accent="primary" onClick={() => setActiveKpi('IN_PROGRESS')} />
              <KpiCard label="נסגרו" value={stats.closed} accent="success" onClick={() => setActiveKpi('CLOSED')} />
            </div>

            <div style={{ ...styles.mainGrid, gridTemplateColumns: isMobile ? '1fr' : '1fr 340px' }}>
              <Card
                title="סטטוס פרויקטים"
                subtitle="בניינים עם עבודה פתוחה"
                actions={
                  <Link href="/projects" style={styles.viewAllLink}>
                    הצג הכל ←
                  </Link>
                }
              >
                <div style={styles.projectList}>
                  {projectStats.length === 0 ? (
                    <p style={styles.emptyText}>אין עדיין פרויקטים עם תקלות</p>
                  ) : (
                    projectStats.map((project) => (
                      <Link href={`/tickets?project=${encodeURIComponent(project.project_code)}`} key={project.id} style={styles.projectCard}>
                        <div style={styles.projectHeader}>
                          <div>
                            <div style={styles.projectName}>{project.name}</div>
                          </div>
                          <div style={styles.projectStats}>
                            <span style={styles.projectTicketCount}>{project.open} פתוחות</span>
                          </div>
                        </div>
                        <div style={styles.progressBarContainer}>
                          <div style={styles.progressBarBg}>
                            <div style={{ ...styles.progressBarFill, width: `${project.progress}%` }} />
                          </div>
                          <span style={styles.progressLabel}>{project.progress}% הושלמו</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </Card>

              <Card title="פעילות אחרונה" subtitle="עדכוני תקלות אחרונים">
                <div style={styles.activityList}>
                  {recentActivity.map((activity) => (
                    <div key={activity.id} style={styles.activityItem}>
                      <div style={styles.activityIcon}>
                        {activity.type === 'created' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><path d="M12 8v8" /><path d="M8 12h8" />
                          </svg>
                        )}
                        {activity.type === 'closed' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                        {activity.type === 'updated' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        )}
                      </div>
                      <div style={styles.activityContent}>
                        <div style={styles.activityTitle}>
                          תקלה #{activity.ticket_number}
                          <span style={styles.activityBadge}>{activity.project_label}</span>
                        </div>
                        <div style={styles.activityDesc}>
                          {activity.description?.slice(0, 50)}{(activity.description?.length || 0) > 50 ? '...' : ''}
                        </div>
                      </div>
                      <div style={styles.activityTime}>{activity.time}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card
              title="תקלות אחרונות"
              subtitle={activeKpi === 'ALL' ? 'כל התקלות' : `מסונן לפי ${activeKpi}`}
              actions={<Link href="/tickets" style={styles.viewAllLink}>הצג הכל</Link>}
              noPadding
            >
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>בניין</th>
                      <th style={styles.th}>תיאור</th>
                      <th style={styles.th}>סטטוס</th>
                      <th style={styles.th}>משויך</th>
                      <th style={styles.th}>גיל</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.id} style={styles.tr} onClick={() => openTicket(ticket)}>
                        <td style={styles.td}><span style={styles.ticketNumber}>{ticket.ticket_number}</span></td>
                        <td style={styles.td}><span style={styles.projectBadge}>{ticket.project_name || ticket.project_code}</span></td>
                        <td style={{ ...styles.td, maxWidth: '300px' }}>
                          <span style={styles.descriptionText}>
                            {ticket.description?.slice(0, 60)}{(ticket.description?.length || 0) > 60 ? '...' : ''}
                          </span>
                        </td>
                        <td style={styles.td}><StatusBadge status={ticket.status} size="sm" /></td>
                        <td style={styles.td}>
                          <span style={styles.workerName}>
                            {ticket.assigned_worker_id ? workersMap[ticket.assigned_worker_id] || 'לא ידוע' : '—'}
                          </span>
                        </td>
                        <td style={styles.td}><span style={styles.ageText}>{formatRelativeTime(ticket.created_at)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Ticket Detail Drawer */}
      <TicketDetailDrawer
        selectedTicket={selectedTicket}
        workersMap={workersMap}
        ticketLogs={ticketLogs}
        selectedTicketAttachments={selectedTicketAttachments}
        drawerLoading={drawerLoading}
        savingTicket={savingTicket}
        draftDescription={draftDescription}
        draftStatus={draftStatus}
        draftWorkerId={draftWorkerId}
        onClose={closeDrawer}
        onSave={saveSelectedTicket}
        onDescriptionChange={setDraftDescription}
        onStatusChange={setDraftStatus}
        onWorkerChange={setDraftWorkerId}
        onSelectImage={setSelectedImageUrl}
        onCloseTicket={handleCloseTicket}
        getImageUrl={getImageUrl}
        isMobile={isMobile}
      />

      {/* Add Ticket Modal */}
      <AddTicketModal
        open={showAddTicketModal}
        onClose={() => setShowAddTicketModal(false)}
        projects={projects}
        projectCode={addTicketProjectCode}
        description={addTicketDescription}
        reporterName={addTicketReporterName}
        reporterPhone={addTicketReporterPhone}
        error={addTicketError}
        loading={addingTicket}
        onProjectCodeChange={setAddTicketProjectCode}
        onDescriptionChange={setAddTicketDescription}
        onReporterNameChange={setAddTicketReporterName}
        onReporterPhoneChange={setAddTicketReporterPhone}
        onSubmit={handleCreateTicket}
      />

      {/* Image Lightbox */}
      {selectedImageUrl && (
        <div style={styles.lightboxOverlay} onClick={() => setSelectedImageUrl(null)}>
          <img src={selectedImageUrl} alt="Attachment" style={styles.lightboxImage} />
        </div>
      )}
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: { padding: '32px 40px', maxWidth: '1400px', margin: '0 auto' },
  hero: { marginBottom: '40px' },
  heroTop: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap',
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: '34px', fontWeight: 700, color: theme.colors.textPrimary, margin: 0, letterSpacing: '-0.02em' },
  heroDate: { fontSize: '17px', color: theme.colors.textMuted, margin: '8px 0 0' },
  heroStatus: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: theme.colors.textSecondary, margin: '16px 0 0' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', background: theme.colors.warning },
  heroActions: { display: 'flex', gap: '12px' },
  loadingContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0' },
  kpiGrid: { display: 'grid', gap: '16px', marginBottom: '32px' },
  mainGrid: { display: 'grid', gap: '24px', marginBottom: '32px' },
  projectList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  projectCard: { display: 'block', padding: '16px', borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, textDecoration: 'none', transition: 'all 0.2s ease', cursor: 'pointer' },
  projectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  projectName: { fontSize: '15px', fontWeight: 600, color: theme.colors.textPrimary },
  projectCode: { fontSize: '13px', color: theme.colors.textMuted, marginTop: '2px' },
  projectStats: { textAlign: 'right' },
  projectTicketCount: { fontSize: '13px', fontWeight: 500, color: theme.colors.warning },
  progressBarContainer: { display: 'flex', alignItems: 'center', gap: '12px' },
  progressBarBg: { flex: 1, height: '4px', background: theme.colors.muted, borderRadius: '2px', overflow: 'hidden' },
  progressBarFill: { height: '100%', background: theme.colors.primary, borderRadius: '2px', transition: 'width 0.3s ease' },
  progressLabel: { fontSize: '12px', color: theme.colors.textMuted, flexShrink: 0 },
  activityList: { display: 'flex', flexDirection: 'column', gap: '4px' },
  activityItem: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 0', borderBottom: `1px solid ${theme.colors.border}` },
  activityIcon: { width: '32px', height: '32px', borderRadius: theme.radius.full, background: theme.colors.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityContent: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: '14px', fontWeight: 500, color: theme.colors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' },
  activityBadge: { fontSize: '11px', fontWeight: 500, color: theme.colors.textMuted, background: theme.colors.muted, padding: '2px 6px', borderRadius: theme.radius.xs },
  activityDesc: { fontSize: '13px', color: theme.colors.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  activityTime: { fontSize: '12px', color: theme.colors.textMuted, flexShrink: 0 },
  viewAllLink: { fontSize: '14px', fontWeight: 500, color: theme.colors.primary, textDecoration: 'none' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'start', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.muted },
  tr: { cursor: 'pointer', transition: 'background 0.15s ease' },
  td: { padding: '16px 20px', fontSize: '14px', color: theme.colors.textPrimary, borderBottom: `1px solid ${theme.colors.border}`, verticalAlign: 'middle' },
  ticketNumber: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  projectBadge: { fontSize: '12px', fontWeight: 500, color: theme.colors.textMuted, background: theme.colors.muted, padding: '4px 8px', borderRadius: theme.radius.sm },
  descriptionText: { color: theme.colors.textSecondary },
  workerName: { color: theme.colors.textSecondary },
  ageText: { color: theme.colors.textMuted, fontSize: '13px' },
  emptyText: { textAlign: 'center', color: theme.colors.textMuted, padding: '32px 0' },
  lightboxOverlay: { position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, cursor: 'pointer' },
  lightboxImage: { maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: theme.radius.lg },
}