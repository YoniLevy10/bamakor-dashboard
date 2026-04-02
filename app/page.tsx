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
        <div>
          <div style={styles.mobileCardTicketNumber}>#{ticket.ticket_number}</div>
          <div style={styles.mobileProject}>
            {ticket.project_name || '-'}
          </div>
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


      <div style={styles.mobileMeta}>📞 {ticket.reporter_phone}</div>
      <div style={styles.mobileMeta}>
        🕒 {new Date(ticket.created_at).toLocaleString()}
      </div>


      <div style={styles.mobileField} onClick={(e) => e.stopPropagation()}>
        <div style={styles.mobileFieldLabel}>Status</div>
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
      </div>


      <div style={styles.mobileField} onClick={(e) => e.stopPropagation()}>
        <div style={styles.mobileFieldLabel}>Worker</div>
        <select
          value={ticket.assigned_worker_id || ''}
          onChange={(e) => assignWorker(ticket.id, e.target.value)}
          style={styles.select}
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
      <div style={styles.appShell}>
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
              <button style={{ ...styles.sidebarNavItem, ...styles.sidebarNavItemActive }}>
                Dashboard
              </button>
              <a href="/tickets" style={styles.sidebarNavLink}>Tickets</a>
              <button style={styles.sidebarNavItemDisabled}>Workers</button>
              <a href="/qr" style={styles.sidebarNavLink}>QR Codes</a>
            </nav>


            <div style={styles.sidebarFooter}>Maintenance Management System</div>
          </aside>
        )}


        <div style={styles.mainArea}>
          <div style={styles.topBar}>
            <div style={styles.brandWrap}>
              <div style={styles.brandRow}>
                {isMobile && <div style={styles.logoBox}>B</div>}
                <div>
                  <h1 style={styles.title}>Dashboard</h1>
                  <p style={styles.subtitle}>Welcome back. Here's what's happening today.</p>
                </div>
              </div>
            </div>


            <div style={styles.topActions}>
              <button
                onClick={() => setShowQrSection((prev) => !prev)}
                style={styles.secondaryButton}
              >
                {showQrSection ? 'Hide QR' : 'QR Management'}
              </button>


              <button onClick={exportCurrentViewToCsv} style={styles.secondaryButton}>
                Export CSV
              </button>


              {isMobile && (
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  style={styles.hamburgerButton}
                >
                  ☰
                </button>
              )}
            </div>
          </div>


          {copyMessage && <div style={styles.copyToast}>{copyMessage}</div>}


          {menuOpen && isMobile && (
            <div style={styles.mobileMenuCard}>
              <div style={styles.mobileMenuTitle}>Navigation</div>
              <div style={styles.mobileMenuList}>
                <button style={{ ...styles.mobileMenuItem, ...styles.mobileMenuItemActive }}>
                  Dashboard
                </button>
                <a href="/tickets" style={styles.mobileMenuLink}>Tickets</a>
                <a href="/qr" style={styles.mobileMenuLink}>QR Codes</a>
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
                ...(activeKpi === 'ALL' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('ALL')}
            >
              <div style={styles.kpiLabel}>Total Tickets</div>
              <div style={styles.kpiValue}>{stats.total}</div>
            </button>


            <button
              style={{
                ...styles.kpiCard,
                ...(activeKpi === 'NEW' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('NEW')}
            >
              <div style={styles.kpiLabel}>Open</div>
              <div style={styles.kpiValue}>{stats.open}</div>
            </button>


            <button
              style={{
                ...styles.kpiCard,
                ...(activeKpi === 'ASSIGNED' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('ASSIGNED')}
            >
              <div style={styles.kpiLabel}>Assigned</div>
              <div style={styles.kpiValue}>{stats.assigned}</div>
            </button>


            <button
              style={{
                ...styles.kpiCard,
                ...(activeKpi === 'CLOSED' ? styles.kpiCardActive : {}),
              }}
              onClick={() => setActiveKpi('CLOSED')}
            >
              <div style={styles.kpiLabel}>Closed</div>
              <div style={styles.kpiValue}>{stats.closed}</div>
            </button>
          </div>


          <div style={styles.projectSection}>
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


            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Phone</div>
              <div style={styles.drawerValue}>{selectedTicket.reporter_phone}</div>
            </div>


            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Status</div>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                style={styles.select}
              >
                {editableStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>


            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Description</div>
              <textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                style={styles.drawerTextarea}
              />
            </div>


            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Worker</div>
              <select
                value={draftWorkerId}
                onChange={(e) => setDraftWorkerId(e.target.value)}
                style={styles.select}
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


            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Closed</div>
              <div style={styles.drawerValue}>
                {selectedTicket.closed_at
                  ? new Date(selectedTicket.closed_at).toLocaleString()
                  : '-'}
              </div>
            </div>


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


            <div style={styles.drawerActions}>
              <button onClick={saveSelectedTicket} style={styles.primarySaveButton}>
                {savingTicket ? 'Saving...' : 'Save Changes'}
              </button>


              {draftStatus !== 'CLOSED' && (
                <button
                  onClick={() => closeTicket(selectedTicket.id)}
                  style={styles.closeButton}
                >
                  Close Ticket
                </button>
              )}
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
        </>
      )}
    </main>
  )
}


const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F4F4F5',
    color: '#2F2F33',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
  },
  appShell: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    minHeight: '100vh',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
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
  sidebarNavItemDisabled: {
    textAlign: 'left',
    background: '#F9FAFB',
    color: '#9CA3AF',
    border: '1px solid #F3F4F6',
    padding: '12px 14px',
    borderRadius: '12px',
    fontWeight: 700,
    cursor: 'default',
  },
  sidebarFooter: {
    marginTop: 'auto',
    fontSize: '13px',
    color: '#6B7280',
    padding: '12px 14px',
  },
  mainArea: {
    padding: '24px',
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
  },
  topActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
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
    fontSize: '36px',
    fontWeight: 800,
    color: '#111827',
  },
  subtitle: {
    margin: '6px 0 0 0',
    color: '#6B7280',
    fontSize: '14px',
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
    width: '42px',
    height: '42px',
    fontSize: '20px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    color: '#2F2F33',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    color: '#2F2F33',
    cursor: 'pointer',
    fontWeight: 700,
  },
  secondaryButtonSmall: {
    padding: '8px 10px',
    fontSize: '12px',
    borderRadius: '10px',
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    color: '#2F2F33',
    cursor: 'pointer',
    fontWeight: 700,
  },
  primarySaveButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  mobileMenuCard: {
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    borderRadius: '16px',
    padding: '14px',
    marginBottom: '18px',
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
    border: '1px solid #D7D7DB',
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
    border: '1px solid #D7D7DB',
    borderRadius: '12px',
    padding: '12px 14px',
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gap: '14px',
    marginBottom: '18px',
  },
  kpiCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '22px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  kpiCardActive: {
    border: '1px solid #C1121F',
    boxShadow: '0 12px 28px rgba(193, 18, 31, 0.12)',
  },
  kpiLabel: {
    color: '#6B7280',
    fontSize: '14px',
    marginBottom: '12px',
    fontWeight: 600,
  },
  kpiValue: {
    fontSize: '42px',
    fontWeight: 800,
    lineHeight: 1,
    color: '#111827',
  },
  projectSection: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '20px',
    padding: '18px',
    marginBottom: '18px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
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
    paddingBottom: '4px',
  },
  projectMiniCard: {
    minWidth: '180px',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    padding: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    flexShrink: 0,
  },
  projectMiniCardActive: {
    border: '1px solid #C1121F',
    background: '#FEF2F2',
  },
  projectMiniName: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '8px',
  },
  projectMiniCode: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#C1121F',
  },
  qrSectionCard: {
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
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
    border: '1px solid #D7D7DB',
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
    borderRadius: '10px',
    padding: '8px 10px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
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
  },
  searchInput: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #D7D7DB',
    background: '#FFFFFF',
    color: '#2F2F33',
    outline: 'none',
    fontSize: '14px',
  },
  filterSelect: {
    width: '180px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #D7D7DB',
    background: '#FFFFFF',
    color: '#2F2F33',
    outline: 'none',
    fontSize: '14px',
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
    padding: '14px 12px',
    borderBottom: '1px solid #E5E7EB',
    color: '#6B6B72',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    background: '#FAFAFA',
  },
  td: {
    padding: '14px 12px',
    borderBottom: '1px solid #EFEFF1',
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
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#FFFFFF',
    color: '#2F2F33',
    border: '1px solid #D7D7DB',
    outline: 'none',
    minWidth: '150px',
  },
  closeButton: {
    background: '#C1121F',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 6px 18px rgba(193, 18, 31, 0.18)',
  },
  closedText: {
    color: '#166534',
    fontWeight: 700,
    fontSize: '13px',
  },
  mobileCard: {
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    borderRadius: '16px',
    padding: '14px',
    marginBottom: '12px',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  mobileCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '10px',
  },
  mobileCardTicketNumber: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#2F2F33',
  },
  mobileProject: {
    marginTop: '6px',
    color: '#2F2F33',
    fontSize: '13px',
    fontWeight: 700,
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
  },
  mobileMeta: {
    marginTop: '10px',
    fontSize: '13px',
    color: '#55555C',
  },
  mobileField: {
    marginTop: '12px',
  },
  mobileFieldLabel: {
    marginBottom: '6px',
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 700,
  },
  mobileActions: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  drawerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(47,47,51,0.35)',
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
    borderLeft: '1px solid #D7D7DB',
    zIndex: 60,
    padding: '18px',
    overflowY: 'auto',
    boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
  },
  drawerHeader: {
    position: 'sticky',
    top: 0,
    background: '#FFFFFF',
    paddingBottom: '12px',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '18px',
    borderBottom: '1px solid #EFEFF1',
  },
  drawerTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#2F2F33',
    marginBottom: '6px',
  },
  drawerSubtitle: {
    color: '#6B6B72',
    fontSize: '14px',
  },
  drawerCloseButton: {
    background: '#F9F9FA',
    color: '#2F2F33',
    border: '1px solid #D7D7DB',
    borderRadius: '10px',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    fontSize: '16px',
    flexShrink: 0,
  },
  drawerSection: {
    marginBottom: '16px',
  },
  drawerLabel: {
    color: '#6B6B72',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
    fontWeight: 700,
  },
  drawerValue: {
    color: '#2F2F33',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  drawerTextarea: {
    width: '100%',
    minHeight: '120px',
    resize: 'vertical',
    background: '#F9F9FA',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    color: '#2F2F33',
    lineHeight: 1.6,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
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
    border: '1px solid #E5E7EB',
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
}

