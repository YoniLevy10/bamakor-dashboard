'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AppShell,
  MobileHeader,
  MobileMenu,
  PageHeader,
  KpiCard,
  Card,
  Button,
  StatusBadge,
  Select,
  LoadingSpinner,
  theme
} from '../components/ui'

type TicketRow = {
  id: string
  ticket_number: number
  project_id?: string
  project_code?: string
  project_name?: string
  reporter_phone: string
  description: string
  status: string
  priority?: string
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
  priority?: string
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
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week')

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
    try {
      const [
        { data: ticketsData, error: ticketsError },
        { data: projectsData, error: projectsError },
        { data: workersData, error: workersError },
      ] = await Promise.all([
        supabase
          .from('tickets')
          .select(`
            id, ticket_number, project_id, reporter_phone, description,
            status, priority, assigned_worker_id, created_at, closed_at,
            projects (project_code, name)
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

      const formattedTickets: TicketRow[] = (ticketsData || []).map((row: RawTicketRow) => ({
        id: row.id,
        ticket_number: row.ticket_number,
        project_id: row.project_id,
        project_code: Array.isArray(row.projects) ? row.projects?.[0]?.project_code || '' : row.projects?.project_code || '',
        project_name: Array.isArray(row.projects) ? row.projects?.[0]?.name || '' : row.projects?.name || '',
        reporter_phone: row.reporter_phone,
        description: row.description,
        status: row.status,
        priority: row.priority,
        assigned_worker_id: row.assigned_worker_id,
        created_at: row.created_at,
        closed_at: row.closed_at,
      }))

      setTickets(formattedTickets)
      setProjects((projectsData as ProjectRow[]) || [])
      setWorkers((workersData as WorkerRow[]) || [])
    } catch (err) {
      console.error('Failed to load summary:', err)
    }
    setLoading(false)
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

  const projectsRequiringAttention = useMemo(() => {
    return projectStats
      .filter((p) => p.open > 0 || p.assigned > 0)
      .sort((a, b) => (b.open + b.assigned) - (a.open + a.assigned))
      .slice(0, 6)
  }, [projectStats])

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

  function formatDate() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="Summary"
          subtitle={formatDate()}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="Summary"
            subtitle="Operational overview and performance metrics"
            actions={
              <Select
                value={period}
                onChange={(value) => setPeriod(value as 'week' | 'month' | 'all')}
                options={[
                  { label: 'This Week', value: 'week' },
                  { label: 'This Month', value: 'month' },
                  { label: 'All Time', value: 'all' },
                ]}
              />
            }
          />
        )}

        {loading ? (
          <div style={styles.loadingContainer}>
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{
              ...styles.kpiGrid,
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            }}>
              <KpiCard
                label="Open Now"
                value={summary.openNow}
                accent="warning"
                onClick={() => navigateToTickets({ status: 'NEW' })}
              />
              <KpiCard
                label="In Progress"
                value={summary.assignedNow}
                accent="primary"
                onClick={() => navigateToTickets({ status: 'ASSIGNED' })}
              />
              <KpiCard
                label="Opened This Week"
                value={summary.weekOpened}
                accent="primary"
                onClick={() => navigateToTickets()}
              />
              <KpiCard
                label="Closed This Week"
                value={summary.weekClosed}
                accent="success"
              />
            </div>

            {/* System Health */}
            <Card title="System Health" subtitle="Key performance indicators">
              <div style={styles.metricsGrid}>
                <div style={styles.metricCard}>
                  <div style={styles.metricValue}>
                    {summary.weekOpened > 0
                      ? `${Math.round((summary.weekClosed / summary.weekOpened) * 100)}%`
                      : 'N/A'}
                  </div>
                  <div style={styles.metricLabel}>Resolution Rate (7d)</div>
                  <div style={styles.metricDescription}>
                    {summary.weekClosed} of {summary.weekOpened} closed
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricValue}>{summary.openNow}</div>
                  <div style={styles.metricLabel}>Pending Assignment</div>
                  <div style={styles.metricDescription}>
                    Tickets awaiting workers
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricValue}>{workerLoad.length}</div>
                  <div style={styles.metricLabel}>Active Workers</div>
                  <div style={styles.metricDescription}>
                    With assigned tasks
                  </div>
                </div>

                <div style={styles.metricCard}>
                  <div style={styles.metricValue}>
                    {Math.max(0, projectStats.length - projectsRequiringAttention.length)}
                  </div>
                  <div style={styles.metricLabel}>Projects On Track</div>
                  <div style={styles.metricDescription}>
                    No open issues
                  </div>
                </div>
              </div>
            </Card>

            {/* Two Column Layout */}
            <div style={{
              ...styles.twoColumnGrid,
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            }}>
              {/* Top Priority Projects */}
              <Card title="Top Priority Projects" subtitle="Highest workload">
                {projectsRequiringAttention.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    <div style={styles.emptyTitle}>All Clear</div>
                    <div style={styles.emptyText}>No projects have pending tickets</div>
                  </div>
                ) : (
                  <div style={styles.priorityList}>
                    {projectsRequiringAttention.map((project, idx) => (
                      <div
                        key={project.id}
                        style={styles.priorityItem}
                        onClick={() => navigateToTickets({ project: project.project_code })}
                      >
                        <div style={styles.priorityRank}>{idx + 1}</div>
                        <div style={styles.priorityInfo}>
                          <div style={styles.priorityName}>{project.name}</div>
                          <div style={styles.priorityCode}>{project.project_code}</div>
                        </div>
                        <div style={styles.priorityStats}>
                          <span style={styles.priorityOpen}>{project.open} open</span>
                          <span style={styles.priorityAssigned}>{project.assigned} in progress</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Team Capacity */}
              <Card title="Team Capacity" subtitle="Worker load distribution">
                {workerLoad.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                    </div>
                    <div style={styles.emptyTitle}>No Active Assignments</div>
                    <div style={styles.emptyText}>All workers are currently available</div>
                  </div>
                ) : (
                  <div style={styles.workerList}>
                    {workerLoad.slice(0, 6).map((worker) => {
                      const maxLoad = Math.max(...workerLoad.map((w) => w.assigned_tickets))
                      const loadPercent = (worker.assigned_tickets / (maxLoad || 1)) * 100
                      const isHighLoad = loadPercent > 70

                      return (
                        <div
                          key={worker.id}
                          style={styles.workerItem}
                          onClick={() => navigateToTickets({ worker: worker.id })}
                        >
                          <div style={styles.workerName}>{worker.full_name}</div>
                          <div style={styles.workerBarContainer}>
                            <div style={styles.workerBarBg}>
                              <div
                                style={{
                                  ...styles.workerBarFill,
                                  width: `${loadPercent}%`,
                                  background: isHighLoad ? theme.colors.error : theme.colors.success,
                                }}
                              />
                            </div>
                          </div>
                          <div style={{
                            ...styles.workerCount,
                            color: isHighLoad ? theme.colors.error : theme.colors.textMuted,
                          }}>
                            {worker.assigned_tickets} {isHighLoad ? '(High)' : 'active'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Projects Performance Table */}
            <Card title="Projects Performance" subtitle="Ticket volume by project" noPadding>
              {projectStats.length === 0 ? (
                <div style={styles.emptyTableState}>
                  <p style={styles.emptyText}>No project data found</p>
                </div>
              ) : (
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Project</th>
                        <th style={styles.th}>Code</th>
                        <th style={styles.th}>Total</th>
                        <th style={styles.th}>Open</th>
                        <th style={styles.th}>In Progress</th>
                        <th style={styles.th}>Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectStats.slice(0, 10).map((project) => (
                        <tr
                          key={project.id}
                          style={styles.tr}
                          onClick={() => navigateToTickets({ project: project.project_code })}
                        >
                          <td style={styles.td}>
                            <span style={styles.projectName}>{project.name}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.projectCode}>{project.project_code}</span>
                          </td>
                          <td style={styles.td}>{project.total}</td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statBadge,
                              color: project.open > 0 ? theme.colors.warning : theme.colors.textMuted,
                            }}>
                              {project.open}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statBadge,
                              color: project.assigned > 0 ? theme.colors.info : theme.colors.textMuted,
                            }}>
                              {project.assigned}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.statBadge,
                              color: theme.colors.success,
                            }}>
                              {project.closed}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: {
    padding: '32px 40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '80px 0',
  },
  kpiGrid: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
  },
  metricCard: {
    padding: '20px',
    background: theme.colors.muted,
    borderRadius: theme.radius.md,
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    letterSpacing: '-0.02em',
  },
  metricLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
    marginTop: '4px',
  },
  metricDescription: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    marginTop: '4px',
  },
  twoColumnGrid: {
    display: 'grid',
    gap: '24px',
    marginBottom: '24px',
    marginTop: '24px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    marginBottom: '12px',
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  emptyText: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    marginTop: '4px',
  },
  emptyTableState: {
    padding: '48px 24px',
    textAlign: 'center',
  },
  priorityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  priorityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
    background: theme.colors.muted,
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  priorityRank: {
    width: '28px',
    height: '28px',
    borderRadius: theme.radius.full,
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  },
  priorityInfo: {
    flex: 1,
    minWidth: 0,
  },
  priorityName: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textPrimary,
  },
  priorityCode: {
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
  priorityStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  priorityOpen: {
    fontSize: '12px',
    fontWeight: 500,
    color: theme.colors.warning,
  },
  priorityAssigned: {
    fontSize: '11px',
    color: theme.colors.textMuted,
  },
  workerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  workerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    cursor: 'pointer',
  },
  workerName: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textPrimary,
    minWidth: '100px',
  },
  workerBarContainer: {
    flex: 1,
  },
  workerBarBg: {
    height: '6px',
    background: theme.colors.border,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  workerBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  workerCount: {
    fontSize: '12px',
    minWidth: '60px',
    textAlign: 'right',
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
  projectName: {
    fontWeight: 500,
  },
  projectCode: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    background: theme.colors.muted,
    padding: '4px 8px',
    borderRadius: theme.radius.sm,
  },
  statBadge: {
    fontWeight: 600,
  },
}
