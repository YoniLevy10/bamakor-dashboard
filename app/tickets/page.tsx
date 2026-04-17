'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'
import {
  AppShell,
  MobileHeader,
  MobileMenu,
  PageHeader,
  KpiCard,
  Card,
  Button,
  StatusBadge,
  PriorityDot,
  SearchInput,
  Select,
  Drawer,
  EmptyState,
  LoadingSpinner,
  theme
} from '../components/ui'

type TicketRow = {
  id: string
  ticket_number: number
  project_id?: string | null
  project_code?: string
  project_name?: string
  reporter_phone?: string | null
  reporter_name?: string | null
  description?: string | null
  status: string
  priority?: string | null
  assigned_worker_id?: string | null
  created_at?: string
  closed_at?: string | null
  projects?:
    | { name?: string | null; project_code?: string | null }[]
    | { name?: string | null; project_code?: string | null }
    | null
}

type AttachmentRow = {
  id: string
  ticket_id: string
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string
  created_at: string
  signed_url?: string | null
}

type WorkerRow = {
  id: string
  full_name: string
  phone?: string | null
  email?: string | null
  role?: string | null
  is_active?: boolean | null
}

type ProjectRow = {
  id: string
  name: string
  project_code: string
}

const statusOptions = [
  { label: 'All Status', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Waiting Parts', value: 'WAITING_PARTS' },
  { label: 'Closed', value: 'CLOSED' },
]

const priorityOptions = [
  { label: 'All Priority', value: 'ALL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [workerFilter, setWorkerFilter] = useState('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null)
  const [draftPriority, setDraftPriority] = useState<string>('')
  const [draftStatus, setDraftStatus] = useState<string>('')
  const [draftWorkerId, setDraftWorkerId] = useState<string>('')
  const [savingTicket, setSavingTicket] = useState(false)
  const [selectedTicketAttachments, setSelectedTicketAttachments] = useState<AttachmentRow[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [showAddTicketModal, setShowAddTicketModal] = useState(false)
  const [addTicketForm, setAddTicketForm] = useState({
    project_code: '',
    description: '',
    reporter_name: '',
    reporter_phone: '',
  })
  const [addingTicket, setAddingTicket] = useState(false)
  const [addTicketError, setAddTicketError] = useState('')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('project')) setProjectFilter(decodeURIComponent(params.get('project')!))
      if (params.get('worker')) setWorkerFilter(decodeURIComponent(params.get('worker')!))
      if (params.get('status')) setStatusFilter(decodeURIComponent(params.get('status')!))
      if (params.get('priority')) setPriorityFilter(decodeURIComponent(params.get('priority')!))
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams()
      if (projectFilter !== 'ALL') params.set('project', projectFilter)
      if (workerFilter !== 'ALL') params.set('worker', workerFilter)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter)
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
      window.history.replaceState(null, '', newUrl)
    }
  }, [projectFilter, workerFilter, statusFilter, priorityFilter])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    setLoading(true)
    await asyncHandler(
      async () => {
        const [ticketsResult, workersResult, projectsResult] = await Promise.all([
          supabase
            .from('tickets')
            .select(`
              id, ticket_number, project_id, reporter_phone, reporter_name,
              description, status, priority, assigned_worker_id, created_at, closed_at,
              projects (name, project_code)
            `)
            .order('created_at', { ascending: false }),
          supabase
            .from('workers')
            .select('id, full_name, phone, email, role, is_active')
            .order('full_name', { ascending: true }),
          supabase
            .from('projects')
            .select('id, name, project_code')
            .order('project_code', { ascending: true }),
        ])

        if (ticketsResult.error) throw ticketsResult.error
        if (workersResult.error) throw workersResult.error
        if (projectsResult.error) throw projectsResult.error

        const normalizedTickets: TicketRow[] = (ticketsResult.data as TicketRow[] || []).map((ticket) => {
          const project = Array.isArray(ticket.projects) ? ticket.projects[0] : ticket.projects
          return {
            ...ticket,
            project_code: project?.project_code || '',
            project_name: project?.name || '',
          }
        })

        setTickets(normalizedTickets)
        setWorkers((workersResult.data as WorkerRow[]) || [])
        setProjects((projectsResult.data as ProjectRow[]) || [])
        return true
      },
      { context: 'Failed to load tickets', showErrorToast: true }
    )
    setLoading(false)
  }

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'NEW').length
    const assigned = tickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length
    const resolved = tickets.filter((t) => t.status === 'CLOSED').length
    return { total, open, assigned, resolved }
  }, [tickets])

  const projectOptions = useMemo(() => {
    const unique = Array.from(new Set(tickets.map((t) => t.project_code).filter(Boolean))) as string[]
    return [{ label: 'All Projects', value: 'ALL' }, ...unique.map((p) => ({ label: p, value: p }))]
  }, [tickets])

  const workerOptions = useMemo(() => {
    return [
      { label: 'All Workers', value: 'ALL' },
      ...workers.map((w) => ({ label: w.full_name, value: w.id })),
    ]
  }, [workers])

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const q = searchTerm.trim().toLowerCase()
      const matchesSearch = !q ||
        String(ticket.ticket_number).includes(q) ||
        (ticket.project_code || '').toLowerCase().includes(q) ||
        (ticket.project_name || '').toLowerCase().includes(q) ||
        (ticket.description || '').toLowerCase().includes(q) ||
        (ticket.reporter_phone || '').toLowerCase().includes(q) ||
        (ticket.reporter_name || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'ALL' || ticket.status === statusFilter
      const matchesPriority = priorityFilter === 'ALL' || (ticket.priority || '').toUpperCase() === priorityFilter
      const matchesProject = projectFilter === 'ALL' || ticket.project_code === projectFilter
      const matchesWorker = workerFilter === 'ALL' || ticket.assigned_worker_id === workerFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesWorker
    })
  }, [tickets, searchTerm, statusFilter, priorityFilter, projectFilter, workerFilter])

  function getWorkerName(workerId?: string | null) {
    if (!workerId) return 'Unassigned'
    const worker = workers.find((w) => w.id === workerId)
    return worker?.full_name || 'Unknown'
  }

  function getTicketAge(createdAt?: string): string {
    if (!createdAt) return '-'
    const now = new Date()
    const created = new Date(createdAt)
    const diffMs = now.getTime() - created.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays > 0) return `${diffDays}d`
    if (diffHours > 0) return `${diffHours}h`
    return 'now'
  }

  function openTicket(ticket: TicketRow) {
    setSelectedTicket(ticket)
    setDraftPriority(ticket.priority || 'LOW')
    setDraftStatus(ticket.status)
    setDraftWorkerId(ticket.assigned_worker_id || '')
    setSelectedTicketAttachments([])
    loadTicketAttachments(ticket.id)
  }

  async function loadTicketAttachments(ticketId: string) {
    setLoadingAttachments(true)
    console.log('[v0] Loading attachments for ticket:', ticketId)
    try {
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('id, ticket_id, file_name, file_url, file_size, mime_type, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      console.log('[v0] Attachments query result:', { data, error, count: data?.length })

      if (data && data.length > 0) {
        const attachmentsWithUrls = await Promise.all(
          (data || []).map(async (attachment: AttachmentRow) => {
            try {
              // Extract just the path if file_url contains full URL
              let filePath = attachment.file_url
              console.log('[v0] Original file_url:', filePath)
              
              // If it's a full Supabase URL, extract just the path
              if (filePath && filePath.includes('supabase.co/storage')) {
                // Extract path after /ticket-attachments/
                const match = filePath.match(/\/ticket-attachments\/(.+)$/)
                if (match) {
                  filePath = match[1]
                  console.log('[v0] Extracted path from URL:', filePath)
                }
              }
              
              // If it starts with ticket-attachments/, remove that prefix
              if (filePath && filePath.startsWith('ticket-attachments/')) {
                filePath = filePath.replace('ticket-attachments/', '')
                console.log('[v0] Removed bucket prefix:', filePath)
              }
              
              console.log('[v0] Final path for signed URL:', filePath)
              const { data: signedUrlData, error: signedError } = await supabase.storage
                .from('ticket-attachments')
                .createSignedUrl(filePath, 3600)
              console.log('[v0] Signed URL result:', { signedUrl: signedUrlData?.signedUrl, error: signedError })
              return { ...attachment, signed_url: signedUrlData?.signedUrl || null }
            } catch (err) {
              console.log('[v0] Error creating signed URL:', err)
              return { ...attachment, signed_url: null }
            }
          })
        )
        console.log('[v0] Final attachments with URLs:', attachmentsWithUrls)
        setSelectedTicketAttachments(attachmentsWithUrls)
      } else {
        console.log('[v0] No attachments found for ticket')
        setSelectedTicketAttachments([])
      }
    } catch (err) {
      console.log('[v0] Error loading attachments:', err)
      setSelectedTicketAttachments([])
    }
    setLoadingAttachments(false)
  }

  function closeDrawer() {
    setSelectedTicket(null)
    setDraftPriority('')
    setDraftStatus('')
    setDraftWorkerId('')
    setSelectedTicketAttachments([])
  }

  async function saveTicketChanges() {
    if (!selectedTicket) return
    setSavingTicket(true)
    try {
      // Handle worker assignment if changed
      if (draftWorkerId && draftWorkerId !== selectedTicket.assigned_worker_id) {
        await fetch('/api/assign-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: selectedTicket.id, worker_id: draftWorkerId }),
        })
      }

      const payload: Record<string, string | null> = {
        priority: draftPriority,
        status: draftStatus,
        assigned_worker_id: draftWorkerId || null,
      }
      if (draftStatus === 'CLOSED') {
        payload.closed_at = new Date().toISOString()
      } else {
        payload.closed_at = null
      }

      const { error } = await supabase
        .from('tickets')
        .update(payload)
        .eq('id', selectedTicket.id)

      if (error) throw error

      toast.success('Changes saved')
      await fetchData()
      setSelectedTicket((prev) => prev ? { ...prev, priority: draftPriority, status: draftStatus, assigned_worker_id: draftWorkerId || null } : prev)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes')
    }
    setSavingTicket(false)
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!addTicketForm.project_code) {
      setAddTicketError('Please select a project')
      return
    }
    if (!addTicketForm.description || addTicketForm.description.trim().length < 3) {
      setAddTicketError('Description must be at least 3 characters')
      return
    }

    setAddingTicket(true)
    setAddTicketError('')

    try {
      const formData = new FormData()
      formData.append('project_code', addTicketForm.project_code)
      formData.append('description', addTicketForm.description)
      if (addTicketForm.reporter_name) formData.append('reporter_name', addTicketForm.reporter_name)
      if (addTicketForm.reporter_phone) formData.append('reporter_phone', addTicketForm.reporter_phone)
      formData.append('source', 'manual')

      const response = await fetch('/api/create-ticket', { method: 'POST', body: formData })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to create ticket')
      }

      const result = await response.json()
      toast.success(`Ticket #${result.ticketNumber} created successfully`)
      setAddTicketForm({ project_code: '', description: '', reporter_name: '', reporter_phone: '' })
      setShowAddTicketModal(false)
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket'
      setAddTicketError(message)
      toast.error(message)
    }
    setAddingTicket(false)
  }

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="Tickets"
          subtitle={`${filteredTickets.length} tickets`}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="Tickets"
            subtitle="Manage and track all maintenance requests"
            actions={
              <Button variant="primary" onClick={() => setShowAddTicketModal(true)}>
                New Ticket
              </Button>
            }
          />
        )}

        {/* KPI Cards */}
        <div style={{
          ...styles.kpiGrid,
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        }}>
          <KpiCard label="Total Tickets" value={stats.total} accent="primary" />
          <KpiCard label="Open" value={stats.open} accent="warning" />
          <KpiCard label="In Progress" value={stats.assigned} accent="primary" />
          <KpiCard label="Resolved" value={stats.resolved} accent="success" />
        </div>

        {/* Filters */}
        <Card noPadding>
          <div style={{
            ...styles.filtersRow,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search tickets..."
              style={{ flex: 1, maxWidth: isMobile ? '100%' : '320px' }}
            />
            <div style={{
              ...styles.filterGroup,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                style={{ minWidth: '140px' }}
              />
              <Select
                value={priorityFilter}
                onChange={setPriorityFilter}
                options={priorityOptions}
                style={{ minWidth: '130px' }}
              />
              <Select
                value={projectFilter}
                onChange={setProjectFilter}
                options={projectOptions}
                style={{ minWidth: '140px' }}
              />
              <Select
                value={workerFilter}
                onChange={setWorkerFilter}
                options={workerOptions}
                style={{ minWidth: '140px' }}
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={styles.loadingContainer}>
              <LoadingSpinner />
            </div>
          ) : filteredTickets.length === 0 ? (
            <EmptyState
              title="No tickets found"
              description="Try adjusting your filters or create a new ticket."
              action={
                <Button variant="primary" onClick={() => setShowAddTicketModal(true)}>
                  Create Ticket
                </Button>
              }
            />
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Priority</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Assigned To</th>
                    <th style={styles.th}>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      style={styles.tr}
                      onClick={() => openTicket(ticket)}
                    >
                      <td style={styles.td}>
                        <span style={styles.ticketNumber}>{ticket.ticket_number}</span>
                      </td>
                      <td style={styles.td}>
                        <PriorityDot priority={ticket.priority || 'LOW'} />
                      </td>
                      <td style={styles.td}>
                        <span style={styles.projectBadge}>{ticket.project_code}</span>
                      </td>
                      <td style={{ ...styles.td, maxWidth: '350px' }}>
                        <span style={styles.descriptionText}>
                          {ticket.description?.slice(0, 80)}{(ticket.description?.length || 0) > 80 ? '...' : ''}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <StatusBadge status={ticket.status} size="sm" />
                      </td>
                      <td style={styles.td}>
                        <span style={styles.workerName}>{getWorkerName(ticket.assigned_worker_id)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.ageText}>{getTicketAge(ticket.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Ticket Detail Drawer */}
      <Drawer
        open={!!selectedTicket}
        onClose={closeDrawer}
        title={selectedTicket ? `Ticket #${selectedTicket.ticket_number}` : ''}
        subtitle={selectedTicket?.project_name || selectedTicket?.project_code}
        isMobile={isMobile}
      >
        {selectedTicket && (
          <div style={styles.drawerContent}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Description</label>
              <div style={styles.descriptionBox}>{selectedTicket.description || '-'}</div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reporter</label>
                <div style={styles.formValue}>
                  {selectedTicket.reporter_name || selectedTicket.reporter_phone || '-'}
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Created</label>
                <div style={styles.formValue}>
                  {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleDateString() : '-'}
                </div>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Priority</label>
              <Select
                value={draftPriority}
                onChange={setDraftPriority}
                options={[
                  { label: 'Low', value: 'LOW' },
                  { label: 'Medium', value: 'MEDIUM' },
                  { label: 'High', value: 'HIGH' },
                ]}
                style={{ width: '100%' }}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Status</label>
              <Select
                value={draftStatus}
                onChange={setDraftStatus}
                options={statusOptions.filter(s => s.value !== 'ALL')}
                style={{ width: '100%' }}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Assigned To</label>
              <Select
                value={draftWorkerId}
                onChange={setDraftWorkerId}
                options={[
                  { label: 'Unassigned', value: '' },
                  ...workers.map((w) => ({ label: w.full_name, value: w.id })),
                ]}
                style={{ width: '100%' }}
              />
            </div>

            {/* Attachments */}
            {selectedTicketAttachments.length > 0 && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Attachments</label>
                <div style={styles.attachmentGrid}>
                  {selectedTicketAttachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.signed_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.attachmentItem}
                    >
                      {attachment.mime_type?.startsWith('image/') ? (
                        <img
                          src={attachment.signed_url || ''}
                          alt={attachment.file_name}
                          style={styles.attachmentImage}
                        />
                      ) : (
                        <div style={styles.attachmentFile}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span style={styles.attachmentName}>{attachment.file_name}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.drawerActions}>
              <Button variant="secondary" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveTicketChanges} loading={savingTicket}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Ticket Modal */}
      <Drawer
        open={showAddTicketModal}
        onClose={() => setShowAddTicketModal(false)}
        title="Create New Ticket"
        subtitle="Submit a new maintenance request"
        isMobile={isMobile}
      >
        <form onSubmit={handleCreateTicket} style={styles.drawerContent}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Project *</label>
            <Select
              value={addTicketForm.project_code}
              onChange={(value) => setAddTicketForm((prev) => ({ ...prev, project_code: value }))}
              options={[
                { label: 'Select a project', value: '' },
                ...projects.map((p) => ({ label: `${p.project_code} - ${p.name}`, value: p.project_code })),
              ]}
              style={{ width: '100%' }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Description *</label>
            <textarea
              value={addTicketForm.description}
              onChange={(e) => setAddTicketForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the issue..."
              style={styles.textarea}
              rows={4}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Reporter Name</label>
            <input
              type="text"
              value={addTicketForm.reporter_name}
              onChange={(e) => setAddTicketForm((prev) => ({ ...prev, reporter_name: e.target.value }))}
              placeholder="Optional"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Reporter Phone</label>
            <input
              type="tel"
              value={addTicketForm.reporter_phone}
              onChange={(e) => setAddTicketForm((prev) => ({ ...prev, reporter_phone: e.target.value }))}
              placeholder="Optional"
              style={styles.input}
            />
          </div>

          {addTicketError && (
            <p style={styles.errorText}>{addTicketError}</p>
          )}

          <div style={styles.drawerActions}>
            <Button variant="secondary" type="button" onClick={() => setShowAddTicketModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={addingTicket}>
              Create Ticket
            </Button>
          </div>
        </form>
      </Drawer>
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: {
    padding: '32px 40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  kpiGrid: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px',
  },
  filtersRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '64px 0',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '14px 20px',
    fontSize: '12px',
    fontWeight: 600,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`,
    background: theme.colors.muted,
  },
  tr: {
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  td: {
    padding: '16px 20px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    borderBottom: `1px solid ${theme.colors.border}`,
    verticalAlign: 'middle',
  },
  ticketNumber: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  projectBadge: {
    fontSize: '12px',
    fontWeight: 500,
    color: theme.colors.textMuted,
    background: theme.colors.muted,
    padding: '4px 8px',
    borderRadius: theme.radius.sm,
  },
  descriptionText: {
    color: theme.colors.textSecondary,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  workerName: {
    color: theme.colors.textSecondary,
  },
  ageText: {
    color: theme.colors.textMuted,
    fontSize: '13px',
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textSecondary,
  },
  formValue: {
    fontSize: '15px',
    color: theme.colors.textPrimary,
  },
  descriptionBox: {
    padding: '14px',
    background: theme.colors.muted,
    borderRadius: theme.radius.md,
    fontSize: '14px',
    color: theme.colors.textPrimary,
    lineHeight: 1.6,
  },
  attachmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  attachmentItem: {
    display: 'block',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border}`,
    textDecoration: 'none',
  },
  attachmentImage: {
    width: '100%',
    height: '80px',
    objectFit: 'cover',
  },
  attachmentFile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '16px 8px',
    background: theme.colors.muted,
  },
  attachmentName: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  },
  drawerActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    paddingTop: '16px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '8px',
  },
  textarea: {
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '15px',
    color: theme.colors.textPrimary,
    resize: 'vertical',
    minHeight: '100px',
    fontFamily: 'inherit',
  },
  input: {
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '15px',
    color: theme.colors.textPrimary,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: '14px',
    margin: 0,
  },
}
