'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'

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
    // Handle project and worker filters from URL query parameters
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        return true
      },
      { context: 'Failed to close ticket', showErrorToast: true }
    )
    setActionLoadingId(null)
  }

  function openTicket(ticket: TicketRow) {
    console.log(`🎟️ Opening ticket: ${ticket.id}`, { ticketNumber: ticket.ticket_number, ticketId: ticket.id })
    setSelectedTicket(ticket)
    setDraftPriority(ticket.priority || 'LOW')
    setDraftStatus(ticket.status)
    // Reset attachments before loading new ones
    setSelectedTicketAttachments([])
    loadTicketAttachments(ticket.id)
  }

  async function loadTicketAttachments(ticketId: string) {
    setLoadingAttachments(true)
    try {
      // STABILITY: Validate ticketId before query
      if (!ticketId || typeof ticketId !== 'string') {
        console.error('❌ Cannot load attachments: ticketId is invalid', { ticketId, type: typeof ticketId })
        setSelectedTicketAttachments([])
        setLoadingAttachments(false)
        return
      }

      console.log(`📥 Loading attachments for ticket: ${ticketId}`)

      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('id, ticket_id, file_name, file_url, file_size, mime_type, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Failed to load attachments from database:', {
          ticketId,
          error,
          message: error?.message || 'Unknown error',
          code: error?.code || 'NO_CODE',
          details: error?.details || 'No details available',
          hint: error?.hint || 'No hint available',
        })
        setSelectedTicketAttachments([])
      } else if (!data || data.length === 0) {
        console.log(`ℹ️  No attachments found for ticket ${ticketId}`)
        setSelectedTicketAttachments([])
      } else {
        console.log(`📦 Found ${data.length} attachment(s) for ticket ${ticketId}`, { data })
        
        // Generate signed URLs for each attachment for reliable access
        const attachmentsWithUrls = await Promise.all(
          (data || []).map(async (attachment: AttachmentRow) => {
            try {
              // STABILITY: Validate file_url before URL generation
              if (!attachment.file_url) {
                console.error(`❌ Attachment ${attachment.id} has missing file_url - skipping URL generation`, {
                  attachmentId: attachment.id,
                  ticketId,
                  reason: 'file_url is null or empty',
                })
                return {
                  ...attachment,
                  signed_url: null,
                }
              }

              console.log(`🔗 Generating signed URL for: ${attachment.file_name}`)
              const { data: signedUrlData } = await supabase.storage
                .from('ticket-attachments')
                .createSignedUrl(attachment.file_url, 3600) // Valid for 1 hour

              return {
                ...attachment,
                signed_url: signedUrlData?.signedUrl || null,
              }
            } catch (urlErr) {
              console.warn(`⚠️ Failed to generate signed URL for ${attachment.file_name}:`, {
                attachmentId: attachment.id,
                filePath: attachment.file_url,
                reason: urlErr instanceof Error ? urlErr.message : String(urlErr),
                action: 'Falling back to public URL',
              })
              // Fallback to public URL if signed URL fails
              return {
                ...attachment,
                signed_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ticket-attachments/${attachment.file_url}`,
              }
            }
          })
        )

        setSelectedTicketAttachments(attachmentsWithUrls)
        console.log(`✅ Loaded ${attachmentsWithUrls.length} attachment(s) with URLs`)
      }
    } catch (err) {
      console.error('❌ Unexpected error loading attachments:', {
        ticketId,
        error: err instanceof Error ? err.message : String(err),
      })
      setSelectedTicketAttachments([])
    } finally {
      setLoadingAttachments(false)
    }
  }

  function getImageUrl(attachment: AttachmentWithUrl): string {
    // Use signed URL if available (most reliable)
    if (attachment.signed_url) {
      return attachment.signed_url
    }
    // Fallback to public URL
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
    
    // Validation
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
      
      // Check if ticket was created but images failed
      if (result.imageUploadWarning) {
        toast.success(`Ticket #${result.ticketNumber} created successfully`)
        toast.error(result.imageUploadWarning)
      } else {
        toast.success(`Ticket #${result.ticketNumber} created successfully`)
      }
      
      // Reset form and close modal
      setAddTicketForm({
        project_code: '',
        description: '',
        reporter_name: '',
        reporter_phone: '',
      })
      setShowAddTicketModal(false)
      
      // Refresh ticket list
      await fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket'
      setAddTicketError(message)
      toast.error(message)
    } finally {
      setAddingTicket(false)
    }
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
      closeDrawer()
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

  function getStatusStyle(status: string): CSSProperties {
    switch (status) {
      case 'NEW':
        return { background: '#FEF08A', color: '#713F12', border: '1px solid #FBBF24' }
      case 'ASSIGNED':
        return { background: '#BFDBFE', color: '#1E40AF', border: '1px solid #60A5FA' }
      case 'IN_PROGRESS':
        return { background: '#BFDBFE', color: '#1E40AF', border: '1px solid #60A5FA' }
      case 'WAITING_PARTS':
        return { background: '#FED7AA', color: '#92400E', border: '1px solid #FDBA74' }
      case 'CLOSED':
        return { background: '#BBF7D0', color: '#065F46', border: '1px solid #6EE7B7' }
      default:
        return { background: '#E5E7EB', color: '#374151', border: '1px solid #D1D5DB' }
    }
  }

  function getPriorityStyle(priority?: string | null): CSSProperties {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH':
        return { background: '#FECACA', color: '#7F1D1D', border: '1px solid #F87171' }
      case 'MEDIUM':
        return { background: '#FED7AA', color: '#92400E', border: '1px solid #FDBA74' }
      case 'LOW':
        return { background: '#E5E7EB', color: '#374151', border: '1px solid #D1D5DB' }
      default:
        return { background: '#E5E7EB', color: '#374151', border: '1px solid #D1D5DB' }
    }
  }

  function getWorkerName(workerId?: string | null) {
    if (!workerId) return 'Unassigned'
    const worker = workers.find((w) => w.id === workerId)
    return worker?.full_name || 'Unassigned'
  }

  return (
    <main style={styles.page}>
      <div
        style={{
          ...styles.appShell,
          gridTemplateColumns: isMobile ? '1fr' : '260px 1fr',
        }}
      >
        {!isMobile && (
          <aside style={styles.sidebar}>
            <div style={styles.sidebarBrand}>
              <div style={styles.logoBox}>B</div>
              <div>
                <div style={styles.sidebarTitle}>Bamakor</div>
                <div style={styles.sidebarSubtitle}>Maintenance System</div>
              </div>
            </div>

            <nav style={styles.sidebarNav}>
              <Link href="/" style={styles.sidebarNavLink}>
                Dashboard
              </Link>

              <Link href="/tickets" style={{ ...styles.sidebarNavLink, ...styles.sidebarNavItemActive }}>
                Tickets
              </Link>

              <Link href="/projects" style={styles.sidebarNavLink}>
                Projects
              </Link>

              <Link href="/workers" style={styles.sidebarNavLink}>
                Workers
              </Link>

              <Link href="/qr" style={styles.sidebarNavLink}>
                QR Codes
              </Link>

              <Link href="/summary" style={styles.sidebarNavLink}>
                Summary
              </Link>
            </nav>

            <div style={styles.sidebarFooter}>
              All rights reserved to Yoni Levy
            </div>
          </aside>
        )}

        <div style={{ ...styles.mainArea, ...(isMobile ? styles.mainAreaMobile : {}) }}>
          <div style={styles.header}>
            <div style={styles.mobileTopRow}>
              <Link href="/" style={styles.backButton}>
                ←
              </Link>
              <div>
                <h1 style={styles.title}>All Tickets</h1>
                <p style={styles.subtitle}>Manage and track maintenance requests</p>
              </div>
            </div>

            <div style={styles.headerActions}>
              <button 
                onClick={() => setShowAddTicketModal(true)}
                style={styles.primaryButton}
              >
                + New Ticket
              </button>
            </div>
          </div>

          <div style={{
            ...styles.statsGrid,
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
          }}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Total Tickets</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Open</div>
              <div style={styles.statValue}>{stats.open}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>In Progress</div>
              <div style={styles.statValue}>{stats.assigned}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Resolved</div>
              <div style={styles.statValue}>{stats.resolved}</div>
            </div>
          </div>

          <div style={styles.filtersCard}>
            <div style={styles.filtersHeader}>Filters</div>

            <div
              style={{
                ...styles.filtersRow,
                gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr 1fr 1fr',
              }}
            >
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tickets..."
                style={styles.input}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.select}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'All Status' : status}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={styles.select}
              >
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority === 'ALL' ? 'All Priority' : priority}
                  </option>
                ))}
              </select>

              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                style={styles.select}
              >
                {projectOptions.map((projectCode) => (
                  <option key={projectCode} value={projectCode}>
                    {projectCode === 'ALL' ? 'All Projects' : projectCode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && <p style={styles.infoText}>Loading tickets...</p>}
          {error && <p style={styles.errorText}>{error}</p>}

          {!loading && !error && (
            <div style={styles.resultCount}>{filteredTickets.length} tickets found</div>
          )}

          {!loading && !error && filteredTickets.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyStateTitle}>No tickets found</div>
              <div style={styles.emptyStateText}>
                Try adjusting the filters or search term.
              </div>
            </div>
          )}

          {!loading && !error && filteredTickets.length > 0 && !isMobile && (
            <div style={styles.tableCard}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Ticket</th>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Project</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Priority</th>
                    <th style={styles.th}>Assigned</th>
                    <th style={styles.th}>Created</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} onClick={() => openTicket(ticket)} style={{ cursor: 'pointer' }}>
                      <td style={styles.tdStrong}>TKT-{ticket.ticket_number}</td>

                      <td style={styles.td}>
                        <div style={styles.ticketTitle}>{ticket.description || 'No description'}</div>
                        <div style={styles.ticketSubtitle}>
                          {ticket.reporter_name || ticket.reporter_phone || 'No reporter info'}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.projectChip}>{ticket.project_code || '-'}</span>
                      </td>

                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...getStatusStyle(ticket.status) }}>
                          {ticket.status}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...getPriorityStyle(ticket.priority) }}>
                          {(ticket.priority || 'LOW').toUpperCase()}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <select
                          value={ticket.assigned_worker_id || ''}
                          onChange={(e) => assignWorker(ticket.id, e.target.value)}
                          style={styles.inlineSelect}
                          disabled={actionLoadingId === ticket.id || ticket.status === 'CLOSED'}
                        >
                          <option value="">Unassigned</option>
                          {workers.map((worker) => (
                            <option key={worker.id} value={worker.id}>
                              {worker.full_name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        {ticket.created_at ? formatDate(ticket.created_at) : '-'}
                      </td>

                      <td style={styles.td}>
                        {ticket.status === 'CLOSED' ? (
                          <span style={styles.doneText}>Done</span>
                        ) : (
                          <button
                            onClick={() => closeTicket(ticket.id)}
                            style={styles.closeButton}
                            disabled={actionLoadingId === ticket.id}
                          >
                            {actionLoadingId === ticket.id ? 'Saving...' : 'Close'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && filteredTickets.length > 0 && isMobile && (
            <div style={styles.mobileCards}>
              {filteredTickets.map((ticket) => (
                <div key={ticket.id} onClick={() => openTicket(ticket)} style={styles.mobileCard}>
                  <div style={styles.mobileCardTop}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={styles.mobileTicketNumber}>#{ticket.ticket_number}</div>
                        {/* Attachment indicator */}
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#C1121F' }}>📷</div>
                      </div>
                      <div style={styles.mobileProject}>
                        {ticket.project_code || '-'}
                      </div>
                    </div>

                    <span style={{ ...styles.badge, ...getStatusStyle(ticket.status) }}>
                      {ticket.status}
                    </span>
                  </div>

                  <div style={styles.mobileDescription}>
                    {ticket.description || 'No description'}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ ...styles.badge, ...getPriorityStyle(ticket.priority) }}>
                      {(ticket.priority || 'LOW').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      {ticket.assigned_worker_id ? getWorkerName(ticket.assigned_worker_id) : 'Unassigned'}
                    </span>
                  </div>

                  <div style={styles.mobileActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        assignWorker(ticket.id, 'temp')
                        setSelectedTicket(ticket)
                        openTicket(ticket)
                      }}
                      style={{ ...styles.mobileActionButton, flex: 1 }}
                      disabled={actionLoadingId === ticket.id}
                    >
                      {ticket.status === 'CLOSED' ? '✓ Done' : 'Assign'}
                    </button>
                    {ticket.status !== 'CLOSED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTicket(ticket.id)
                        }}
                        style={{ ...styles.mobileActionButton, ...styles.mobileActionButtonSecondary, flex: 1 }}
                        disabled={actionLoadingId === ticket.id}
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddTicketModal && (
        <>
          <div style={styles.modalOverlay} onClick={() => setShowAddTicketModal(false)} />
          <div style={styles.addTicketModal}>
            <div style={styles.addTicketModalHeader}>
              <h3 style={styles.addTicketModalTitle}>Create New Ticket</h3>
              <button
                onClick={() => setShowAddTicketModal(false)}
                style={styles.addTicketModalClose}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={styles.addTicketForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Project *</label>
                <select
                  value={addTicketForm.project_code}
                  onChange={(e) =>
                    setAddTicketForm({
                      ...addTicketForm,
                      project_code: e.target.value,
                    })
                  }
                  style={styles.formSelect}
                >
                  <option value="">Select a project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.project_code}>
                      {p.project_code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description *</label>
                <textarea
                  value={addTicketForm.description}
                  onChange={(e) =>
                    setAddTicketForm({
                      ...addTicketForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter ticket description (min 3 characters)"
                  style={styles.formTextarea}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reporter Name</label>
                <input
                  type="text"
                  value={addTicketForm.reporter_name}
                  onChange={(e) =>
                    setAddTicketForm({
                      ...addTicketForm,
                      reporter_name: e.target.value,
                    })
                  }
                  placeholder="Enter reporter name"
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reporter Phone</label>
                <input
                  type="tel"
                  value={addTicketForm.reporter_phone}
                  onChange={(e) =>
                    setAddTicketForm({
                      ...addTicketForm,
                      reporter_phone: e.target.value,
                    })
                  }
                  placeholder="Enter phone number"
                  style={styles.formInput}
                />
              </div>

              {addTicketError && (
                <div style={styles.formError}>{addTicketError}</div>
              )}

              <div style={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setShowAddTicketModal(false)}
                  style={styles.formCancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTicket}
                  style={{
                    ...styles.formSubmitButton,
                    opacity: addingTicket ? 0.6 : 1,
                    cursor: addingTicket ? 'not-allowed' : 'pointer',
                  }}
                >
                  {addingTicket ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {selectedTicket && (
        <>
          <div 
            style={styles.drawerOverlay}
          />
          <div
            style={{
              ...styles.drawer,
              ...(isMobile ? { ...styles.drawerMobile, left: 0, right: 'auto' } : {}),
              width: isMobile ? '100vw' : '440px',
              right: !isMobile ? 0 : 'auto',
            }}
          >
            <div style={styles.drawerHeader}>
              <button onClick={closeDrawer} style={styles.drawerCloseButton}>
                {isMobile ? '←' : '✕'}
              </button>
              <div style={{ flex: 1 }}>
                <div style={styles.drawerTitle}>
                  Ticket #{selectedTicket.ticket_number}
                </div>
                <div style={styles.drawerSubtitle}>
                  {selectedTicket.project_code} - {selectedTicket.project_name}
                </div>
              </div>
            </div>

            <div style={styles.drawerContentWrapper} data-drawer-content="true">
              {/* PRIMARY: Description - high emphasis */}
              <div style={{...styles.drawerSection, ...styles.descriptionSection}}>
                <div style={styles.descriptionValue}>{selectedTicket.description || 'No description provided'}</div>
              </div>

            {/* Attachments - first-class UX */}
            <div style={styles.drawerSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={styles.drawerLabel}>📷 Attachments</div>
                {selectedTicketAttachments.length > 0 && (
                  <span style={{ fontSize: '11px', background: '#FEF2F2', color: '#C1121F', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    {selectedTicketAttachments.length}
                  </span>
                )}
              </div>
              {loadingAttachments ? (
                <div style={{ fontSize: '13px', color: '#6B7280' }}>Loading images...</div>
              ) : selectedTicketAttachments.length > 0 ? (
                <div style={styles.attachmentGrid}>
                  {selectedTicketAttachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => setSelectedImageUrl(getImageUrl(attachment))}
                      style={styles.attachmentThumbnail}
                      title={attachment.file_name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getImageUrl(attachment)}
                        alt={attachment.file_name}
                        style={styles.attachmentImg}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#9CA3AF' }}>No images attached</div>
              )}
            </div>

            {/* KEY ACTIONS - clear, prominent */}
            <div style={{...styles.drawerActionsZone}}>
              <button 
                onClick={saveTicketChanges} 
                style={styles.primaryActionButton} 
                disabled={savingTicket}
              >
                {savingTicket ? 'Saving...' : '💾 Save Changes'}
              </button>
              {selectedTicket.status !== 'CLOSED' && (
                <button 
                  onClick={() => closeTicket(selectedTicket.id)} 
                  style={styles.dangerActionButton} 
                  disabled={actionLoadingId === selectedTicket.id}
                >
                  {actionLoadingId === selectedTicket.id ? 'Closing...' : '✓ Close Ticket'}
                </button>
              )}
            </div>

            {/* METADATA & CONTROLS - lighter section */}
            <div style={styles.metadataSection}>
              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Reporter</div>
                <div style={styles.drawerValue}>
                  {selectedTicket.reporter_name || selectedTicket.reporter_phone || '-'}
                </div>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Assigned Worker</div>
                <select
                  value={selectedTicket.assigned_worker_id || ''}
                  onChange={(e) => assignWorker(selectedTicket.id, e.target.value)}
                  style={styles.select}
                >
                  <option value="">Unassigned</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Status</div>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  style={styles.select}
                >
                  {statusOptions.filter((s) => s !== 'ALL').map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Priority</div>
                <select
                  value={draftPriority}
                  onChange={(e) => setDraftPriority(e.target.value)}
                  style={styles.select}
                >
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Created</div>
                <div style={styles.drawerValue}>
                  {selectedTicket.created_at ? formatDate(selectedTicket.created_at) : '-'}
                </div>
              </div>

              <div style={{...styles.drawerSection, borderBottom: 'none'}}>
                <div style={styles.drawerLabel}>Closed</div>
                <div style={styles.drawerValue}>
                  {selectedTicket.closed_at ? formatDate(selectedTicket.closed_at) : '-'}
                </div>
              </div>
            </div>
            </div>
          </div>

          {selectedImageUrl && (
            <>
              <div onClick={() => setSelectedImageUrl(null)} style={styles.imageModalOverlay} />
              <div style={styles.imageModal}>
                <button onClick={() => setSelectedImageUrl(null)} style={styles.imageModalClose}>
                  ✕
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImageUrl} alt="Full view" style={styles.imageModalImg} />
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100dvh',
    overflow: 'clip',
    background: '#F5F5F7',
    color: '#1F2937',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
  },
  appShell: {
    display: 'grid',
    minHeight: '100dvh',
    overflow: 'visible',
  },
  shell: {
    display: 'grid',
    minHeight: '100dvh',
    overflow: 'visible',
  },
  mainArea: {
    padding: '24px',
    paddingTop: 'calc(24px + env(safe-area-inset-top))',
    height: '100%',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
  },
  mainAreaMobile: {
    padding: '16px',
    paddingTop: 'calc(16px + env(safe-area-inset-top))',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #E5E5E9',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100%',
    justifyContent: 'space-between',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
  },
  logoBox: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #C1121F 0%, #8F0B16 100%)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '18px',
  },
  sidebarTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#1F2937',
  },
  sidebarSubtitle: {
    fontSize: '12px',
    color: '#4B5563',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sidebarNavItemActive: {
    background: '#111827',
    color: '#FFFFFF',
  },
  sidebarNavLink: {
    textDecoration: 'none',
    color: '#374151',
    fontWeight: 700,
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FFFFFF',
  },
  navItemDisabled: {
    textDecoration: 'none',
    color: '#9CA3AF',
    fontWeight: 700,
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#F8F8FB',
    pointerEvents: 'none',
  },
  sidebarFooter: {
    marginTop: 'auto',
    fontSize: '13px',
    color: '#4B5563',
    padding: '12px 14px',
  },
  content: {
    padding: '24px',
    paddingTop: 'calc(24px + env(safe-area-inset-top))',
    height: '100%',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  primaryButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 800,
    color: '#1F2937',
    lineHeight: 1,
  },
  subtitle: {
    margin: '10px 0 0 0',
    fontSize: '16px',
    color: '#4B5563',
  },

  mobileLink: {
    textDecoration: 'none',
    color: '#1F2937',
    fontWeight: 700,
    fontSize: '13px',
    padding: '10px 14px',
    borderRadius: '10px',
    background: '#F8F8FB',
    border: '1px solid #E5E5E9',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  statCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E5E9',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    minHeight: '110px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: '14px',
    color: '#4B5563',
    marginBottom: '12px',
    fontWeight: 600,
  },
  statValue: {
    fontSize: '42px',
    fontWeight: 800,
    color: '#1F2937',
    lineHeight: 1,
  },
  filtersCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E5E9',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '18px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
  },
  filtersHeader: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#1F2937',
    marginBottom: '16px',
  },
  mobileTopRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  backButton: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #D9D9E3',
    color: '#1F2937',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    flexShrink: 0,
  },
  filtersRow: {
    display: 'grid',
    gap: '12px',
    width: '100%',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #D9D9E3',
    background: '#FFFFFF',
    fontSize: '14px',
    outline: 'none',
    color: '#1F2937',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #D9D9E3',
    background: '#FFFFFF',
    fontSize: '14px',
    outline: 'none',
    color: '#1F2937',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  resultCount: {
    fontSize: '15px',
    color: '#374151',
    marginBottom: '12px',
    fontWeight: 600,
  },
  tableCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E5E9',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '16px 16px',
    background: '#FFFFFF',
    color: '#4B5563',
    fontSize: '12px',
    fontWeight: 700,
    borderBottom: '1px solid #D9D9E3',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '16px 16px',
    borderBottom: '1px solid #E5E5E9',
    fontSize: '14px',
    color: '#1F2937',
    verticalAlign: 'top',
  },
  tdStrong: {
    padding: '16px 16px',
    borderBottom: '1px solid #E5E5E9',
    fontSize: '14px',
    color: '#1F2937',
    fontWeight: 800,
    verticalAlign: 'top',
  },
  ticketTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1F2937',
    marginBottom: '6px',
  },
  ticketSubtitle: {
    fontSize: '13px',
    color: '#4B5563',
    lineHeight: 1.45,
  },
  projectChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#F9FAFB',
    border: '1px solid rgba(0,0,0,0.04)',
    fontSize: '12px',
    fontWeight: 700,
    color: '#374151',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  inlineSelect: {
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #D9D9E3',
    background: '#FFFFFF',
    fontSize: '13px',
    color: '#1F2937',
    outline: 'none',
    minWidth: '160px',
  },
  closeButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: '1px solid #111827',
    padding: '10px 14px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
  doneText: {
    color: '#16A34A',
    fontWeight: 700,
    fontSize: '13px',
  },
  emptyState: {
    background: '#FFFFFF',
    border: '1px solid #E5E5E9',
    borderRadius: '20px',
    padding: '28px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
  },
  emptyStateTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#1F2937',
    marginBottom: '8px',
  },
  emptyStateText: {
    fontSize: '14px',
    color: '#4B5563',
  },
  infoText: {
    margin: '0 0 12px 0',
    color: '#4B5563',
  },
  errorText: {
    margin: '0 0 12px 0',
    color: '#DC2626',
    fontWeight: 600,
  },
  mobileCards: {
    display: 'grid',
    gap: '14px',
  },
  mobileCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E5E9',
    borderRadius: '20px',
    padding: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    transition: 'all 0.2s ease',
  },
  mobileCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
    alignItems: 'flex-start',
  },
  mobileCardHeader: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    marginBottom: '2px',
  },
  mobileTicketNumber: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#1F2937',
    lineHeight: 1.2,
  },
  mobileAttachmentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#FEF2F2',
    color: '#C1121F',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 700,
  },
  mobileProject: {
    fontSize: '13px',
    color: '#4B5563',
    marginTop: '6px',
  },
  mobileDescription: {
    fontSize: '14px',
    color: '#1F2937',
    lineHeight: 1.5,
    marginBottom: '12px',
  },
  mobileMeta: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  mobileMetaText: {
    fontSize: '13px',
    color: '#6B7280',
  },
  mobileField: {
    marginBottom: '14px',
  },
  mobileFieldLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '8px',
  },
  mobileSelect: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #D9D9E3',
    background: '#FFFFFF',
    fontSize: '14px',
    color: '#1F2937',
    outline: 'none',
  },
  mobileActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  mobileActionButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: 'none',
    padding: '11px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
  mobileActionButtonSecondary: {
    background: '#F0F0F0',
    color: '#111827',
    border: '1px solid rgba(0,0,0,0.08)',
  },
  mobileAssignedText: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: 600,
  },
  drawerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.25)',
    zIndex: 50,
    pointerEvents: 'none',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '440px',
    maxWidth: '100%',
    height: '100dvh',
    background: '#FFFFFF',
    borderLeft: '1px solid #E5E5E9',
    zIndex: 60,
    padding: '20px',
    paddingTop: 'calc(20px + env(safe-area-inset-top))',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  drawerMobile: {
    width: '100%',
    left: 0,
    right: 'auto',
    height: '100dvh',
    borderLeft: 'none',
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  drawerHeader: {
    background: '#FFFFFF',
    paddingTop: '4px',
    paddingBottom: '12px',
    zIndex: 50,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px',
    borderBottom: '1px solid #E5E5E9',
    paddingLeft: '16px',
    paddingRight: '16px',
    marginLeft: '0',
    marginRight: '0',
    flex: '0 0 auto',
  },
  drawerContentWrapper: {
    flex: '1 1 0%',
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingBottom: '120px',
  },
  drawerTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#1F2937',
    marginBottom: '6px',
    lineHeight: 1.2,
  },
  drawerSubtitle: {
    color: '#4B5563',
    fontSize: '14px',
    fontWeight: '500',
  },
  drawerCloseButton: {
    background: '#F8F8FB',
    color: '#1F2937',
    border: '1px solid #E5E5E9',
    borderRadius: '12px',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    fontSize: '16px',
    flexShrink: 0,
  },
  drawerSection: {
    marginBottom: '18px',
    paddingBottom: '16px',
    borderBottom: '1px solid #E5E5E9',
    paddingLeft: '16px',
    paddingRight: '16px',
    marginLeft: '0',
    marginRight: '0',
  },
  drawerLabel: {
    color: '#4B5563',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
    fontWeight: 700,
  },
  drawerValue: {
    color: '#1F2937',
    fontSize: '15px',
    lineHeight: 1.6,
    fontWeight: '500',
  },
  drawerActions: {
    marginTop: '6px',
    paddingTop: '14px',
    display: 'flex',
    gap: '10px',
    flexDirection: 'column',
    borderTop: '1px solid #E5E5E9',
  },
  descriptionSection: {
    marginBottom: '20px !important',
    paddingBottom: '20px !important',
    borderBottom: '2px solid rgba(193, 18, 31, 0.15) !important',
  },
  descriptionValue: {
    fontSize: '16px',
    lineHeight: 1.7,
    color: '#1F2937',
    fontWeight: '500',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  drawerActionsZone: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #E5E5E9',
  },
  primaryActionButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: 'none',
    padding: '14px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '15px',
    minHeight: '48px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(17, 24, 39, 0.15)',
  },
  dangerActionButton: {
    background: '#C1121F',
    color: '#FFFFFF',
    border: 'none',
    padding: '14px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '15px',
    minHeight: '48px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(193, 18, 31, 0.2)',
  },
  metadataSection: {
    background: '#F8F8FB',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '0',
    marginBottom: '100px',
  },
  primarySaveButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
  attachmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: '12px',
  },
  attachmentThumbnail: {
    background: '#F8F8FB',
    border: '2px solid #E5E5E9',
    borderRadius: '12px',
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    height: '90px',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  attachmentImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imageModalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 101,
    maxWidth: '90vw',
    maxHeight: '90vh',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  imageModalImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    maxWidth: '90vw',
    maxHeight: '80vh',
  },
  imageModalClose: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    fontSize: '18px',
    cursor: 'pointer',
    zIndex: 102,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 150,
  },
  addTicketModal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '500px',
    background: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    zIndex: 200,
    maxHeight: '90vh',
    overflow: 'auto',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  addTicketModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #E5E7EB',
    position: 'sticky',
    top: 0,
    background: '#FFFFFF',
    zIndex: 1,
  },
  addTicketModalTitle: {
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#1F2937',
    margin: 0,
  },
  addTicketModalClose: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: '#4B5563',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTicketForm: {
    padding: '16px',
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
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  formInput: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D9D9E3',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  },
  formSelect: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D9D9E3',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    background: '#FFFFFF',
    cursor: 'pointer',
  },
  formTextarea: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D9D9E3',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    minHeight: '100px',
    resize: 'vertical' as const,
  },
  formError: {
    padding: '10px 12px',
    background: '#FEE2E2',
    color: '#DC2626',
    borderRadius: '6px',
    fontSize: '13px',
  },
  formActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  formCancelButton: {
    padding: '10px 16px',
    background: '#F8F8FB',
    color: '#1F2937',
    border: '1px solid #D9D9E3',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
  formSubmitButton: {
    padding: '10px 16px',
    background: '#111827',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
}
