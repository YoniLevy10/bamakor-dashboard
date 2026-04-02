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
  projects?: {
    name?: string | null
    project_code?: string | null
  }[] | {
    name?: string | null
    project_code?: string | null
  } | null
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
  const [isMobile, setIsMobile] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
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
        const project = Array.isArray(ticket.projects)
          ? ticket.projects[0]
          : ticket.projects

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
      const nextStatus = 'ASSIGNED'

      const { error } = await supabase
        .from('tickets')
        .update({
          assigned_worker_id: workerId,
          status: nextStatus,
        })
        .eq('id', ticketId)

      if (error) throw error

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

      return matchesSearch && matchesStatus && matchesPriority && matchesProject
    })
  }, [tickets, searchTerm, statusFilter, priorityFilter, projectFilter])

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

       <nav style={styles.nav}>
  <Link href="/" style={styles.navItem}>
    Dashboard
  </Link>

  <Link href="/tickets" style={{ ...styles.navItem, ...styles.navItemActive }}>
    Tickets
  </Link>

  <Link href="/workers" style={styles.navItem}>
    Workers
  </Link>

  <Link href="/projects" style={styles.navItem}>
    Projects
  </Link>

  <Link href="/qr" style={styles.navItem}>
    QR Codes
  </Link>
</nav>


            <div style={styles.sidebarFooter}>
              Maintenance Management System
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
                    <tr key={ticket.id}>
                      <td style={styles.tdStrong}>TKT-{ticket.ticket_number}</td>

                      <td style={styles.td}>
                        <div style={styles.ticketTitle}>{ticket.description || 'No description'}</div>
                        <div style={styles.ticketSubtitle}>
                          {(ticket.reporter_name || ticket.reporter_phone || 'No reporter info')}
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
                <div key={ticket.id} style={styles.mobileCard}>
                  <div style={styles.mobileCardTop}>
                    <div>
                      <div style={styles.mobileTicketNumber}>TKT-{ticket.ticket_number}</div>
                      <div style={styles.mobileProject}>
                        {ticket.project_code || '-'} · {ticket.project_name || 'No project'}
                      </div>
                    </div>

                    <span style={{ ...styles.badge, ...getStatusStyle(ticket.status) }}>
                      {ticket.status}
                    </span>
                  </div>

                  <div style={styles.mobileDescription}>
                    {ticket.description || 'No description'}
                  </div>

                  <div style={styles.mobileMeta}>
                    <span style={{ ...styles.badge, ...getPriorityStyle(ticket.priority) }}>
                      {(ticket.priority || 'LOW').toUpperCase()}
                    </span>
                    <span style={styles.mobileMetaText}>
                      {ticket.created_at ? formatDate(ticket.created_at) : '-'}
                    </span>
                  </div>

                  <div style={styles.mobileField}>
                    <div style={styles.mobileFieldLabel}>Assigned Worker</div>
                    <select
                      value={ticket.assigned_worker_id || ''}
                      onChange={(e) => assignWorker(ticket.id, e.target.value)}
                      style={styles.mobileSelect}
                      disabled={actionLoadingId === ticket.id || ticket.status === 'CLOSED'}
                    >
                      <option value="">Unassigned</option>
                      {workers.map((worker) => (
                        <option key={worker.id} value={worker.id}>
                          {worker.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.mobileActions}>
                    <div style={styles.mobileAssignedText}>
                      {getWorkerName(ticket.assigned_worker_id)}
                    </div>

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
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
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
    borderRight: '1px solid #E5E7EB',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
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
  nav: {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
},

navItem: {
  textDecoration: 'none',
  color: '#111827',
  fontWeight: 700,
  fontSize: '18px',
  padding: '16px 18px',
  borderRadius: '20px',
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
},

navItemActive: {
  background: '#111827',
  color: '#FFFFFF',
  boxShadow: '0 12px 24px rgba(17, 24, 39, 0.16)',
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
    padding: '28px',
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
    fontSize: '36px',
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
    gap: '10px',
  },
  mobileLink: {
    textDecoration: 'none',
    color: '#111827',
    fontWeight: 700,
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  statCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '22px',
    boxShadow: '0 8px 24px rgba(17, 24, 39, 0.04)',
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
    border: '1px solid #E5E7EB',
    borderRadius: '20px',
    padding: '22px',
    marginBottom: '18px',
    boxShadow: '0 8px 24px rgba(17, 24, 39, 0.04)',
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
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    fontSize: '14px',
    outline: 'none',
    color: '#111827',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    fontSize: '14px',
    outline: 'none',
    color: '#111827',
  },
  resultCount: {
    fontSize: '15px',
    color: '#374151',
    marginBottom: '12px',
    fontWeight: 600,
  },
  tableCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(17, 24, 39, 0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '18px 16px',
    background: '#F9FAFB',
    color: '#4B5563',
    fontSize: '13px',
    fontWeight: 700,
    borderBottom: '1px solid #E5E7EB',
  },
  td: {
    padding: '18px 16px',
    borderBottom: '1px solid #F3F4F6',
    fontSize: '14px',
    color: '#111827',
    verticalAlign: 'top',
  },
  tdStrong: {
    padding: '18px 16px',
    borderBottom: '1px solid #F3F4F6',
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
    border: '1px solid #E5E7EB',
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
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
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
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  },
  doneText: {
    color: '#16A34A',
    fontWeight: 700,
    fontSize: '13px',
  },
  emptyState: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '28px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(17, 24, 39, 0.04)',
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
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '16px',
    boxShadow: '0 8px 24px rgba(17, 24, 39, 0.04)',
  },
  mobileCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'flex-start',
  },
  mobileTicketNumber: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '4px',
  },
  mobileProject: {
    fontSize: '13px',
    color: '#6B7280',
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
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
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
  mobileAssignedText: {
    fontSize: '13px',
    color: '#374151',
    fontWeight: 600,
  },
}
