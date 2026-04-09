'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

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
  const [selectedTicketAttachments, setSelectedTicketAttachments] = useState<AttachmentRow[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

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
  }, [])

  async function fetchData() {
    setLoading(true)
    setError('')

    try {
      const { data: ticketsData, error: ticketsError } = await supabase
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
        .order('created_at', { ascending: false })

      if (ticketsError) throw ticketsError

      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('id, full_name, phone, email, role, is_active')
        .order('full_name', { ascending: true })

      if (workersError) throw workersError

      const normalizedTickets: TicketRow[] = ((ticketsData as TicketRow[]) || []).map((ticket) => {
        const project = Array.isArray(ticket.projects) ? ticket.projects[0] : ticket.projects

        return {
          ...ticket,
          project_code: project?.project_code || '',
          project_name: project?.name || '',
        }
      })

      setTickets(normalizedTickets)
      setWorkers((workersData as WorkerRow[]) || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets')
      setTickets([])
      setWorkers([])
    } finally {
      setLoading(false)
    }
  }

  async function assignWorker(ticketId: string, workerId: string) {
    if (!workerId) return

    setActionLoadingId(ticketId)
    try {
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

      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to assign worker')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function closeTicket(ticketId: string) {
    setActionLoadingId(ticketId)
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
        })
        .eq('id', ticketId)

      if (error) throw error

      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to close ticket')
    } finally {
      setActionLoadingId(null)
    }
  }

  function openTicket(ticket: TicketRow) {
    setSelectedTicket(ticket)
    setDraftPriority(ticket.priority || 'LOW')
    setDraftStatus(ticket.status)
    loadTicketAttachments(ticket.id)
  }

  async function loadTicketAttachments(ticketId: string) {
    setLoadingAttachments(true)
    try {
      // STABILITY: Validate ticketId before query
      if (!ticketId) {
        console.error('❌ Cannot load attachments: ticketId is missing or empty')
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
          error: error.message,
          code: error.code,
        })
        setSelectedTicketAttachments([])
      } else if (!data || data.length === 0) {
        console.log(`ℹ️ No attachments found for ticket ${ticketId}`)
        setSelectedTicketAttachments([])
      } else {
        console.log(`📦 Found ${data.length} attachment(s) for ticket ${ticketId}`)
        
        // Generate signed URLs for each attachment for reliable access
        const attachmentsWithUrls = await Promise.all(
          (data || []).map(async (attachment: any) => {
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

  function getImageUrl(attachment: any): string {
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

  async function updatePriority(ticketId: string, priority: string) {
    setSavingTicket(true)
    try {
      const response = await fetch('/api/update-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          priority: priority,
          status: draftStatus,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update ticket')
      }

      setDraftPriority(priority)
      await fetchData()
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket')
    } finally {
      setSavingTicket(false)
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
    } catch (err: any) {
      alert(err.message || 'Failed to save changes')
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
        return { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }
      case 'ASSIGNED':
        return { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }
      case 'IN_PROGRESS':
        return { background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }
      case 'WAITING_PARTS':
        return { background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }
      case 'CLOSED':
        return { background: '#ECFDF5', color: '#16A34A', border: '1px solid #BBF7D0' }
      default:
        return { background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }
    }
  }

  function getPriorityStyle(priority?: string | null): CSSProperties {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH':
        return { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }
      case 'MEDIUM':
        return { background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }
      case 'LOW':
        return { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
      default:
        return { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
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
          ...styles.shell,
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

        <section style={styles.content}>
          <div style={styles.header}>
            <div>
              <h1 style={styles.title}>All Tickets</h1>
              <p style={styles.subtitle}>Manage and track maintenance requests</p>
            </div>

            {isMobile && (
             <div style={styles.mobileTopLinks}>
  <Link href="/" style={styles.mobileLink}>Dashboard</Link>
  <Link href="/summary" style={styles.mobileLink}>Summary</Link>
  <Link href="/qr" style={styles.mobileLink}>QR</Link>
</div>
            )}
          </div>

          <div style={styles.statsGrid}>
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
        </section>
      </div>

      {selectedTicket && (
        <>
          <div onClick={closeDrawer} style={styles.drawerOverlay} />
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
                {isMobile ? '← Back' : '✕'}
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

          {selectedImageUrl && (
            <>
              <div onClick={() => setSelectedImageUrl(null)} style={styles.imageModalOverlay} />
              <div style={styles.imageModal}>
                <button onClick={() => setSelectedImageUrl(null)} style={styles.imageModalClose}>
                  ✕
                </button>
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
    minHeight: '100vh',
    background: '#F5F6F8',
    color: '#111827',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
  },
  shell: {
    display: 'grid',
    minHeight: '100vh',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid rgba(0,0,0,0.04)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    justifyContent: 'space-between',
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
    color: '#111827',
  },
  sidebarSubtitle: {
    fontSize: '12px',
    color: '#6B7280',
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
    background: '#F9FAFB',
    pointerEvents: 'none',
  },
  sidebarFooter: {
    marginTop: 'auto',
    fontSize: '13px',
    color: '#6B7280',
    padding: '12px 14px',
  },
  content: {
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1,
  },
  subtitle: {
    margin: '10px 0 0 0',
    fontSize: '16px',
    color: '#6B7280',
  },
  mobileTopLinks: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  mobileLink: {
    textDecoration: 'none',
    color: '#111827',
    fontWeight: 700,
    fontSize: '13px',
    padding: '10px 14px',
    borderRadius: '10px',
    background: '#F9F9FA',
    border: '1px solid rgba(0,0,0,0.08)',
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
    border: '1px solid rgba(0,0,0,0.04)',
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
    color: '#6B7280',
    marginBottom: '12px',
    fontWeight: 600,
  },
  statValue: {
    fontSize: '42px',
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1,
  },
  filtersCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.04)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '18px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
  },
  filtersHeader: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '16px',
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
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    fontSize: '14px',
    outline: 'none',
    color: '#111827',
    minHeight: '44px',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    fontSize: '14px',
    outline: 'none',
    color: '#111827',
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
    border: '1px solid rgba(0,0,0,0.04)',
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
    color: '#6B7280',
    fontSize: '12px',
    fontWeight: 700,
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '16px 16px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    fontSize: '14px',
    color: '#111827',
    verticalAlign: 'top',
  },
  tdStrong: {
    padding: '16px 16px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    fontSize: '14px',
    color: '#111827',
    fontWeight: 800,
    verticalAlign: 'top',
  },
  ticketTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '6px',
  },
  ticketSubtitle: {
    fontSize: '13px',
    color: '#6B7280',
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
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    fontSize: '13px',
    color: '#111827',
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
    border: '1px solid rgba(0,0,0,0.04)',
    borderRadius: '20px',
    padding: '28px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
  },
  emptyStateTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '8px',
  },
  emptyStateText: {
    fontSize: '14px',
    color: '#6B7280',
  },
  infoText: {
    margin: '0 0 12px 0',
    color: '#6B7280',
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
    border: '1px solid rgba(0,0,0,0.08)',
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
    color: '#111827',
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
    color: '#6B7280',
    marginTop: '6px',
  },
  mobileDescription: {
    fontSize: '14px',
    color: '#111827',
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
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    fontSize: '14px',
    color: '#111827',
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
  },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100dvh',
    background: '#FFFFFF',
    borderLeft: '1px solid rgba(0,0,0,0.08)',
    zIndex: 60,
    padding: '20px',
    paddingTop: 'calc(20px + env(safe-area-inset-top))',
    overflowY: 'auto',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
  },
  drawerMobile: {
    width: '100% !important',
    left: '0 !important',
    right: 'auto !important',
    borderRadius: '0',
    padding: '0',
    height: '100dvh !important',
    paddingTop: 'env(safe-area-inset-top)',
    borderLeft: 'none',
    boxShadow: 'none',
  },
  drawerHeader: {
    position: 'sticky',
    top: 0,
    background: '#FFFFFF',
    paddingTop: '4px',
    paddingBottom: '12px',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    paddingLeft: '16px',
    paddingRight: '16px',
  },
  drawerTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '6px',
    lineHeight: 1.2,
  },
  drawerSubtitle: {
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: '500',
  },
  drawerCloseButton: {
    background: '#F9F9FA',
    color: '#2F2F33',
    border: '1px solid rgba(0,0,0,0.08)',
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
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    paddingLeft: '16px',
    paddingRight: '16px',
  },
  drawerLabel: {
    color: '#6B7280',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
    fontWeight: 700,
  },
  drawerValue: {
    color: '#111827',
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
    borderTop: '1px solid rgba(0,0,0,0.04)',
  },
  descriptionSection: {
    marginBottom: '20px !important',
    paddingBottom: '20px !important',
    borderBottom: '2px solid rgba(193, 18, 31, 0.15) !important',
  },
  descriptionValue: {
    fontSize: '16px',
    lineHeight: 1.7,
    color: '#111827',
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
    borderBottom: '1px solid rgba(0,0,0,0.08)',
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
    background: '#F9F9FA',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '0',
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
    background: '#F9F9FA',
    border: '2px solid rgba(0,0,0,0.06)',
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
}
