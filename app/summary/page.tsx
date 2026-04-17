'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '../components/ui'

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

type RawTicketRow = {
  id: string
  ticket_number: number
  project_id?: string
  projects?: { project_code?: string; name?: string } | { project_code?: string; name?: string }[]
  reporter_phone: string
  description: string
  status: string
  assigned_worker_id: string | null
  created_at: string
  closed_at: string | null
}

type ProjectRow = {
  id: string
  name: string
  project_code: string
}

type WorkerRow = {
  id: string
  full_name: string
  phone: string
  is_active: boolean
}

export default function SummaryPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

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
    setError('')

    try {
      const [{ data: ticketsData, error: ticketsError }, { data: projectsData, error: projectsError }, { data: workersData, error: workersError }] =
        await Promise.all([
          supabase
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
              priority,
              projects (
                project_code,
                name
              )
            `)
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, name, project_code')
            .order('project_code', { ascending: true }),
          supabase
            .from('workers')
            .select('id, full_name, phone, is_active')
            .eq('is_active', true),
        ])

      if (ticketsError) throw ticketsError
      if (projectsError) throw projectsError
      if (workersError) throw workersError

      const formattedTickets: TicketRow[] =
        (ticketsData || []).map((row: RawTicketRow) => ({
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

      setTickets(formattedTickets)
      setProjects((projectsData as ProjectRow[]) || [])
      setWorkers((workersData as WorkerRow[]) || [])
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load summary'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const todayOpened = tickets.filter((t) => new Date(t.created_at) >= startOfToday).length
    const todayClosed = tickets.filter((t) => t.closed_at && new Date(t.closed_at) >= startOfToday).length

    const weekOpened = tickets.filter((t) => new Date(t.created_at) >= startOfWeek).length
    const weekClosed = tickets.filter((t) => t.closed_at && new Date(t.closed_at) >= startOfWeek).length

    const monthOpened = tickets.filter((t) => new Date(t.created_at) >= startOfMonth).length
    const monthClosed = tickets.filter((t) => t.closed_at && new Date(t.closed_at) >= startOfMonth).length

    const openNow = tickets.filter((t) => t.status === 'NEW').length
    const assignedNow = tickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length

    return {
      todayOpened,
      todayClosed,
      weekOpened,
      weekClosed,
      monthOpened,
      monthClosed,
      openNow,
      assignedNow,
    }
  }, [tickets])

  const projectStats = useMemo(() => {
    return projects
      .map((project) => {
        const projectTickets = tickets.filter((t) => t.project_code === project.project_code)

        return {
          id: project.id,
          name: project.name,
          project_code: project.project_code,
          total: projectTickets.length,
          open: projectTickets.filter((t) => t.status === 'NEW').length,
          assigned: projectTickets.filter((t) => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length,
          closed: projectTickets.filter((t) => t.status === 'CLOSED').length,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [projects, tickets])

  const recentTickets = useMemo(() => {
    return tickets.slice(0, 4)
  }, [tickets])

  const projectsRequiringAttention = useMemo(() => {
    return projectStats
      .filter((p) => p.open > 0 || p.assigned > 0)
      .sort((a, b) => (b.open + b.assigned) - (a.open + a.assigned))
      .slice(0, 6)
  }, [projectStats])

  const workerLoad = useMemo(() => {
    return workers
      .map((worker) => {
        const assignedTickets = tickets.filter(
          (t) => t.assigned_worker_id === worker.id && t.status !== 'CLOSED'
        ).length
        return {
          id: worker.id,
          full_name: worker.full_name,
          assigned_tickets: assignedTickets,
        }
      })
      .filter((w) => w.assigned_tickets > 0)
      .sort((a, b) => b.assigned_tickets - a.assigned_tickets)
  }, [workers, tickets])

  function navigateToTickets(filter?: { status?: string; project?: string; worker?: string }) {
    let url = '/tickets'
    if (filter) {
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.project) params.append('project', filter.project)
      if (filter.worker) params.append('worker', filter.worker)
      if (params.toString()) url += `?${params.toString()}`
    }
    router.push(url)
  }

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
              <Link href="/" style={styles.sidebarNavLink}>Dashboard</Link>
              <Link href="/tickets" style={styles.sidebarNavLink}>Tickets</Link>
              <Link href="/projects" style={styles.sidebarNavLink}>Projects</Link>
              <Link href="/workers" style={styles.sidebarNavLink}>Workers</Link>
              <Link href="/qr" style={styles.sidebarNavLink}>QR Codes</Link>
              <Link href="/summary" style={{ ...styles.sidebarNavLink, ...styles.sidebarNavItemActive }}>Summary</Link>
            </nav>

            <div style={styles.sidebarFooter}>All rights reserved to Yoni Levy</div>
          </aside>
        )}

        <div style={{ ...styles.mainArea, ...(isMobile ? styles.mainAreaMobile : {}) }}>
          <div style={styles.topBar}>
            <div style={styles.brandWrap}>
              <div style={styles.mobileTopRow}>
                <div>
                  <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>
                    Summary
                  </h1>
                  <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
                    Daily, weekly and monthly operational overview
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.topActions}>
            </div>
          </div>

          {loading && <p style={styles.infoText}>Loading summary...</p>}
          {error && <p style={styles.errorText}>{error}</p>}

          {!loading && !error && (
            <>
              <div
                style={{
                  ...styles.statsGrid,
                  gridTemplateColumns: isMobile
                    ? 'repeat(2, minmax(0, 1fr))'
                    : 'repeat(4, minmax(0, 1fr))',
                }}
              >
                <button onClick={() => navigateToTickets()} style={{ ...styles.kpiCard, ...styles.kpiCardButton }}>
                  <div style={styles.kpiLabel}>Open Right Now</div>
                  <div style={styles.kpiValue}>{summary.openNow}</div>
                </button>

                <button onClick={() => navigateToTickets({ status: 'ASSIGNED' })} style={{ ...styles.kpiCard, ...styles.kpiCardButton }}>
                  <div style={styles.kpiLabel}>Assigned Right Now</div>
                  <div style={styles.kpiValue}>{summary.assignedNow}</div>
                </button>

                <button onClick={() => navigateToTickets()} style={{ ...styles.kpiCard, ...styles.kpiCardButton }}>
                  <div style={styles.kpiLabel}>Today Opened</div>
                  <div style={styles.kpiValue}>{summary.todayOpened}</div>
                </button>

                <button onClick={() => navigateToTickets()} style={{ ...styles.kpiCard, ...styles.kpiCardButton }}>
                  <div style={styles.kpiLabel}>Opened This Week</div>
                  <div style={styles.kpiValue}>{summary.weekOpened}</div>
                </button>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>System Health</div>
                    <div style={styles.cardSubtitle}>Key performance indicators</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={styles.insightCard}>
                    <div style={styles.insightLabel}>Resolution Rate (Last 7 days)</div>
                    <div style={styles.insightValue}>
                      {summary.weekOpened > 0 ? 
                        `${Math.round((summary.weekClosed / summary.weekOpened) * 100)}%` : 
                        'N/A'}
                    </div>
                    <div style={styles.insightDescription}>
                      {summary.weekClosed} of {summary.weekOpened} closed
                    </div>
                  </div>

                  <div style={styles.insightCard}>
                    <div style={styles.insightLabel}>Pending Assignments</div>
                    <div style={styles.insightValue}>{summary.openNow}</div>
                    <div style={styles.insightDescription}>
                      Tickets awaiting worker assignment
                    </div>
                  </div>

                  <div style={styles.insightCard}>
                    <div style={styles.insightLabel}>Active Workers</div>
                    <div style={styles.insightValue}>{workerLoad.length}</div>
                    <div style={styles.insightDescription}>
                      Workers with assigned tasks
                    </div>
                  </div>

                  <div style={styles.insightCard}>
                    <div style={styles.insightLabel}>Projects on Track</div>
                    <div style={styles.insightValue}>
                      {projectStats.length > 0 ? 
                        Math.max(0, projectStats.length - projectsRequiringAttention.length) : 
                        0}
                    </div>
                    <div style={styles.insightDescription}>
                      Projects with no open issues
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>Top Priority Projects</div>
                    <div style={styles.cardSubtitle}>Projects with highest workload</div>
                  </div>
                </div>

                {projectsRequiringAttention.length === 0 ? (
                  <div style={styles.emptyInsight}>
                    <div style={styles.emptyInsightTitle}>All clear!</div>
                    <div style={styles.emptyInsightText}>No projects have pending tickets</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {projectsRequiringAttention.slice(0, 4).map((project, idx) => {
                      const workloadPercent = summary.openNow > 0 ? Math.round((project.open / summary.openNow) * 100) : 0
                      return (
                        <div key={project.id} style={styles.priorityProjectRow}>
                          <div style={styles.priorityProjectRank}>{idx + 1}</div>
                          <div style={styles.priorityProjectInfo}>
                            <div style={styles.priorityProjectName}>{project.name}</div>
                            <div style={styles.priorityProjectCode}>{project.project_code}</div>
                          </div>
                          <div style={styles.priorityProjectBar}>
                            <div 
                              style={{
                                height: '4px',
                                background: '#E5E7EB',
                                borderRadius: '2px',
                                overflow: 'hidden'
                              }}
                            >
                              <div 
                                style={{
                                  height: '100%',
                                  background: '#D11F45',
                                  width: `${workloadPercent}%`,
                                  transition: 'width 0.2s ease'
                                }}
                              />
                            </div>
                          </div>
                          <div style={styles.priorityProjectStats}>
                            <span style={styles.priorityStatOpen}>{project.open}</span>
                            <span style={styles.priorityStatAssigned}>{project.assigned}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>Team Capacity</div>
                    <div style={styles.cardSubtitle}>Worker load distribution</div>
                  </div>
                </div>

                {workerLoad.length === 0 ? (
                  <div style={styles.emptyInsight}>
                    <div style={styles.emptyInsightTitle}>No active assignments</div>
                    <div style={styles.emptyInsightText}>All workers are currently available</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {workerLoad.slice(0, 5).map((worker) => {
                      const maxLoad = Math.max(...workerLoad.map((w) => w.assigned_tickets))
                      const loadPercent = (worker.assigned_tickets / (maxLoad || 1)) * 100
                      const isHighLoad = loadPercent > 70
                      
                      return (
                        <div key={worker.id} style={styles.workerLoadRow}>
                          <div style={styles.workerLoadName}>{worker.full_name}</div>
                          <div style={styles.workerLoadBar}>
                            <div 
                              style={{
                                height: '6px',
                                background: '#E5E7EB',
                                borderRadius: '3px',
                                overflow: 'hidden',
                                position: 'relative'
                              }}
                            >
                              <div 
                                style={{
                                  height: '100%',
                                  background: isHighLoad ? '#DC2626' : '#10B981',
                                  width: `${loadPercent}%`,
                                  transition: 'width 0.2s ease'
                                }}
                              />
                            </div>
                          </div>
                          <div style={styles.workerLoadCount}>
                            {worker.assigned_tickets} {isHighLoad ? '(High)' : 'active'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>Projects Performance</div>
                    <div style={styles.cardSubtitle}>
                      Ticket volume and current status by project
                    </div>
                  </div>
                </div>

                {projectStats.length === 0 ? (
                  <p style={styles.infoText}>No project data found.</p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Project</th>
                          <th style={styles.th}>Code</th>
                          <th style={styles.th}>Total</th>
                          <th style={styles.th}>Open</th>
                          <th style={styles.th}>Assigned</th>
                          <th style={styles.th}>Closed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectStats.map((project) => (
                          <tr key={project.id}>
                            <td style={styles.tdStrong}>{project.name}</td>
                            <td style={styles.tdCode}>{project.project_code}</td>
                            <td style={styles.td}>{project.total}</td>
                            <td style={styles.td}>{project.open}</td>
                            <td style={styles.td}>{project.assigned}</td>
                            <td style={styles.td}>{project.closed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    height: '100dvh',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    background: '#F4F4F5',
    color: '#2F2F33',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    paddingTop: 'env(safe-area-inset-top)',
  },
  appShell: {
    display: 'grid',
    width: '100%',
    height: '100dvh',
    overflow: 'hidden',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100%',
    justifyContent: 'space-between',
    overflow: 'auto',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '18px',
    color: '#FFFFFF',
    boxShadow: '0 8px 20px rgba(193, 18, 31, 0.25)',
    flexShrink: 0,
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
  sidebarFooter: {
    marginTop: 'auto',
    fontSize: '13px',
    color: '#6B7280',
    padding: '12px 14px',
  },
  mobileTopRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  // backButton removed (mobile headers no longer show arrow icons)
  mainArea: {
    padding: '24px',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    height: '100%',
  },
  mainAreaMobile: {
    padding: '18px 14px',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    height: '100%',
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
    alignItems: 'flex-start',
    gap: '10px',
  },
  title: {
    margin: 0,
    fontSize: '36px',
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
  // secondaryButton removed (using shared Button component)
  secondaryLinkButton: {
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    color: '#2F2F33',
    cursor: 'pointer',
    fontWeight: 700,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
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
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
    textAlign: 'left',
    minWidth: 0,
    minHeight: '110px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
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
  card: {
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
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
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '16px',
  },
  table: {
    minWidth: '760px',
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
  tdStrong: {
    padding: '14px 12px',
    borderBottom: '1px solid #EFEFF1',
    color: '#111827',
    fontSize: '14px',
    fontWeight: 800,
    verticalAlign: 'top',
  },
  tdCode: {
    padding: '14px 12px',
    borderBottom: '1px solid #EFEFF1',
    color: '#C1121F',
    fontSize: '13px',
    fontWeight: 800,
    verticalAlign: 'top',
  },
  infoText: {
    color: '#6B7280',
    margin: 0,
  },
  kpiCardButton: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    fontFamily: 'inherit',
  },
  ticketItem: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '14px',
  },
  ticketItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  ticketNumber: {
    fontWeight: 700,
    color: '#111827',
    fontSize: '14px',
  },
  ticketProject: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 600,
  },
  ticketDetail: {
    fontSize: '13px',
    color: '#4B5563',
    marginBottom: '6px',
    lineHeight: 1.4,
  },
  ticketMeta: {
    fontSize: '11px',
    color: '#9CA3AF',
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },
  projectItem: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '14px',
  },
  projectItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    gap: '10px',
  },
  projectName: {
    fontWeight: 700,
    color: '#111827',
    fontSize: '14px',
    marginBottom: '4px',
  },
  projectCode: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 600,
  },
  projectStats: {
    fontSize: '13px',
    color: '#4B5563',
    whiteSpace: 'nowrap',
  },
  workerItem: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '14px',
  },
  workerItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  workerName: {
    fontWeight: 700,
    color: '#111827',
    fontSize: '14px',
  },
  workerTicketCount: {
    fontSize: '13px',
    color: '#4B5563',
    fontWeight: 600,
  },
  smallButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '12px',
    borderRadius: '8px',
    background: '#111827',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 700,
    transition: 'all 0.2s ease',
  },
  errorText: {
    color: '#B91C3C',
    margin: 0,
    fontWeight: 600,
  },
  // New insight-focused styles
  insightCard: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  insightLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  insightValue: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1,
  },
  insightDescription: {
    fontSize: '12px',
    color: '#4B5563',
    lineHeight: 1.4,
  },
  emptyInsight: {
    textAlign: 'center',
    padding: '24px 12px',
  },
  emptyInsightTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  },
  emptyInsightText: {
    fontSize: '14px',
    color: '#6B7280',
  },
  priorityProjectRow: {
    display: 'grid',
    gridTemplateColumns: '24px 1fr 120px 80px',
    gap: '12px',
    alignItems: 'center',
    padding: '12px',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
  },
  priorityProjectRank: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#D11F45',
    textAlign: 'center',
  },
  priorityProjectInfo: {
    minWidth: 0,
  },
  priorityProjectName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '2px',
  },
  priorityProjectCode: {
    fontSize: '12px',
    color: '#6B7280',
  },
  priorityProjectBar: {
    display: 'flex',
    alignItems: 'center',
  },
  priorityProjectStats: {
    display: 'flex',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
  },
  priorityStatOpen: {
    color: '#DC2626',
  },
  priorityStatAssigned: {
    color: '#2563EB',
  },
  workerLoadRow: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr 100px',
    gap: '12px',
    alignItems: 'center',
  },
  workerLoadName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  workerLoadBar: {
    display: 'flex',
    alignItems: 'center',
  },
  workerLoadCount: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#4B5563',
    textAlign: 'right',
  },
}


