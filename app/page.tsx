'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

type TicketRow = {
  id: string
  ticket_number: number
  project_id?: string
  project_code?: string
  project_name?: string
  reporter_phone: string
  description: string
  status: string
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

const tabs = [
  { key: 'all', label: 'All Tickets', source: 'all' },
  { key: 'BMK1', label: 'BMK1 - קוואדרה', source: 'project_bmk1_tickets' },
  { key: 'BMK2', label: 'BMK2 - צוותא', source: 'project_bmk2_tickets' },
  { key: 'BMK3', label: 'BMK3 - ארנונה', source: 'project_bmk3_tickets' },
  { key: 'BMK4', label: 'BMK4 - רחביה', source: 'project_bmk4_tickets' },
  { key: 'BMK5', label: 'BMK5 - קטמון הישנה', source: 'project_bmk5_tickets' },
] as const

const statusOptions = ['ALL', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const
const editableStatusOptions = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const

const WHATSAPP_NUMBER = '972500000000'

function MobileTicketCard({
  ticket,
  workersMap,
  assignWorker,
  closeTicket,
  updateTicketStatus,
  openTicket,
  getStatusStyle,
}: {
  ticket: TicketRow
  workersMap: Record<string, string>
  assignWorker: (ticketId: string, workerId: string) => Promise<void>
  closeTicket: (ticketId: string) => Promise<void>
  updateTicketStatus: (ticketId: string, status: string) => Promise<void>
  openTicket: (ticket: TicketRow) => void
  getStatusStyle: (status: string) => CSSProperties
}) {
  return (
    <div onClick={() => openTicket(ticket)} style={styles.mobileCard}>
      <div style={styles.mobileCardHeader}>
        <div style={styles.mobileCardHeaderLeft}>
          <div style={styles.mobileCardTicketNumber}>#{ticket.ticket_number}</div>
          <div style={styles.mobileProject}>{ticket.project_name || '-'}</div>
          <div style={styles.mobileProjectCode}>{ticket.project_code || '-'}</div>
        </div>

        <span
          style={{
            ...styles.statusBadge,
            ...getStatusStyle(ticket.status),
          }}
        >
          {ticket.status}
        </span>
      </div>

      <div style={styles.mobileDescription}>{ticket.description || '-'}</div>

      <div style={styles.mobileMetaGroup}>
        <div style={styles.mobileMeta}>📞 {ticket.reporter_phone}</div>
        <div style={styles.mobileMeta}>🕒 {new Date(ticket.created_at).toLocaleString()}</div>
      </div>

      <div style={styles.mobileField} onClick={(e) => e.stopPropagation()}>
        <div style={styles.mobileFieldLabel}>Status</div>
        <select
          value={ticket.status}
          onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
          style={{
            ...styles.select,
            ...styles.mobileTouchSelect,
          }}
        >
          {editableStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.mobileField} onClick={(e) => e.stopPropagation()}>
        <div style={styles.mobileFieldLabel}>Worker</div>
        <select
          value={ticket.assigned_worker_id || ''}
          onChange={(e) => assignWorker(ticket.id, e.target.value)}
          style={{
            ...styles.select,
            ...styles.mobileTouchSelect,
          }}
        >
          <option value="">Assign Worker</option>
          {Object.entries(workersMap).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.mobileActions} onClick={(e) => e.stopPropagation()}>
        {ticket.status !== 'CLOSED' ? (
          <button onClick={() => closeTicket(ticket.id)} style={styles.closeButton}>
            Close Ticket
          </button>
        ) : (
          <span style={styles.closedText}>Done</span>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('all')
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [allTickets, setAllTickets] = useState<TicketRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [workersMap, setWorkersMap] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState(false)

  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null)
  const [ticketLogs, setTicketLogs] = useState<TicketLog[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [savingTicket, setSavingTicket] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showQrSection, setShowQrSection] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [activeKpi, setActiveKpi] = useState<'ALL' | 'NEW' | 'ASSIGNED' | 'CLOSED'>('ALL')
  const [selectedProjectCode, setSelectedProjectCode] = useState<string>('ALL')

  const [draftDescription, setDraftDescription] = useState('')
  const [draftStatus, setDraftStatus] = useState('NEW')
  const [draftWorkerId, setDraftWorkerId] = useState('')
  const [selectedTicketAttachments, setSelectedTicketAttachments] = useState<any[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  const activeSource = useMemo(() => {
    return tabs.find((t) => t.key === activeTab)?.source || 'all'
  }, [activeTab])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadWorkers()
    loadProjects()
    loadAllTickets()
  }, [])

  useEffect(() => {
    loadTickets(activeSource)
    setMenuOpen(false)
  }, [activeSource])

  useEffect(() => {
    if (!copyMessage) return
    const timer = window.setTimeout(() => setCopyMessage(''), 1800)
    return () => window.clearTimeout(timer)
  }, [copyMessage])

  useEffect(() => {
    const channel = supabase
      .channel('bamakor-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        async () => {
          await Promise.all([loadTickets(activeSource), loadAllTickets()])
          if (selectedTicket) {
            await loadTicketLogs(selectedTicket.id)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticket_logs' },
        async () => {
          if (selectedTicket) {
            await loadTicketLogs(selectedTicket.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeSource, selectedTicket?.id])

  async function loadWorkers() {
    const { data, error } = await supabase
      .from('workers')
      .select('id, full_name')
      .order('full_name', { ascending: true })

    if (!error && data) {
      const map: Record<string, string> = {}
      data.forEach((worker) => {
        map[worker.id] = worker.full_name
      })
      setWorkersMap(map)
    }
  }

  async function loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, project_code')
      .order('project_code', { ascending: true })

    if (!error && data) {
      setProjects(data as ProjectRow[])
    }
  }

  async function loadAllTickets() {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_number,
        project_id,
        reporter_phone,
        description,
        status,
        assigned_worker_id,
        created_at,
        closed_at,
        projects (
          project_code,
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const formatted: TicketRow[] =
        data?.map((row: any) => ({
          id: row.id,
          ticket_number: row.ticket_number,
          project_id: row.project_id,
          project_code: Array.isArray(row.projects) ? row.projects?.[0]?.project_code || '' : row.projects?.project_code || '',
          project_name: Array.isArray(row.projects) ? row.projects?.[0]?.name || '' : row.projects?.name || '',
          reporter_phone: row.reporter_phone,
          description: row.description,
          status: row.status,
          assigned_worker_id: row.assigned_worker_id,
          created_at: row.created_at,
          closed_at: row.closed_at,
        })) || []

      setAllTickets(formatted)
    }
  }

  async function loadTickets(source: string) {
    setLoading(true)
    setError('')

    try {
      if (source === 'all') {
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            id,
            ticket_number,
            project_id,
            reporter_phone,
            description,
            status,
            assigned_worker_id,
            created_at,
            closed_at,
            projects (
              project_code,
              name
            )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error

        const formatted: TicketRow[] =
          data?.map((row: any) => ({
            id: row.id,
            ticket_number: row.ticket_number,
            project_id: row.project_id,
            project_code: Array.isArray(row.projects) ? row.projects?.[0]?.project_code || '' : row.projects?.project_code || '',
            project_name: Array.isArray(row.projects) ? row.projects?.[0]?.name || '' : row.projects?.name || '',
            reporter_phone: row.reporter_phone,
            description: row.description,
            status: row.status,
            assigned_worker_id: row.assigned_worker_id,
            created_at: row.created_at,
            closed_at: row.closed_at,
          })) || []

        setTickets(formatted)
      } else {
        const { data, error } = await supabase
          .from(source)
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        setTickets((data as TicketRow[]) || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tickets')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  async function loadTicketLogs(ticketId: string) {
    setDrawerLoading(true)

    const { data, error } = await supabase
      .from('ticket_logs')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })

    if (!error) {
      setTicketLogs((data as TicketLog[]) || [])
    } else {
      setTicketLogs([])
    }

    setDrawerLoading(false)
  }

  async function refreshData() {
    await Promise.all([loadTickets(activeSource), loadAllTickets()])

    if (selectedTicket) {
      let nextTicket: TicketRow | null = null

      if (activeSource === 'all') {
        const { data } = await supabase
          .from('tickets')
          .select(`
            id,
            ticket_number,
            project_id,
            reporter_phone,
            description,
            status,
            assigned_worker_id,
            created_at,
            closed_at,
            projects (
              project_code,
              name
            )
          `)
          .eq('id', selectedTicket.id)
          .single()

        if (data) {
          const project = Array.isArray(data.projects) ? data.projects?.[0] : data.projects
          nextTicket = {
            id: data.id,
            ticket_number: data.ticket_number,
            project_id: data.project_id,
            project_code: project?.project_code || '',
            project_name: project?.name || '',
            reporter_phone: data.reporter_phone,
            description: data.description,
            status: data.status,
            assigned_worker_id: data.assigned_worker_id,
            created_at: data.created_at,
            closed_at: data.closed_at,
          }
        }
      } else {
        const { data } = await supabase
          .from(activeSource)
          .select('*')
          .eq('id', selectedTicket.id)
          .single()

        if (data) {
          nextTicket = data as TicketRow
        }
      }

      if (nextTicket) {
        setSelectedTicket(nextTicket)
        setDraftDescription(nextTicket.description || '')
        setDraftStatus(nextTicket.status || 'NEW')
        setDraftWorkerId(nextTicket.assigned_worker_id || '')
        await loadTicketLogs(nextTicket.id)
      }
    }
  }

  async function assignWorker(ticketId: string, workerId: string) {
    if (!workerId) {
      await supabase.from('tickets').update({ assigned_worker_id: null }).eq('id', ticketId)
      await refreshData()
      return
    }

    try {
      const response = await fetch('/api/assign-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, worker_id: workerId }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to assign worker')
      }

      await refreshData()
    } catch (err: any) {
      alert(err.message || 'Failed to assign worker')
    }
  }

  async function updateTicketStatus(ticketId: string, nextStatus: string) {
    try {
      const payload: any = { status: nextStatus }
      if (nextStatus === 'CLOSED') payload.closed_at = new Date().toISOString()
      if (nextStatus !== 'CLOSED') payload.closed_at = null

      const { error } = await supabase
        .from('tickets')
        .update(payload)
        .eq('id', ticketId)

      if (error) throw error

      await refreshData()
    } catch (err: any) {
      alert(err.message || 'Failed to update status')
    }
  }

  async function saveSelectedTicket() {
    if (!selectedTicket) return
    setSavingTicket(true)

    try {
      const payload: any = {
        description: draftDescription,
        status: draftStatus,
        assigned_worker_id: draftWorkerId || null,
      }

      if (draftStatus === 'CLOSED') {
        payload.closed_at = selectedTicket.closed_at || new Date().toISOString()
      } else {
        payload.closed_at = null
      }

      const { error } = await supabase
        .from('tickets')
        .update(payload)
        .eq('id', selectedTicket.id)

      if (error) throw error

      await refreshData()
    } catch (err: any) {
      alert(err.message || 'Failed to save ticket')
    } finally {
      setSavingTicket(false)
    }
  }

  async function closeTicket(ticketId: string) {
    try {
      const response = await fetch('/api/close-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to close ticket')
      }

      await refreshData()
    } catch (err: any) {
      alert(err.message || 'Failed to close ticket')
    }
  }

  function openTicket(ticket: TicketRow) {
    setSelectedTicket(ticket)
    setDraftDescription(ticket.description || '')
    setDraftStatus(ticket.status || 'NEW')
    setDraftWorkerId(ticket.assigned_worker_id || '')
    loadTicketLogs(ticket.id)
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

  async function copyText(value: string, label = 'Copied') {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMessage(label)
    } catch {
      alert('Copy failed')
    }
  }

  function exportCurrentViewToCsv() {
    const rows = filteredTickets.map((ticket) => ({
      ticket_number: ticket.ticket_number,
      project_code: ticket.project_code || '',
      project_name: ticket.project_name || '',
      reporter_phone: ticket.reporter_phone,
      description: ticket.description,
      status: ticket.status,
      worker: ticket.assigned_worker_id
        ? workersMap[ticket.assigned_worker_id] || ticket.assigned_worker_id
        : '',
      created_at: ticket.created_at,
      closed_at: ticket.closed_at || '',
    }))

    const headers = [
      'ticket_number',
      'project_code',
      'project_name',
      'reporter_phone',
      'description',
      'status',
      'worker',
      'created_at',
      'closed_at',
    ]

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `bamakor-${activeTab}-tickets.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function buildWhatsappLink(projectCode: string) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`START_${projectCode}`)}`
  }

  const stats = useMemo(() => {
    const total = allTickets.length
    const open = allTickets.filter((t) => t.status === 'NEW').length
    const assigned = allTickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length
    const closed = allTickets.filter((t) => t.status === 'CLOSED').length

    return { total, open, assigned, closed }
  }, [allTickets])

  const projectCounts = useMemo(() => {
    return projects.map((project) => {
      const ticketsForProject = allTickets.filter((t) => t.project_code === project.project_code)

      return {
        ...project,
        total: ticketsForProject.length,
        open: ticketsForProject.filter((t) => t.status === 'NEW').length,
        assigned: ticketsForProject.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length,
        closed: ticketsForProject.filter((t) => t.status === 'CLOSED').length,
      }
    })
  }, [projects, allTickets])

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        searchTerm.trim() === '' ||
        ticket.reporter_phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ticket.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ticket.project_code || '').toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' || ticket.status === statusFilter

      const matchesKpi =
        activeKpi === 'ALL' ||
        (activeKpi === 'NEW' && ticket.status === 'NEW') ||
        (activeKpi === 'ASSIGNED' && (ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS')) ||
        (activeKpi === 'CLOSED' && ticket.status === 'CLOSED')

      const matchesProject =
        selectedProjectCode === 'ALL' || ticket.project_code === selectedProjectCode

      return matchesSearch && matchesStatus && matchesKpi && matchesProject
    })
  }, [tickets, searchTerm, statusFilter, activeKpi, selectedProjectCode])

  function getStatusStyle(status: string): CSSProperties {
    switch (status) {
      case 'NEW':
        return { background: '#FEF3C7', color: '#92400E' }
      case 'ASSIGNED':
        return { background: '#FEE2E2', color: '#991B1B' }
      case 'IN_PROGRESS':
        return { background: '#E5E7EB', color: '#374151' }
      case 'CLOSED':
        return { background: '#DCFCE7', color: '#166534' }
      default:
        return { background: '#E5E7EB', color: '#374151' }
    }
  }

  function getRowStyle(status: string, ticketId: string): CSSProperties {
    const base =
      status === 'NEW'
        ? { background: '#FFFFFF' }
        : status === 'ASSIGNED'
        ? { background: '#FFF5F5' }
        : status === 'IN_PROGRESS'
        ? { background: '#FAFAFA' }
        : status === 'CLOSED'
        ? { background: '#F0FDF4' }
        : { background: '#FFFFFF' }

    if (selectedTicket?.id === ticketId) {
      return {
        ...base,
        boxShadow: 'inset 4px 0 0 #C1121F',
      }
    }

    return base
  }

  function formatLogTitle(actionType: string) {
    switch (actionType) {
      case 'TICKET_CREATED':
        return 'Ticket Created'
      case 'USER_MESSAGE':
        return 'User Message'
      case 'ASSIGNED_TO_WORKER':
        return 'Assigned To Worker'
      case 'TICKET_CLOSED':
        return 'Ticket Closed'
      case 'AUTO_ASSIGNED':
        return 'Auto Assigned'
      default:
        return actionType
    }
  }

  function resetAllFilters() {
    setActiveKpi('ALL')
    setSelectedProjectCode('ALL')
    setStatusFilter('ALL')
    setSearchTerm('')
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
                <div style={styles.sidebarSubtitle}>Maintenance SaaS</div>
              </div>
            </div>

            <nav style={styles.sidebarNav}>
              <a href="/" style={{ ...styles.sidebarNavLink, ...styles.sidebarNavItemActive }}>Dashboard</a>
              <a href="/tickets" style={styles.sidebarNavLink}>Tickets</a>
              <a href="/projects" style={styles.sidebarNavLink}>Projects</a>
              <a href="/workers" style={styles.sidebarNavLink}>Workers</a>
              <a href="/qr" style={styles.sidebarNavLink}>QR Codes</a>
              <a href="/summary" style={styles.sidebarNavLink}>Summary</a>
            </nav>

            <div style={styles.sidebarFooter}>All rights reserved to Yoni Levy</div>
          </aside>
        )}

        <div
          style={{
            ...styles.mainArea,
            ...(isMobile ? styles.mainAreaMobile : {}),
          }}
        >
          <div style={styles.topBar}>
            <div style={styles.brandWrap}>
              <div style={styles.brandRow}>
                {isMobile && (
                  <button
                    onClick={() => setMenuOpen((prev) => !prev)}
                    style={styles.hamburgerButton}
                  >
                    ☰
                  </button>
                )}

                <div>
                  <h1
                    style={{
                      ...styles.title,
                      ...(isMobile ? styles.titleMobile : {}),
                    }}
                  >
                    Dashboard
                  </h1>
                  <p
                    style={{
                      ...styles.subtitle,
                      ...(isMobile ? styles.subtitleMobile : {}),
                    }}
                  >
                    Welcome back. Here's what's happening today.
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.topActions}>
              <button
                onClick={() => setShowQrSection((prev) => !prev)}
                style={styles.secondaryButton}
              >
                QR Management
              </button>

              {!isMobile && (
                <button onClick={exportCurrentViewToCsv} style={styles.secondaryButton}>
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {copyMessage && <div style={styles.copyToast}>{copyMessage}</div>}

          {menuOpen && isMobile && (
            <div style={styles.mobileMenuCard}>
              <div style={styles.mobileMenuTitle}>Navigation</div>

             <div style={styles.mobileMenuList}>
  <a href="/" style={{ ...styles.mobileMenuLink, ...styles.mobileMenuItemActive }}>
    Dashboard
  </a>
  <a href="/summary" style={styles.mobileMenuLink}>
    Summary
  </a>
  <a href="/tickets" style={styles.mobileMenuLink}>
    Tickets
  </a>
  <a href="/workers" style={styles.mobileMenuLink}>
    Workers
  </a>
  <a href="/projects" style={styles.mobileMenuLink}>
    Projects
  </a>
  <a href="/qr" style={styles.mobileMenuLink}>
    QR Codes
  </a>
</div>

            </div>
          )}

          <div
            style={{
              ...styles.statsGrid,
              gridTemplateColumns: isMobile
                ? 'repeat(2, minmax(0, 1fr))'
                : 'repeat(4, minmax(0, 1fr))',
            }}
          >
            <button
              style={{
                ...styles.kpiCard,
                ...(isMobile ? styles.kpiCardMobile : {}),
                ...(activeKpi === 'ALL' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('ALL')}
            >
              <div style={styles.kpiLabel}>Total Tickets</div>
              <div
                style={{
                  ...styles.kpiValue,
                  fontSize: isMobile ? '34px' : '42px',
                }}
              >
                {stats.total}
              </div>
            </button>

            <button
              style={{
                ...styles.kpiCard,
                ...(isMobile ? styles.kpiCardMobile : {}),
                ...(activeKpi === 'NEW' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('NEW')}
            >
              <div style={styles.kpiLabel}>Open</div>
              <div
                style={{
                  ...styles.kpiValue,
                  fontSize: isMobile ? '34px' : '42px',
                }}
              >
                {stats.open}
              </div>
            </button>

            <button
              style={{
                ...styles.kpiCard,
                ...(isMobile ? styles.kpiCardMobile : {}),
                ...(activeKpi === 'ASSIGNED' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('ASSIGNED')}
            >
              <div style={styles.kpiLabel}>Assigned</div>
              <div
                style={{
                  ...styles.kpiValue,
                  fontSize: isMobile ? '34px' : '42px',
                }}
              >
                {stats.assigned}
              </div>
            </button>

            <button
              style={{
                ...styles.kpiCard,
                ...(isMobile ? styles.kpiCardMobile : {}),
                ...(activeKpi === 'CLOSED' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('CLOSED')}
            >
              <div style={styles.kpiLabel}>Closed</div>
              <div
                style={{
                  ...styles.kpiValue,
                  fontSize: isMobile ? '34px' : '42px',
                }}
              >
                {stats.closed}
              </div>
            </button>
          </div>

          <div
            style={{
              ...styles.projectSection,
              padding: isMobile ? '14px' : '18px',
            }}
          >
            <div style={styles.projectSectionHeader}>
              <div>
                <div style={styles.projectSectionTitle}>Projects</div>
                <div style={styles.projectSectionSubtitle}>Scroll horizontally to browse all projects</div>
              </div>

              <button onClick={() => setSelectedProjectCode('ALL')} style={styles.secondaryButtonSmall}>
                Show All
              </button>
            </div>

            <div style={styles.projectScrollRow}>
              {projectCounts.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectCode(project.project_code)}
                  style={{
                    ...styles.projectMiniCard,
                    ...(isMobile ? styles.projectMiniCardMobile : {}),
                    ...(selectedProjectCode === project.project_code
                      ? styles.projectMiniCardActive
                      : {}),
                  }}
                >
                  <div style={styles.projectMiniName}>{project.name}</div>
                  <div style={styles.projectMiniCode}>{project.project_code}</div>
                </button>
              ))}
            </div>
          </div>

          {showQrSection && (
            <div style={styles.qrSectionCard}>
              <div style={styles.qrSectionHeader}>
                <div>
                  <div style={styles.cardTitle}>QR Management</div>
                  <div style={styles.cardSubtitle}>
                    Copy project links and generate QR codes from each WhatsApp link
                  </div>
                </div>
              </div>

              <div style={styles.qrGrid}>
                {projects.map((project) => {
                  const startCode = `START_${project.project_code}`
                  const whatsappLink = buildWhatsappLink(project.project_code)

                  return (
                    <div key={project.id} style={styles.qrProjectCard}>
                      <div style={styles.qrProjectCode}>{project.project_code}</div>
                      <div style={styles.qrProjectName}>{project.name}</div>

                      <div style={styles.qrMetaBlock}>
                        <div style={styles.qrMetaLabel}>Start Code</div>
                        <div style={styles.qrMetaValue}>{startCode}</div>
                      </div>

                      <div style={styles.qrMetaBlock}>
                        <div style={styles.qrMetaLabel}>WhatsApp Link</div>
                        <div style={styles.qrLinkText}>{whatsappLink}</div>
                      </div>

                      <div style={styles.qrActions}>
                        <button
                          onClick={() => copyText(startCode, 'Code copied')}
                          style={styles.secondaryButtonSmall}
                        >
                          Copy Code
                        </button>

                        <button
                          onClick={() => copyText(whatsappLink, 'Link copied')}
                          style={styles.secondaryButtonSmall}
                        >
                          Copy Link
                        </button>

                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noreferrer"
                          style={styles.linkButton}
                        >
                          Open Link
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.cardTitle}>All Tickets</div>
                <div style={styles.cardSubtitle}>
                  Live operational view connected to Supabase
                </div>
              </div>

              <button onClick={resetAllFilters} style={styles.secondaryButtonSmall}>
                Reset Filters
              </button>
            </div>

            <div
              style={{
                ...styles.filtersRow,
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by phone, description or project..."
                style={styles.searchInput}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  ...styles.filterSelect,
                  width: isMobile ? '100%' : '180px',
                }}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {loading && <p style={styles.infoText}>Loading tickets...</p>}
            {error && <p style={styles.errorText}>{error}</p>}

            {!loading && !error && filteredTickets.length === 0 && (
              <p style={styles.infoText}>No tickets found.</p>
            )}

            {!loading && !error && filteredTickets.length > 0 && (
              isMobile ? (
                <div>
                  {filteredTickets.map((ticket) => (
                    <MobileTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      workersMap={workersMap}
                      assignWorker={assignWorker}
                      closeTicket={closeTicket}
                      updateTicketStatus={updateTicketStatus}
                      openTicket={openTicket}
                      getStatusStyle={getStatusStyle}
                    />
                  ))}
                </div>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Ticket #</th>
                        <th style={styles.th}>Project</th>
                        <th style={styles.th}>Phone</th>
                        <th style={styles.th}>Description</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Worker</th>
                        <th style={styles.th}>Created</th>
                        <th style={styles.th}>Closed</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          style={{
                            ...styles.clickableRow,
                            ...getRowStyle(ticket.status, ticket.id),
                          }}
                          onClick={() => openTicket(ticket)}
                        >
                          <td style={styles.td}>{ticket.ticket_number}</td>

                          <td style={styles.td}>
                            <div style={styles.projectCell}>
                              <div style={styles.projectNameMain}>
                                {ticket.project_name || '-'}
                              </div>
                              <div style={styles.projectCode}>{ticket.project_code || '-'}</div>
                            </div>
                          </td>

                          <td style={styles.td}>{ticket.reporter_phone}</td>

                          <td style={styles.td}>
                            <div style={styles.descriptionCell}>
                              {ticket.description || '-'}
                            </div>
                          </td>

                          <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                            <select
                              value={ticket.status}
                              onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                              style={styles.select}
                            >
                              {editableStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                            <select
                              value={ticket.assigned_worker_id || ''}
                              onChange={(e) => assignWorker(ticket.id, e.target.value)}
                              style={styles.select}
                            >
                              <option value="">Assign</option>
                              {Object.entries(workersMap).map(([id, name]) => (
                                <option key={id} value={id}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td style={styles.td}>
                            {new Date(ticket.created_at).toLocaleString()}
                          </td>

                          <td style={styles.td}>
                            {ticket.closed_at
                              ? new Date(ticket.closed_at).toLocaleString()
                              : '-'}
                          </td>

                          <td style={styles.td}>
                            {ticket.status !== 'CLOSED' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  closeTicket(ticket.id)
                                }}
                                style={styles.closeButton}
                              >
                                Close
                              </button>
                            ) : (
                              <span style={styles.closedText}>Done</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {selectedTicket && (
        <>
          <div onClick={() => setSelectedTicket(null)} style={styles.drawerOverlay} />

          <div
            style={{
              ...styles.drawer,
              ...(isMobile ? styles.drawerMobile : {}),
              width: isMobile ? '100%' : '440px',
            }}
          >
            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerTitle}>
                  Ticket #{selectedTicket.ticket_number}
                </div>

                <div style={styles.drawerSubtitle}>
                  {selectedTicket.project_code} - {selectedTicket.project_name}
                </div>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                style={styles.drawerCloseButton}
              >
                ✕
              </button>
            </div>

            {/* PRIMARY: Description with high emphasis */}
            <div style={{...styles.drawerSection, ...styles.descriptionSection}}>
              <div style={styles.drawerLabel}>Description</div>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                style={{...styles.drawerTextarea, ...styles.descriptionTextarea}}
              />
            </div>

            {/* Attachments - first-class UX */}
            {selectedTicketAttachments.length > 0 && (
              <div style={styles.drawerSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={styles.drawerLabel}>📷 Attachments</div>
                  <span style={{ fontSize: '11px', background: '#FEF2F2', color: '#C1121F', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    {selectedTicketAttachments.length}
                  </span>
                </div>
                {loadingAttachments ? (
                  <div style={{ fontSize: '13px', color: '#6B7280' }}>Loading images...</div>
                ) : (
                  <div style={styles.attachmentGrid}>
                    {selectedTicketAttachments.map((attachment: any) => (
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
                )}
              </div>
            )}

            {/* KEY ACTIONS - clear, prominent */}
            <div style={styles.drawerActionsZone}>
              <button 
                onClick={saveSelectedTicket} 
                style={styles.primaryActionButton}
                disabled={savingTicket}
              >
                {savingTicket ? 'Saving...' : '💾 Save Changes'}
              </button>

              {draftStatus !== 'CLOSED' && (
                <button
                  onClick={() => closeTicket(selectedTicket.id)}
                  style={styles.dangerActionButton}
                >
                  ✓ Close Ticket
                </button>
              )}
            </div>

            {/* QUICK ACTIONS */}
            <div style={styles.drawerQuickActions}>
              <button
                onClick={() => copyText(selectedTicket.reporter_phone, 'Phone copied')}
                style={styles.secondaryButtonSmall}
              >
                Copy Phone
              </button>

              {selectedTicket.project_code && (
                <button
                  onClick={() => copyText(selectedTicket.project_code!, 'Project code copied')}
                  style={styles.secondaryButtonSmall}
                >
                  Copy Project
                </button>
              )}
            </div>

            {/* METADATA & CONTROLS - lighter section */}
            <div style={styles.metadataSection}>
              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Phone</div>
                <div style={styles.drawerValue}>{selectedTicket.reporter_phone}</div>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Status</div>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  style={{
                    ...styles.select,
                    ...(isMobile ? styles.mobileTouchSelect : {}),
                  }}
                >
                  {editableStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Worker</div>
                <select
                  value={draftWorkerId}
                  onChange={(e) => setDraftWorkerId(e.target.value)}
                  style={{
                    ...styles.select,
                    ...(isMobile ? styles.mobileTouchSelect : {}),
                  }}
                >
                  <option value="">Assign Worker</option>
                  {Object.entries(workersMap).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Created</div>
                <div style={styles.drawerValue}>
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </div>
              </div>

              <div style={{...styles.drawerSection, borderBottom: 'none'}}>
                <div style={styles.drawerLabel}>Closed</div>
                <div style={styles.drawerValue}>
                  {selectedTicket.closed_at
                    ? new Date(selectedTicket.closed_at).toLocaleString()
                    : '-'}
                </div>
              </div>
            </div>

            <div style={styles.historySection}>
              <div style={styles.historyTitle}>History</div>

              {drawerLoading && <p style={styles.infoText}>Loading history...</p>}

              {!drawerLoading && ticketLogs.length === 0 && (
                <p style={styles.infoText}>No history found.</p>
              )}

              {!drawerLoading &&
                ticketLogs.map((log) => (
                  <div key={log.id} style={styles.logCard}>
                    <div style={styles.logTopRow}>
                      <div style={styles.logAction}>
                        {formatLogTitle(log.action_type)}
                      </div>

                      <div style={styles.logTime}>
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>

                    {log.new_value && (
                      <div style={styles.logContent}>{log.new_value}</div>
                    )}

                    {(log.performed_by || log.notes) && (
                      <div style={styles.logMeta}>
                        {log.performed_by ? `By: ${log.performed_by}` : ''}
                        {log.performed_by && log.notes ? ' • ' : ''}
                        {log.notes || ''}
                      </div>
                    )}
                  </div>
                ))}
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden',
    background: '#F4F4F5',
    color: '#2F2F33',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
  },
  appShell: {
    display: 'grid',
    width: '100%',
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
  sidebarNavItem: {
    textAlign: 'left',
    background: '#FFFFFF',
    color: '#374151',
    border: '1px solid transparent',
    padding: '12px 14px',
    borderRadius: '12px',
    fontWeight: 700,
    cursor: 'pointer',
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
  sidebarFooter: {
    marginTop: 'auto',
    fontSize: '13px',
    color: '#6B7280',
    padding: '12px 14px',
  },
  mainArea: {
    padding: '24px',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  mainAreaMobile: {
    padding: '16px',
  },
  brandWrap: {
    minWidth: 0,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    rowGap: '16px',
  },
  topActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  logoBox: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #C1121F 0%, #8F0B16 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '18px',
    color: '#FFFFFF',
    boxShadow: '0 8px 20px rgba(193, 18, 31, 0.25)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 800,
    color: '#111827',
  },
  titleMobile: {
    fontSize: '28px',
    lineHeight: 1.1,
  },
  subtitle: {
    margin: '6px 0 0 0',
    color: '#6B7280',
    fontSize: '14px',
  },
  subtitleMobile: {
    fontSize: '13px',
  },
  copyToast: {
    position: 'fixed',
    top: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#111827',
    color: '#FFFFFF',
    padding: '10px 14px',
    borderRadius: '999px',
    zIndex: 100,
    fontSize: '13px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
  },
  hamburgerButton: {
    width: '44px',
    height: '44px',
    fontSize: '20px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    color: '#2F2F33',
    cursor: 'pointer',
    flexShrink: 0,
  },
  secondaryButton: {
    padding: '12px 16px',
    fontSize: '13px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    color: '#2F2F33',
    cursor: 'pointer',
    fontWeight: 700,
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  secondaryButtonSmall: {
    padding: '10px 14px',
    fontSize: '12px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    color: '#2F2F33',
    cursor: 'pointer',
    fontWeight: 700,
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
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
  mobileMenuCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
  },
  mobileMenuTitle: {
    fontSize: '12px',
    color: '#6B6B72',
    marginBottom: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  mobileMenuList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mobileMenuItem: {
    width: '100%',
    textAlign: 'left',
    background: '#F7F7F8',
    color: '#2F2F33',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '12px',
    padding: '12px 14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  mobileMenuItemActive: {
    background: '#C1121F',
    color: '#FFFFFF',
    border: '1px solid #C1121F',
  },
  mobileMenuLink: {
    textDecoration: 'none',
    background: '#F7F7F8',
    color: '#2F2F33',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '12px',
    padding: '12px 14px',
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gap: '14px',
    marginBottom: '18px',
    width: '100%',
    minWidth: 0,
  },
  kpiCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.04)',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    textAlign: 'left',
    cursor: 'pointer',
    minWidth: 0,
    transition: 'all 0.2s ease',
  },
  kpiCardMobile: {
    padding: '16px',
    borderRadius: '20px',
    minHeight: '118px',
  },
  kpiCardActive: {
    border: '1px solid #C1121F',
    boxShadow: '0 12px 28px rgba(193, 18, 31, 0.12)',
  },
  kpiLabel: {
    color: '#6B7280',
    fontSize: '13px',
    marginBottom: '12px',
    fontWeight: 600,
  },
  kpiValue: {
    fontSize: '42px',
    fontWeight: 800,
    lineHeight: 1,
    color: '#111827',
    wordBreak: 'break-word',
  },
  projectSection: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.04)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '18px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  projectSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  projectSectionTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '4px',
  },
  projectSectionSubtitle: {
    fontSize: '13px',
    color: '#6B7280',
  },
  projectScrollRow: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    width: '100%',
    minWidth: 0,
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch',
  },
  projectMiniCard: {
    minWidth: '180px',
    background: '#F9FAFB',
    border: '1px solid rgba(0,0,0,0.04)',
    borderRadius: '16px',
    padding: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  projectMiniCardMobile: {
    minWidth: '140px',
    padding: '10px',
  },
  projectMiniCardActive: {
    border: '1px solid #C1121F',
    background: '#FEF2F2',
  },
  projectMiniName: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '6px',
    lineHeight: 1.35,
  },
  projectMiniCode: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#C1121F',
  },
  qrSectionCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  },
  qrSectionHeader: {
    marginBottom: '18px',
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px',
  },
  qrProjectCard: {
    background: '#F9F9FA',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '16px',
    padding: '16px',
  },
  qrProjectCode: {
    color: '#C1121F',
    fontWeight: 800,
    fontSize: '13px',
    marginBottom: '6px',
  },
  qrProjectName: {
    color: '#2F2F33',
    fontWeight: 800,
    fontSize: '18px',
    marginBottom: '16px',
  },
  qrMetaBlock: {
    marginBottom: '12px',
  },
  qrMetaLabel: {
    color: '#6B6B72',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '6px',
  },
  qrMetaValue: {
    color: '#2F2F33',
    fontSize: '14px',
    wordBreak: 'break-word',
  },
  qrLinkText: {
    color: '#55555C',
    fontSize: '13px',
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
  qrActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '14px',
  },
  linkButton: {
    background: '#2F2F33',
    color: '#FFFFFF',
    borderRadius: '12px',
    padding: '10px 14px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '18px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 800,
    marginBottom: '4px',
    color: '#2F2F33',
  },
  cardSubtitle: {
    fontSize: '13px',
    color: '#6B6B72',
  },
  filtersRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
    width: '100%',
    minWidth: 0,
    flexWrap: 'wrap',
    rowGap: '12px',
  },
  searchInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    color: '#2F2F33',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
    minHeight: '44px',
  },
  filterSelect: {
    width: '180px',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    color: '#2F2F33',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '16px',
  },
  table: {
    minWidth: '1100px',
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '16px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    color: '#6B7280',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    background: '#FAFAFA',
    fontWeight: 700,
  },
  td: {
    padding: '16px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    color: '#2F2F33',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  clickableRow: {
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  projectCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  projectCode: {
    fontSize: '12px',
    color: '#C1121F',
    fontWeight: 800,
  },
  projectNameMain: {
    fontSize: '14px',
    color: '#2F2F33',
    fontWeight: 700,
  },
  descriptionCell: {
    maxWidth: '340px',
    lineHeight: 1.45,
    color: '#2F2F33',
    wordBreak: 'break-word',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  select: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FFFFFF',
    color: '#2F2F33',
    border: '1px solid rgba(0,0,0,0.08)',
    outline: 'none',
    minWidth: '150px',
    boxSizing: 'border-box',
    minHeight: '44px',
  },
  mobileTouchSelect: {
    minHeight: '44px',
  },
  closeButton: {
    background: '#C1121F',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    minHeight: '44px',
    boxShadow: '0 6px 18px rgba(193, 18, 31, 0.18)',
    transition: 'all 0.2s ease',
  },
  closedText: {
    color: '#166534',
    fontWeight: 700,
    fontSize: '13px',
  },
  mobileCard: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '20px',
    padding: '16px',
    marginBottom: '12px',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    transition: 'all 0.2s ease',
  },
  mobileCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  mobileCardHeaderLeft: {
    minWidth: 0,
    flex: 1,
  },
  mobileCardTicketNumber: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#2F2F33',
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
    marginTop: '4px',
  },
  mobileProject: {
    marginTop: '6px',
    color: '#6B7280',
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  mobileProjectCode: {
    marginTop: '4px',
    color: '#C1121F',
    fontSize: '12px',
    fontWeight: 800,
  },
  mobileDescription: {
    marginTop: '10px',
    color: '#2F2F33',
    lineHeight: 1.5,
    fontWeight: '500',
  },
  mobileMetaGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '12px',
  },
  mobileMeta: {
    fontSize: '13px',
    color: '#6B7280',
  },
  mobileField: {
    marginTop: '14px',
  },
  mobileFieldLabel: {
    marginBottom: '6px',
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 700,
  },
  mobileActions: {
    marginTop: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
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
    width: '440px',
    maxWidth: '100%',
    height: '100vh',
    background: '#FFFFFF',
    borderLeft: '1px solid rgba(0,0,0,0.08)',
    zIndex: 60,
    padding: '20px',
    overflowY: 'auto',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.08)',
    boxSizing: 'border-box',
  },
  drawerMobile: {
    borderRadius: '0',
    padding: '16px',
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
  drawerTextarea: {
    width: '100%',
    minHeight: '120px',
    resize: 'vertical',
    background: '#FFFFFF',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(0,0,0,0.08)',
    color: '#2F2F33',
    lineHeight: 1.6,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    boxSizing: 'border-box',
  },
  descriptionTextarea: {
    minHeight: '140px !important',
    fontSize: '15px !important',
    fontWeight: '500 !important',
    lineHeight: '1.7 !important',
  },
  descriptionSection: {
    marginBottom: '20px !important',
    paddingBottom: '20px !important',
    borderBottom: '2px solid rgba(193, 18, 31, 0.15) !important',
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
  drawerQuickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  drawerActions: {
    marginTop: '10px',
    marginBottom: '20px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  historySection: {
    marginTop: '24px',
  },
  historyTitle: {
    fontSize: '18px',
    fontWeight: 800,
    marginBottom: '12px',
    color: '#2F2F33',
  },
  logCard: {
    background: '#F9F9FA',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '10px',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  logTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '8px',
  },
  logAction: {
    color: '#2F2F33',
    fontWeight: 800,
    fontSize: '14px',
  },
  logTime: {
    color: '#6B6B72',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  logContent: {
    color: '#2F2F33',
    fontSize: '14px',
    lineHeight: 1.5,
    marginBottom: '8px',
    wordBreak: 'break-word',
  },
  logMeta: {
    color: '#6B6B72',
    fontSize: '12px',
    lineHeight: 1.4,
  },
  infoText: {
    color: '#6B6B72',
    margin: 0,
  },
  errorText: {
    color: '#B91C1C',
    margin: 0,
    fontWeight: 600,
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

