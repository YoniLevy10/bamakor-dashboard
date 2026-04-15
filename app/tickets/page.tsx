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
  SearchInput,
  FilterTabs,
  Drawer,
  EmptyState,
  Select,
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
    | {
        name?: string | null
        project_code?: string | null
      }[]
    | {
        name?: string | null
        project_code?: string | null
      }
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
}

type AttachmentWithUrl = AttachmentRow & {
  signed_url: string | null
}

type WorkerRow = {
  id: string
  full_name: string
  phone?: string | null
  email?: string | null
  role?: string | null
  is_active?: boolean | null
}

const statusOptions = ['ALL', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'CLOSED']
const priorityOptions = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [workerFilter, setWorkerFilter] = useState('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null)
  const [draftPriority, setDraftPriority] = useState<string>('')
  const [draftStatus, setDraftStatus] = useState<string>('')
  const [savingTicket, setSavingTicket] = useState(false)
  const [selectedTicketAttachments, setSelectedTicketAttachments] = useState<AttachmentWithUrl[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [showAddTicketModal, setShowAddTicketModal] = useState(false)
  const [addTicketForm, setAddTicketForm] = useState({
    project_code: '',
    description: '',
    reporter_name: '',
    reporter_phone: '',
  })
  const [addingTicket, setAddingTicket] = useState(false)
  const [addTicketError, setAddTicketError] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string; project_code: string }[]>([])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const projectParam = params.get('project')
      const workerParam = params.get('worker')
      if (projectParam) {
        setProjectFilter(decodeURIComponent(projectParam))
      }
      if (workerParam) {
        setWorkerFilter(decodeURIComponent(workerParam))
      }
    }
  }, [])

  useEffect(() => {
    fetchData()

    const handleFocus = async () => {
      await fetchData()
    }

    const backgroundRefreshInterval = setInterval(async () => {
      await fetchData()
    }, 10 * 60 * 1000)

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(backgroundRefreshInterval)
    }
  }, [])

  async function fetchData() {
    setLoading(true)
    setError('')

    await asyncHandler(
      async () => {
        const [ticketsResult, workersResult, projectsResult] = await Promise.all([
          supabase
            .from('tickets')
            .select(`
          id,
          ticket_number,
          project_id,
          reporter_phone,
          reporter_name,
          description,
          status,
          priority,
          assigned_worker_id,
          created_at,
          closed_at,
          projects (
            name,
            project_code
          )
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

        const normalizedTickets: TicketRow[] = ((ticketsResult.data as TicketRow[]) || []).map((ticket) => {
          const project = Array.isArray(ticket.projects) ? ticket.projects[0] : ticket.projects

          return {
            ...ticket,
            project_code: project?.project_code || '',
            project_name: project?.name || '',
          }
        })

        setTickets(normalizedTickets)
        setWorkers((workersResult.data as WorkerRow[]) || [])
        setProjects((projectsResult.data as typeof projects) || [])
        return true
      },
      {
        context: 'Failed to load tickets, workers, and projects',
        showErrorToast: true,
        onError: (err) => setError(err),
      }
    )

    setLoading(false)
  }

  async function assignWorker(ticketId: string, workerId: string) {
    if (!workerId) return

    setActionLoadingId(ticketId)
    await asyncHandler(
      async () => {
        const response = await fetch('/api/assign-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: ticketId,
            worker_id: workerId,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to assign worker')
        }

        toast.success('Worker assigned')
        await fetchData()
        return true
      },
      { context: 'Failed to assign worker', showErrorToast: true }
    )
    setActionLoadingId(null)
  }

  async function closeTicket(ticketId: string) {
    setActionLoadingId(ticketId)
    await asyncHandler(
      async () => {
        const { error } = await supabase
          .from('tickets')
          .update({
            status: 'CLOSED',
            closed_at: new Date().toISOString(),
          })
          .eq('id', ticketId)

        if (error) throw error

        toast.success('Ticket closed')
        await fetchData()

        // Keep drawer open and reflect status immediately
        setSelectedTicket((prev) => {
          if (!prev || prev.id !== ticketId) return prev
          return { ...prev, status: 'CLOSED', closed_at: new Date().toISOString() }
        })
        setDraftStatus('CLOSED')
        return true
      },
      { context: 'Failed to close ticket', showErrorToast: true }
    )
    setActionLoadingId(null)
  }

  function openTicket(ticket: TicketRow) {
    setSelectedTicket(ticket)
    setDraftPriority(ticket.priority || 'LOW')
    setDraftStatus(ticket.status)
    setSelectedTicketAttachments([])
    loadTicketAttachments(ticket.id)
  }

  async function loadTicketAttachments(ticketId: string) {
    setLoadingAttachments(true)
    try {
      if (!ticketId || typeof ticketId !== 'string') {
        setSelectedTicketAttachments([])
        setLoadingAttachments(false)
        return
      }

      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('id, ticket_id, file_name, file_url, file_size, mime_type, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (error) {
        setSelectedTicketAttachments([])
      } else if (!data || data.length === 0) {
        setSelectedTicketAttachments([])
      } else {
        const attachmentsWithUrls = await Promise.all(
          (data || []).map(async (attachment: AttachmentRow) => {
            try {
              if (!attachment.file_url) {
                return { ...attachment, signed_url: null }
              }

              const { data: signedUrlData } = await supabase.storage
                .from('ticket-attachments')
                .createSignedUrl(attachment.file_url, 3600)

              return { ...attachment, signed_url: signedUrlData?.signedUrl || null }
            } catch {
              return {
                ...attachment,
                signed_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ticket-attachments/${attachment.file_url}`,
              }
            }
          })
        )

        setSelectedTicketAttachments(attachmentsWithUrls)
      }
    } catch {
      setSelectedTicketAttachments([])
    } finally {
      setLoadingAttachments(false)
    }
  }

  function getImageUrl(attachment: AttachmentWithUrl): string {
    if (attachment.signed_url) {
      return attachment.signed_url
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jsliqlmjksintyigkulq.supabase.co'
    return `${supabaseUrl}/storage/v1/object/public/ticket-attachments/${attachment.file_url}`
  }

  function closeDrawer() {
    setSelectedTicket(null)
    setDraftPriority('')
    setDraftStatus('')
    setSelectedTicketAttachments([])
    setSelectedImageUrl(null)
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
      if (addTicketForm.reporter_name) {
        formData.append('reporter_name', addTicketForm.reporter_name)
      }
      if (addTicketForm.reporter_phone) {
        formData.append('reporter_phone', addTicketForm.reporter_phone)
      }
      formData.append('source', 'manual')

      const response = await fetch('/api/create-ticket', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to create ticket')
      }

      const result = await response.json()

      if (result.imageUploadWarning) {
        toast.success(`Ticket #${result.ticketNumber} created successfully`)
        toast.error(result.imageUploadWarning)
      } else {
        toast.success(`Ticket #${result.ticketNumber} created successfully`)
      }

      setAddTicketForm({
        project_code: '',
        description: '',
        reporter_name: '',
        reporter_phone: '',
      })
      setShowAddTicketModal(false)

      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket'
      setAddTicketError(message)
      toast.error(message)
    } finally {
      setAddingTicket(false)
    }
  }

  function sanitizePhoneKeystroke(raw: string) {
    const trimmed = raw.replace(/\s|-/g, '')
    const hasPlus = trimmed.startsWith('+')
    const digits = trimmed.replace(/[^\d]/g, '')
    return hasPlus ? `+${digits}` : digits
  }

  function normalizePhone(raw: string) {
    const s = sanitizePhoneKeystroke(raw)
    if (!s) return ''
    if (s.startsWith('+972')) return s
    if (s.startsWith('972')) return `+${s}`
    if (s.startsWith('05')) return s
    return s
  }

  async function saveTicketChanges() {
    if (!selectedTicket) return

    setSavingTicket(true)
    try {
      const response = await fetch('/api/update-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          priority: draftPriority,
          status: draftStatus,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save changes')
      }

      await fetchData()
      toast.success('Changes saved')

      // Keep drawer open and update selected ticket in-place
      setSelectedTicket((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          priority: draftPriority,
          status: draftStatus,
        }
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save changes'
      toast.error(errorMessage)
    } finally {
      setSavingTicket(false)
    }
  }

  const projectOptions = useMemo(() => {
    const unique = Array.from(
      new Set(tickets.map((t) => t.project_code).filter(Boolean))
    ) as string[]
    return ['ALL', ...unique]
  }, [tickets])

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const q = searchTerm.trim().toLowerCase()

      const matchesSearch =
        !q ||
        String(ticket.ticket_number).toLowerCase().includes(q) ||
        (ticket.project_code || '').toLowerCase().includes(q) ||
        (ticket.project_name || '').toLowerCase().includes(q) ||
        (ticket.description || '').toLowerCase().includes(q) ||
        (ticket.reporter_phone || '').toLowerCase().includes(q) ||
        (ticket.reporter_name || '').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'ALL' || ticket.status === statusFilter

      const matchesPriority =
        priorityFilter === 'ALL' || (ticket.priority || '').toUpperCase() === priorityFilter

      const matchesProject =
        projectFilter === 'ALL' || ticket.project_code === projectFilter

      const matchesWorker =
        workerFilter === 'ALL' || ticket.assigned_worker_id === workerFilter

      return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesWorker
    })
  }, [tickets, searchTerm, statusFilter, priorityFilter, projectFilter, workerFilter])

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === 'NEW').length
    const assigned = tickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length
    const resolved = tickets.filter((t) => t.status === 'CLOSED').length

    return { total, open, assigned, resolved }
  }, [tickets])

  function getWorkerName(workerId?: string | null) {
    if (!workerId) return 'Unassigned'
    const worker = workers.find((w) => w.id === workerId)
    return worker?.full_name || 'Unassigned'
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
            subtitle="Manage and track all maintenance tickets"
            actions={
              <>
                <Button variant="primary" onClick={() => setShowAddTicketModal(true)}>
                  + New Ticket
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', color: '#64748B', fontSize: '18px', cursor: 'pointer', userSelect: 'none' }} title="Language Settings">
                  🌐
                </div>
              </>
            }
          />
        )}

        {/* KPI Cards */}
        <div style={{
          ...styles.kpiGrid,
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        }}>
          <KpiCard label="Total" value={stats.total} />
          <KpiCard label="Open" value={stats.open} />
          <KpiCard label="In Progress" value={stats.assigned} />
          <KpiCard label="Resolved" value={stats.resolved} />
        </div>

        {/* Tickets Card */}
        <Card
          title="All Tickets"
          subtitle="Click on a ticket to view details"
          noPadding
        >
          {/* Filters */}
          <div style={styles.filtersRow}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search tickets..."
              style={{ maxWidth: isMobile ? '100%' : '280px' }}
            />

            <div style={styles.filterGroup}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.filterSelect}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s === 'ALL' ? 'All Status' : s.replace('_', ' ')}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={styles.filterSelect}
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>{p === 'ALL' ? 'All Priority' : p}</option>
                ))}
              </select>

              {!isMobile && (
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  style={styles.filterSelect}
                >
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>{p === 'ALL' ? 'All Projects' : p}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner} />
              <span>Loading tickets...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={styles.errorState}>
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={fetchData}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredTickets.length === 0 && (
            <EmptyState
              title="No tickets found"
              description="Try adjusting your filters or create a new ticket."
              action={
                <Button variant="primary" onClick={() => setShowAddTicketModal(true)}>
                  Create Ticket
                </Button>
              }
            />
          )}

          {/* Ticket List */}
          {!loading && !error && filteredTickets.length > 0 && (
            <div style={styles.ticketList}>
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  style={{
                    ...styles.ticketRow,
                    ...(selectedTicket?.id === ticket.id ? styles.ticketRowActive : {}),
                  }}
                >
                  <div style={styles.ticketRowTop}>
                    <div style={styles.ticketRowMain}>
                      <span style={styles.ticketNumber}>#{ticket.ticket_number}</span>
                      <span style={styles.ticketProject}>{ticket.project_code || 'N/A'}</span>
                      <StatusBadge status={ticket.status} size="sm" />
                      {ticket.priority && (
                        <StatusBadge status={ticket.priority.toUpperCase()} size="sm" />
                      )}
                    </div>
                    {!isMobile && (
                      <div style={styles.ticketRowActions}>
                        <select
                          value={ticket.assigned_worker_id || ''}
                          onChange={(e) => {
                            e.stopPropagation()
                            assignWorker(ticket.id, e.target.value)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={styles.workerSelect}
                        >
                          <option value="">Assign Worker</option>
                          {workers.filter(w => w.is_active).map((w) => (
                            <option key={w.id} value={w.id}>{w.full_name}</option>
                          ))}
                        </select>
                        {ticket.status !== 'CLOSED' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              closeTicket(ticket.id)
                            }}
                            loading={actionLoadingId === ticket.id}
                          >
                            Close
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={styles.ticketDescription}>{ticket.description || '-'}</div>
                  <div style={styles.ticketMeta}>
                    <span>{ticket.reporter_name || ticket.reporter_phone || 'Unknown'}</span>
                    <span>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '-'}</span>
                    <span>{getWorkerName(ticket.assigned_worker_id)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Ticket Detail Drawer */}
      <Drawer
        open={!!selectedTicket}
        onClose={closeDrawer}
        title={`Ticket #${selectedTicket?.ticket_number}`}
        subtitle={selectedTicket?.project_name || selectedTicket?.project_code}
        isMobile={isMobile}
      >
        {selectedTicket && (
          <div style={styles.drawerContent}>
            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Status</div>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                style={styles.drawerSelect}
              >
                {statusOptions.filter(s => s !== 'ALL').map((status) => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Priority</div>
              <select
                value={draftPriority}
                onChange={(e) => setDraftPriority(e.target.value)}
                style={styles.drawerSelect}
              >
                {priorityOptions.filter(p => p !== 'ALL').map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Assigned Worker</div>
              <div style={styles.drawerValue}>
                {getWorkerName(selectedTicket.assigned_worker_id)}
              </div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Description</div>
              <div style={styles.drawerDescription}>
                {selectedTicket.description || 'No description'}
              </div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Reporter</div>
              <div style={styles.drawerValue}>
                {selectedTicket.reporter_name && (
                  <div>{selectedTicket.reporter_name}</div>
                )}
                {selectedTicket.reporter_phone && (
                  <div style={styles.drawerPhone}>{selectedTicket.reporter_phone}</div>
                )}
              </div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Created</div>
              <div style={styles.drawerValue}>
                {selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString() : '-'}
              </div>
            </div>

            {/* Attachments */}
            {selectedTicketAttachments.length > 0 && (
              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Attachments ({selectedTicketAttachments.length})</div>
                <div style={styles.attachmentGrid}>
                  {selectedTicketAttachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => setSelectedImageUrl(getImageUrl(attachment))}
                      style={styles.attachmentThumb}
                    >
                      {attachment.mime_type.startsWith('image/') ? (
                        <img
                          src={getImageUrl(attachment)}
                          alt={attachment.file_name}
                          style={styles.attachmentImg}
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div style={styles.attachmentFile}>{attachment.file_name}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={styles.drawerActions}>
              <Button
                variant="primary"
                onClick={saveTicketChanges}
                loading={savingTicket}
                style={{ width: '100%' }}
              >
                Save Changes
              </Button>
              {selectedTicket.status !== 'CLOSED' && (
                <Button
                  variant="danger"
                  onClick={() => {
                    closeTicket(selectedTicket.id)
                  }}
                  style={{ width: '100%' }}
                >
                  Close Ticket
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Ticket Modal */}
      {showAddTicketModal && (
        <>
          <div style={styles.modalOverlay} onClick={() => setShowAddTicketModal(false)} />
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create New Ticket</h2>
              <button onClick={() => setShowAddTicketModal(false)} style={styles.modalClose}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTicket} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Project</label>
                <select
                  value={addTicketForm.project_code}
                  onChange={(e) => setAddTicketForm({ ...addTicketForm, project_code: e.target.value })}
                  style={styles.formSelect}
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.project_code}>
                      {p.name} ({p.project_code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description</label>
                <textarea
                  value={addTicketForm.description}
                  onChange={(e) => setAddTicketForm({ ...addTicketForm, description: e.target.value })}
                  placeholder="Describe the issue..."
                  style={styles.formTextarea}
                  rows={4}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reporter Name (optional)</label>
                <input
                  type="text"
                  value={addTicketForm.reporter_name}
                  onChange={(e) => setAddTicketForm({ ...addTicketForm, reporter_name: e.target.value })}
                  placeholder="Enter name"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reporter Phone (optional)</label>
                <input
                  type="tel"
                  value={addTicketForm.reporter_phone}
                  inputMode="tel"
                  onChange={(e) =>
                    setAddTicketForm({
                      ...addTicketForm,
                      reporter_phone: sanitizePhoneKeystroke(e.target.value),
                    })
                  }
                  onBlur={() =>
                    setAddTicketForm((prev) => ({
                      ...prev,
                      reporter_phone: normalizePhone(prev.reporter_phone),
                    }))
                  }
                  placeholder="Enter phone number"
                  style={styles.formInput}
                />
              </div>

              {addTicketError && (
                <div style={styles.formError}>{addTicketError}</div>
              )}

              <div style={styles.modalActions}>
                <Button variant="secondary" onClick={() => setShowAddTicketModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={addingTicket} type="submit">
                  Create Ticket
                </Button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Image Lightbox */}
      {selectedImageUrl && (
        <>
          <div style={styles.lightboxOverlay} onClick={() => setSelectedImageUrl(null)} />
          <div style={styles.lightbox}>
            <button onClick={() => setSelectedImageUrl(null)} style={styles.lightboxClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <img src={selectedImageUrl} alt="Attachment" style={styles.lightboxImg} crossOrigin="anonymous" />
          </div>
        </>
      )}

      {/* Mobile Bottom Actions */}
      {isMobile && (
        <div style={styles.mobileBottomActions}>
          <Button variant="primary" onClick={() => setShowAddTicketModal(true)} style={{ flex: 1 }}>
            + New Ticket
          </Button>
        </div>
      )}
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: {
    padding: '24px',
    paddingBottom: '100px',
  },
  kpiGrid: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px',
  },
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    alignItems: 'center',
  },
  filterGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '8px 12px',
    fontSize: '13px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    minWidth: '130px',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '48px 20px',
    color: theme.colors.textMuted,
    fontSize: '14px',
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '48px 20px',
    color: theme.colors.error,
    fontSize: '14px',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
  },
  ticketRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  ticketRowActive: {
    background: theme.colors.primaryMuted,
    borderLeft: `3px solid ${theme.colors.primary}`,
  },
  ticketRowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  ticketRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  ticketRowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ticketNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  ticketProject: {
    fontSize: '13px',
    color: theme.colors.primary,
    fontWeight: 500,
  },
  ticketDescription: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  ticketMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
  workerSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    padding: '6px 10px',
    fontSize: '12px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    minWidth: '120px',
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  drawerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  drawerLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  drawerValue: {
    fontSize: '14px',
    color: theme.colors.textPrimary,
  },
  drawerDescription: {
    fontSize: '14px',
    color: theme.colors.textPrimary,
    lineHeight: 1.6,
    background: theme.colors.surfaceElevated,
    padding: '12px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
  },
  drawerPhone: {
    fontSize: '13px',
    color: theme.colors.textMuted,
  },
  drawerSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
  },
  drawerActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingTop: '12px',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  attachmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '10px',
  },
  attachmentThumb: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    padding: 0,
  },
  attachmentImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  attachmentFile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '11px',
    color: theme.colors.textMuted,
    padding: '8px',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 100,
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '480px',
    background: theme.colors.surface,
    borderRadius: theme.radius.xl,
    border: `1px solid ${theme.colors.border}`,
    zIndex: 101,
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  modalClose: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.sm,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
  },
  modalForm: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
  },
  formSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
  },
  formInput: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
  },
  formTextarea: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '12px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    resize: 'vertical',
    minHeight: '100px',
    lineHeight: 1.5,
  },
  formError: {
    padding: '10px 12px',
    background: theme.colors.errorMuted,
    color: theme.colors.error,
    borderRadius: theme.radius.md,
    fontSize: '13px',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  lightboxOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.9)',
    zIndex: 200,
  },
  lightbox: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 201,
    maxWidth: '90vw',
    maxHeight: '90vh',
  },
  lightboxClose: {
    position: 'absolute',
    top: '-40px',
    right: 0,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  lightboxImg: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: theme.radius.lg,
  },
  mobileBottomActions: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 20px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
    background: theme.colors.surface,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: '10px',
  },
}
