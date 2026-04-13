'use client'

import Link from 'next/link'
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
  theme 
} from './components/ui'

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

const statusOptions = ['ALL', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const
const editableStatusOptions = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const

const WHATSAPP_NUMBER = '972559740732'

export default function HomePage() {
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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showQrSection, setShowQrSection] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [activeKpi, setActiveKpi] = useState<'ALL' | 'NEW' | 'ASSIGNED' | 'CLOSED'>('ALL')
  const [selectedProjectCode, setSelectedProjectCode] = useState<string>('ALL')

  const [draftDescription, setDraftDescription] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftStatus, setDraftStatus] = useState('NEW')
  const [draftPriority, setDraftPriority] = useState('LOW')
  const [draftWorkerId, setDraftWorkerId] = useState('')
  const [selectedTicketAttachments, setSelectedTicketAttachments] = useState<AttachmentRow[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  // Add Ticket Modal States
  const [showAddTicketModal, setShowAddTicketModal] = useState(false)
  const [addTicketForm, setAddTicketForm] = useState({
    project_code: '',
    description: '',
    reporter_name: '',
    reporter_phone: '',
  })
  const [addingTicket, setAddingTicket] = useState(false)
  const [addTicketError, setAddTicketError] = useState('')

  const activeSource = useMemo(() => {
    return 'all'
  }, [])

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

    const handleFocus = async () => {
      await Promise.all([loadTickets(activeSource), loadAllTickets()])
      if (selectedTicket) {
        await loadTicketLogs(selectedTicket.id)
      }
    }

    const backgroundRefreshInterval = setInterval(async () => {
      await Promise.all([loadTickets(activeSource), loadAllTickets()])
      if (selectedTicket) {
        await loadTicketLogs(selectedTicket.id)
      }
    }, 10 * 60 * 1000)

    window.addEventListener('focus', handleFocus)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('focus', handleFocus)
      clearInterval(backgroundRefreshInterval)
    }
  }, [activeSource, selectedTicket])

  async function loadWorkers() {
    await asyncHandler(
      async () => {
        const { data, error } = await supabase
          .from('workers')
          .select('id, full_name')
          .order('full_name', { ascending: true })

        if (error) throw error

        if (data) {
          const map: Record<string, string> = {}
          data.forEach((worker) => {
            map[worker.id] = worker.full_name
          })
          setWorkersMap(map)
        }
        return true
      },
      { context: 'Failed to load workers', showErrorToast: false }
    )
  }

  async function loadProjects() {
    await asyncHandler(
      async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, project_code')
          .order('project_code', { ascending: true })

        if (error) throw error

        if (data) {
          setProjects(data as ProjectRow[])
        }
        return true
      },
      { context: 'Failed to load projects', showErrorToast: false }
    )
  }

  async function loadAllTickets() {
    await asyncHandler(
      async () => {
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
          data?.map((row: TicketWithProjects) => ({
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
        return true
      },
      { context: 'Failed to load tickets', showErrorToast: false }
    )
  }

  async function loadTickets(source: string) {
    setLoading(true)
    setError('')

    await asyncHandler(
      async () => {
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
            data?.map((row: TicketWithProjects) => ({
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
        return true
      },
      {
        context: 'Failed to load tickets',
        showErrorToast: false,
        onError: (err) => setError(err),
      }
    )

    setLoading(false)
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
      await asyncHandler(
        async () => {
          await supabase.from('tickets').update({ assigned_worker_id: null }).eq('id', ticketId)
          await refreshData()
          return true
        },
        { context: 'Failed to unassign worker', showErrorToast: true }
      )
      return
    }

    await asyncHandler(
      async () => {
        const response = await fetch('/api/assign-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: ticketId, worker_id: workerId }),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Failed to assign worker')
        }

        toast.success('Worker assigned')
        await refreshData()
        return true
      },
      { context: 'Failed to assign worker', showErrorToast: true }
    )
  }

  async function updateTicketStatus(ticketId: string, nextStatus: string) {
    await asyncHandler(
      async () => {
        const payload: Record<string, string | null> = { status: nextStatus }
        if (nextStatus === 'CLOSED') payload.closed_at = new Date().toISOString()
        if (nextStatus !== 'CLOSED') payload.closed_at = null

        const { error } = await supabase
          .from('tickets')
          .update(payload)
          .eq('id', ticketId)

        if (error) throw error

        toast.success(`Ticket marked as ${nextStatus}`)
        await refreshData()
        return true
      },
      { context: 'Failed to update status', showErrorToast: true }
    )
  }

  async function saveSelectedTicket() {
    if (!selectedTicket) return
    setSavingTicket(true)

    await asyncHandler(
      async () => {
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

        const { error } = await supabase
          .from('tickets')
          .update(payload)
          .eq('id', selectedTicket.id)

        if (error) throw error

        toast.success('Ticket saved')
        await refreshData()
        return true
      },
      { context: 'Failed to save ticket', showErrorToast: true }
    )

    setSavingTicket(false)
  }

  async function closeTicket(ticketId: string) {
    setActionLoadingId(ticketId)
    await asyncHandler(
      async () => {
        const response = await fetch('/api/close-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket_id: ticketId }),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Failed to close ticket')
        }

        toast.success('Ticket closed')
        await refreshData()
        return true
      },
      { context: 'Failed to close ticket', showErrorToast: true }
    )
    setActionLoadingId(null)
  }

  function openTicket(ticket: TicketRow) {
    setSelectedTicket(ticket)
    setDraftDescription(ticket.description || '')
    setDraftPhone(ticket.reporter_phone || '')
    setDraftWorkerId(ticket.assigned_worker_id || '')
    setDraftStatus(ticket.status)
    setSelectedTicketAttachments([])
    loadTicketAttachments(ticket.id)
    loadTicketLogs(ticket.id)
  }

  function closeDrawer() {
    setSelectedTicket(null)
    setDraftDescription('')
    setDraftPhone('')
    setDraftWorkerId('')
    setDraftPriority('LOW')
    setDraftStatus('NEW')
    setSelectedTicketAttachments([])
    setSelectedImageUrl(null)
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
        .select('id, ticket_id, file_name, file_url, mime_type, created_at')
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

  function getImageUrl(attachment: AttachmentRow): string {
    if (attachment.signed_url) {
      return attachment.signed_url
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jsliqlmjksintyigkulq.supabase.co'
    return `${supabaseUrl}/storage/v1/object/public/ticket-attachments/${attachment.file_url}`
  }

  async function copyText(value: string, label = 'Copied') {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(label)
    } catch {
      toast.error('Copy failed')
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
          .map((header) => `"${String((row as Record<string, unknown>)[header] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `bamakor-all-tickets.csv`)
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

      await refreshData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket'
      setAddTicketError(message)
      toast.error(message)
    } finally {
      setAddingTicket(false)
    }
  }

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="Dashboard"
          subtitle="Welcome back"
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="Dashboard"
            subtitle="Welcome back. Here&apos;s what&apos;s happening today."
            actions={
              <>
                <Button variant="primary" onClick={() => setShowAddTicketModal(true)}>
                  + New Ticket
                </Button>
                <Button variant="secondary" onClick={() => setShowQrSection((prev) => !prev)}>
                  QR Management
                </Button>
                <Button variant="secondary" onClick={exportCurrentViewToCsv}>
                  Export CSV
                </Button>
              </>
            }
          />
        )}

        {/* KPI Cards */}
        <div style={{
          ...styles.kpiGrid,
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        }}>
          <KpiCard
            label="Total Tickets"
            value={stats.total}
            active={activeKpi === 'ALL'}
            onClick={() => setActiveKpi('ALL')}
          />
          <KpiCard
            label="Open"
            value={stats.open}
            active={activeKpi === 'NEW'}
            onClick={() => setActiveKpi('NEW')}
          />
          <KpiCard
            label="Assigned"
            value={stats.assigned}
            active={activeKpi === 'ASSIGNED'}
            onClick={() => setActiveKpi('ASSIGNED')}
          />
          <KpiCard
            label="Closed"
            value={stats.closed}
            active={activeKpi === 'CLOSED'}
            onClick={() => setActiveKpi('CLOSED')}
          />
        </div>

        {/* Projects Section */}
        <Card
          title="Projects"
          subtitle="Filter tickets by project"
          actions={
            <Button variant="ghost" size="sm" onClick={() => setSelectedProjectCode('ALL')}>
              Show All
            </Button>
          }
          style={{ marginBottom: '20px' }}
        >
          <div style={styles.projectScroll}>
            {projectCounts.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectCode(project.project_code)}
                style={{
                  ...styles.projectChip,
                  ...(selectedProjectCode === project.project_code ? styles.projectChipActive : {}),
                }}
              >
                <div style={styles.projectChipName}>{project.name}</div>
                <div style={styles.projectChipCode}>{project.project_code}</div>
                <div style={styles.projectChipCount}>
                  {project.open > 0 && (
                    <span style={styles.projectChipOpenCount}>{project.open}</span>
                  )}
                  {project.total}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* QR Management Section */}
        {showQrSection && (
          <Card
            title="QR Management"
            subtitle="Copy project links and generate QR codes"
            style={{ marginBottom: '20px' }}
          >
            <div style={styles.qrGrid}>
              {projects.map((project) => {
                const startCode = `START_${project.project_code}`
                const whatsappLink = buildWhatsappLink(project.project_code)

                return (
                  <div key={project.id} style={styles.qrCard}>
                    <div style={styles.qrCardHeader}>
                      <span style={styles.qrCardCode}>{project.project_code}</span>
                      <span style={styles.qrCardName}>{project.name}</span>
                    </div>
                    <div style={styles.qrCardMeta}>
                      <div style={styles.qrMetaLabel}>Start Code</div>
                      <div style={styles.qrMetaValue}>{startCode}</div>
                    </div>
                    <div style={styles.qrCardActions}>
                      <Button variant="secondary" size="sm" onClick={() => copyText(startCode, 'Code copied')}>
                        Copy Code
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => copyText(whatsappLink, 'Link copied')}>
                        Copy Link
                      </Button>
                      <a href={whatsappLink} target="_blank" rel="noreferrer" style={styles.qrOpenLink}>
                        Open
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Tickets List */}
        <Card
          title="All Tickets"
          subtitle="Live operational view connected to Supabase"
          noPadding
        >
          <div style={styles.filtersRow}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search tickets..."
              style={{ maxWidth: isMobile ? '100%' : '320px' }}
            />
            <FilterTabs
              options={statusOptions.map(s => ({ value: s, label: s === 'ALL' ? 'All' : s.replace('_', ' ') }))}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          {loading && (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner} />
              <span>Loading tickets...</span>
            </div>
          )}

          {error && (
            <div style={styles.errorState}>
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={() => loadTickets(activeSource)}>
                Retry
              </Button>
            </div>
          )}

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
                  <div style={styles.ticketRowMain}>
                    <div style={styles.ticketNumber}>#{ticket.ticket_number}</div>
                    <div style={styles.ticketProject}>{ticket.project_code || 'N/A'}</div>
                    <StatusBadge status={ticket.status} size="sm" />
                  </div>
                  <div style={styles.ticketDescription}>{ticket.description || '-'}</div>
                  <div style={styles.ticketMeta}>
                    <span>{ticket.reporter_phone}</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                    <span>{workersMap[ticket.assigned_worker_id || ''] || 'Unassigned'}</span>
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
                {editableStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Assigned Worker</div>
              <select
                value={draftWorkerId}
                onChange={(e) => setDraftWorkerId(e.target.value)}
                style={styles.drawerSelect}
              >
                <option value="">Unassigned</option>
                {Object.entries(workersMap).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Description</div>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                style={styles.drawerTextarea}
                rows={4}
              />
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Reporter Phone</div>
              <div style={styles.drawerValue}>{selectedTicket.reporter_phone}</div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Created</div>
              <div style={styles.drawerValue}>
                {new Date(selectedTicket.created_at).toLocaleString()}
              </div>
            </div>

            {/* Attachments */}
            {selectedTicketAttachments.length > 0 && (
              <div style={styles.drawerSection}>
                <div style={styles.drawerLabel}>Attachments</div>
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
                onClick={saveSelectedTicket}
                loading={savingTicket}
                style={{ width: '100%' }}
              >
                Save Changes
              </Button>
              {selectedTicket.status !== 'CLOSED' && (
                <Button
                  variant="danger"
                  onClick={() => closeTicket(selectedTicket.id)}
                  style={{ width: '100%' }}
                >
                  Close Ticket
                </Button>
              )}
            </div>

            {/* History */}
            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>History</div>
              {drawerLoading ? (
                <div style={styles.loadingState}>Loading...</div>
              ) : ticketLogs.length === 0 ? (
                <div style={styles.emptyLogs}>No history available</div>
              ) : (
                <div style={styles.logsList}>
                  {ticketLogs.map((log) => (
                    <div key={log.id} style={styles.logItem}>
                      <div style={styles.logHeader}>
                        <span style={styles.logAction}>{formatLogTitle(log.action_type)}</span>
                        <span style={styles.logTime}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.notes && <div style={styles.logNotes}>{log.notes}</div>}
                    </div>
                  ))}
                </div>
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
                  onChange={(e) => setAddTicketForm({ ...addTicketForm, reporter_phone: e.target.value })}
                  placeholder="Enter phone number"
                  style={styles.formInput}
                />
              </div>

              {addTicketError && (
                <div style={styles.formError}>{addTicketError}</div>
              )}

              <div style={styles.modalActions}>
                <Button
                  variant="secondary"
                  onClick={() => setShowAddTicketModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={addingTicket}
                  onClick={() => handleCreateTicket({ preventDefault: () => {} } as React.FormEvent)}
                >
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

      {/* Mobile Actions */}
      {isMobile && (
        <div style={styles.mobileBottomActions}>
          <Button
            variant="primary"
            onClick={() => setShowAddTicketModal(true)}
            style={{ flex: 1 }}
          >
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
  projectScroll: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    WebkitOverflowScrolling: 'touch',
  },
  projectChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '14px 18px',
    borderRadius: theme.radius.lg,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    minWidth: '160px',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  projectChipActive: {
    borderColor: theme.colors.primary,
    background: theme.colors.primaryMuted,
  },
  projectChipName: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    whiteSpace: 'nowrap',
  },
  projectChipCode: {
    fontSize: '12px',
    color: theme.colors.primary,
    fontWeight: 500,
  },
  projectChipCount: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  projectChipOpenCount: {
    color: theme.colors.warning,
    fontWeight: 600,
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  qrCard: {
    padding: '16px',
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
  },
  qrCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  qrCardCode: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.primary,
  },
  qrCardName: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
  },
  qrCardMeta: {
    marginBottom: '12px',
  },
  qrMetaLabel: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  qrMetaValue: {
    fontSize: '13px',
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  qrCardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  qrOpenLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: theme.radius.md,
    background: theme.colors.primary,
    color: theme.colors.textInverse,
    fontSize: '13px',
    fontWeight: 500,
    textDecoration: 'none',
  },
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
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
    borderLeftColor: theme.colors.primary,
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
  },
  ticketRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
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
  drawerTextarea: {
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
  emptyLogs: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    padding: '16px 0',
  },
  logsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  logItem: {
    padding: '12px',
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  logAction: {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  logTime: {
    fontSize: '11px',
    color: theme.colors.textMuted,
  },
  logNotes: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
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
