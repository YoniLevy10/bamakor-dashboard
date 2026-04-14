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
  Button, 
  theme 
} from './components/ui'
import { DashboardStats } from './components/dashboard/DashboardStats'
import { ProjectFilterSection } from './components/dashboard/ProjectFilterSection'
import { QrManagementSection } from './components/dashboard/QrManagementSection'
import { TicketsList } from './components/tickets/TicketsList'
import { TicketDetailDrawer } from './components/tickets/TicketDetailDrawer'
import { AddTicketModal } from './components/tickets/AddTicketModal'
import { ImageLightbox } from './components/shared/ImageLightbox'

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
        const workerChanged = (selectedTicket.assigned_worker_id || '') !== (draftWorkerId || '')

        // If worker assignment changed, use API route to ensure SMS is sent exactly once.
        if (workerChanged && draftWorkerId) {
          const response = await fetch('/api/assign-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_id: selectedTicket.id, worker_id: draftWorkerId }),
          })

          if (!response.ok) {
            const result = await response.json().catch(() => ({}))
            throw new Error((result as { error?: string }).error || 'Failed to assign worker')
          }
        }

        const payload: Record<string, string | null> = {
          description: draftDescription,
          status: draftStatus,
          // If assignment changed and a worker was selected, assignment was handled via /api/assign-ticket.
          // Keep direct DB updates for unassign (draftWorkerId empty).
          assigned_worker_id: workerChanged && draftWorkerId ? selectedTicket.assigned_worker_id : (draftWorkerId || null),
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
      const q = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !q ||
        String(ticket.ticket_number).toLowerCase().includes(q) ||
        ticket.reporter_phone.toLowerCase().includes(q) ||
        ticket.description.toLowerCase().includes(q) ||
        (ticket.project_name || '').toLowerCase().includes(q) ||
        (ticket.project_code || '').toLowerCase().includes(q)

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
          subtitle="Hello Sarah"
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

        {/* Dashboard Stats */}
        <DashboardStats
          stats={stats}
          activeKpi={activeKpi}
          onKpiChange={setActiveKpi}
          isMobile={isMobile}
        />

        {/* Projects Filter */}
        <ProjectFilterSection
          projectCounts={projectCounts}
          selectedProjectCode={selectedProjectCode}
          onProjectSelect={setSelectedProjectCode}
        />

        {/* QR Management Section */}
        {showQrSection && (
          <QrManagementSection
            projects={projects}
            onCopyText={copyText}
          />
        )}

        {/* Tickets List */}
        <TicketsList
          tickets={tickets}
          filteredTickets={filteredTickets}
          loading={loading}
          error={error}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          onSearchChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onTicketClick={openTicket}
          onCreateClick={() => setShowAddTicketModal(true)}
          onRetry={() => loadTickets(activeSource)}
          selectedTicketId={selectedTicket?.id}
          workersMap={workersMap}
          isMobile={isMobile}
        />
      </div>

      {/* Ticket Detail Drawer */}
      <TicketDetailDrawer
        selectedTicket={selectedTicket}
        isMobile={isMobile}
        draftDescription={draftDescription}
        draftWorkerId={draftWorkerId}
        draftStatus={draftStatus}
        selectedTicketAttachments={selectedTicketAttachments}
        ticketLogs={ticketLogs}
        drawerLoading={drawerLoading}
        savingTicket={savingTicket}
        workersMap={workersMap}
        onClose={closeDrawer}
        onDescriptionChange={setDraftDescription}
        onWorkerChange={setDraftWorkerId}
        onStatusChange={setDraftStatus}
        onSave={saveSelectedTicket}
        onSelectImage={setSelectedImageUrl}
        onCloseTicket={() => closeTicket(selectedTicket?.id || '')}
        getImageUrl={getImageUrl}
      />

      {/* Add Ticket Modal */}
      <AddTicketModal
        open={showAddTicketModal}
        onClose={() => setShowAddTicketModal(false)}
        projects={projects}
        projectCode={addTicketForm.project_code}
        description={addTicketForm.description}
        reporterName={addTicketForm.reporter_name}
        reporterPhone={addTicketForm.reporter_phone}
        error={addTicketError}
        loading={addingTicket}
        onProjectCodeChange={(value) =>
          setAddTicketForm({ ...addTicketForm, project_code: value })
        }
        onDescriptionChange={(value) =>
          setAddTicketForm({ ...addTicketForm, description: value })
        }
        onReporterNameChange={(value) =>
          setAddTicketForm({ ...addTicketForm, reporter_name: value })
        }
        onReporterPhoneChange={(value) =>
          setAddTicketForm({ ...addTicketForm, reporter_phone: value })
        }
        onSubmit={handleCreateTicket}
      />

      {/* Image Lightbox */}
      <ImageLightbox imageUrl={selectedImageUrl} onClose={() => setSelectedImageUrl(null)} />

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
  