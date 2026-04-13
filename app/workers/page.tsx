'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'
import { validateRequired, validatePhoneNumber, validateEmail } from '@/lib/validators'
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
  Drawer,
  EmptyState,
  theme
} from '../components/ui'

type WorkerRow = {
  id: string
  full_name: string
  phone: string
  email: string | null
  role: string | null
  is_active: boolean
  created_at: string
  client_id: string
}

type TicketRow = {
  id: string
  ticket_number: number
  status: string
  priority?: string | null
  project_code?: string
  project_name?: string
}

type RawTicketWithProjects = {
  id: string
  ticket_number: number
  status: string
  priority?: string | null
  projects?: {
    project_code?: string
    name?: string
  } | {
    project_code?: string
    name?: string
  }[]
}

type ClientRow = {
  id: string
}

type WorkerForm = {
  full_name: string
  phone: string
  email: string
  role: string
  is_active: boolean
}

const emptyForm: WorkerForm = {
  full_name: '',
  phone: '',
  email: '',
  role: '',
  is_active: true,
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<WorkerRow | null>(null)
  const [form, setForm] = useState<WorkerForm>(emptyForm)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(null)
  const [workerTickets, setWorkerTickets] = useState<TicketRow[]>([])
  const [loadingWorkerTickets, setLoadingWorkerTickets] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function loadClientId() {
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) throw error

    const firstClient = (data as ClientRow[] | null)?.[0]
    if (!firstClient?.id) {
      throw new Error('No client found in clients table')
    }

    setClientId(firstClient.id)
    return firstClient.id
  }

  async function loadWorkers(nextClientId?: string) {
    const activeClientId = nextClientId || clientId

    if (!activeClientId) return

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('client_id', activeClientId)
      .order('created_at', { ascending: false })

    if (error) throw error

    setWorkers((data as WorkerRow[]) || [])
  }

  async function initializePage() {
    setLoading(true)
    setError('')
    await asyncHandler(
      async () => {
        const fetchedClientId = await loadClientId()
        await loadWorkers(fetchedClientId)
        return true
      },
      {
        context: 'Failed to load workers',
        showErrorToast: true,
        onError: (err) => setError(err),
      }
    )
    setLoading(false)
  }

  useEffect(() => {
    initializePage()
  }, [])

  function openCreateDrawer() {
    setEditingWorker(null)
    setForm(emptyForm)
    setDrawerOpen(true)
  }

  function openEditDrawer(worker: WorkerRow) {
    setEditingWorker(worker)
    setForm({
      full_name: worker.full_name || '',
      phone: worker.phone || '',
      email: worker.email || '',
      role: worker.role || '',
      is_active: worker.is_active,
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    if (saving) return
    setDrawerOpen(false)
    setEditingWorker(null)
    setForm(emptyForm)
  }

  function updateForm<K extends keyof WorkerForm>(key: K, value: WorkerForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function validateForm() {
    const nameError = validateRequired(form.full_name, 'Full name')
    if (nameError) return nameError.message

    const phoneError = validatePhoneNumber(form.phone, 'Phone')
    if (phoneError) return phoneError.message

    if (form.email) {
      const emailError = validateEmail(form.email, 'Email')
      if (emailError) return emailError.message
    }

    if (!clientId) return 'Client ID not found'
    return ''
  }

  async function saveWorker() {
    const validationError = validateForm()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    setError('')

    await asyncHandler(
      async () => {
        const payload = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          role: form.role.trim() || null,
          is_active: form.is_active,
          client_id: clientId,
        }

        if (editingWorker) {
          const { error } = await supabase
            .from('workers')
            .update(payload)
            .eq('id', editingWorker.id)

          if (error) throw error
          toast.success('Worker updated')
        } else {
          const { error } = await supabase
            .from('workers')
            .insert(payload)

          if (error) throw error
          toast.success('Worker created')
        }

        await loadWorkers()
        closeDrawer()
        return true
      },
      {
        context: 'Failed to save worker',
        showErrorToast: true,
      }
    )

    setSaving(false)
  }

  async function toggleWorkerStatus(worker: WorkerRow) {
    await asyncHandler(
      async () => {
        const { error } = await supabase
          .from('workers')
          .update({ is_active: !worker.is_active })
          .eq('id', worker.id)

        if (error) throw error

        toast.success(worker.is_active ? 'Worker deactivated' : 'Worker activated')
        await loadWorkers()
        return true
      },
      {
        context: 'Failed to update worker status',
        showErrorToast: true,
      }
    )
  }

  async function deleteWorker(worker: WorkerRow) {
    const confirmed = window.confirm(
      `Delete ${worker.full_name}?\n\nThis is a hard delete. If this worker is linked to tickets, deletion may fail or break relations.`
    )

    if (!confirmed) return

    await asyncHandler(
      async () => {
        const { error } = await supabase
          .from('workers')
          .delete()
          .eq('id', worker.id)

        if (error) throw error

        toast.success('Worker deleted')
        await loadWorkers()

        if (editingWorker?.id === worker.id) {
          closeDrawer()
        }
        return true
      },
      {
        context: 'Failed to delete worker',
        showErrorToast: true,
      }
    )
  }

  async function openDetailDrawer(worker: WorkerRow) {
    setSelectedWorker(worker)
    setDetailDrawerOpen(true)
    await fetchWorkerTickets(worker.id)
  }

  function closeDetailDrawer() {
    setDetailDrawerOpen(false)
    setSelectedWorker(null)
    setWorkerTickets([])
  }

  async function fetchWorkerTickets(workerId: string) {
    setLoadingWorkerTickets(true)
    await asyncHandler(
      async () => {
        const { data, error } = await supabase
          .from('tickets')
          .select(`
          id,
          ticket_number,
          status,
          priority,
          projects (
            project_code,
            name
          )
        `)
          .eq('assigned_worker_id', workerId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) throw error

        const mapped = (data || []).map((ticket: RawTicketWithProjects) => {
          let projectCode = 'N/A'
          let projectName = 'Unknown'

          if (ticket.projects) {
            if (Array.isArray(ticket.projects)) {
              projectCode = ticket.projects[0]?.project_code || 'N/A'
              projectName = ticket.projects[0]?.name || 'Unknown'
            } else {
              projectCode = ticket.projects.project_code || 'N/A'
              projectName = ticket.projects.name || 'Unknown'
            }
          }

          return {
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            status: ticket.status,
            priority: ticket.priority,
            project_code: projectCode,
            project_name: projectName,
          }
        })

        setWorkerTickets(mapped)
        return true
      },
      {
        context: 'Failed to load worker tickets',
        showErrorToast: false,
      }
    )
    setLoadingWorkerTickets(false)
  }

  function viewWorkerTickets(workerId: string) {
    window.location.href = `/tickets?worker=${encodeURIComponent(workerId)}`
  }

  const stats = useMemo(() => {
    const total = workers.length
    const active = workers.filter((w) => w.is_active).length
    const inactive = workers.filter((w) => !w.is_active).length

    return { total, active, inactive }
  }, [workers])

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const q = searchTerm.trim().toLowerCase()

      const matchesSearch =
        !q ||
        worker.full_name.toLowerCase().includes(q) ||
        worker.phone.toLowerCase().includes(q) ||
        (worker.email || '').toLowerCase().includes(q) ||
        (worker.role || '').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && worker.is_active) ||
        (statusFilter === 'INACTIVE' && !worker.is_active)

      return matchesSearch && matchesStatus
    })
  }, [workers, searchTerm, statusFilter])

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="Workers"
          subtitle={`${filteredWorkers.length} team members`}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="Workers"
            subtitle="Manage your team directly from the dashboard"
            actions={
              <>
                <Button variant="primary" onClick={openCreateDrawer}>
                  Add Worker
                </Button>
                <Button variant="secondary" onClick={initializePage}>
                  Refresh
                </Button>
              </>
            }
          />
        )}

        {/* KPI Cards */}
        <div style={{
          ...styles.kpiGrid,
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
        }}>
          <KpiCard label="Total Workers" value={stats.total} />
          <KpiCard label="Active" value={stats.active} />
          <KpiCard label="Inactive" value={stats.inactive} />
        </div>

        {/* Workers Card */}
        <Card
          title="Team Members"
          subtitle="Search, edit, activate or remove workers"
          noPadding
        >
          {/* Filters */}
          <div style={styles.filtersRow}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name, phone, email, role..."
              style={{ maxWidth: isMobile ? '100%' : '320px' }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              style={styles.filterSelect}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {loading && (
            <div style={styles.loadingState}>
              <div style={styles.loadingSpinner} />
              <span>Loading workers...</span>
            </div>
          )}

          {error && (
            <div style={styles.errorState}>
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={initializePage}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && filteredWorkers.length === 0 && (
            <EmptyState
              title="No workers found"
              description="Try adjusting your filters or add a new worker."
              action={
                <Button variant="primary" onClick={openCreateDrawer}>
                  Add Worker
                </Button>
              }
            />
          )}

          {!loading && !error && filteredWorkers.length > 0 && (
            <div style={styles.workerGrid}>
              {filteredWorkers.map((worker) => (
                <div
                  key={worker.id}
                  onClick={() => openDetailDrawer(worker)}
                  style={styles.workerCard}
                >
                  <div style={styles.workerCardHeader}>
                    <div style={styles.workerAvatar}>
                      {worker.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.workerInfo}>
                      <div style={styles.workerName}>{worker.full_name}</div>
                      <div style={styles.workerRole}>{worker.role || 'No role set'}</div>
                    </div>
                    <StatusBadge status={worker.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                  </div>

                  <div style={styles.workerMeta}>
                    <div style={styles.workerMetaItem}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span>{worker.phone}</span>
                    </div>
                    {worker.email && (
                      <div style={styles.workerMetaItem}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="16" x="2" y="4" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <span>{worker.email}</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.workerActions} onClick={(e) => e.stopPropagation()}>
                    <Button variant="secondary" size="sm" onClick={() => openEditDrawer(worker)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => toggleWorkerStatus(worker)}>
                      {worker.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create/Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingWorker ? 'Edit Worker' : 'Add Worker'}
        subtitle={editingWorker ? 'Update worker details' : 'Add a new team member'}
        isMobile={isMobile}
      >
        <div style={styles.drawerContent}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Full Name *</label>
            <input
              value={form.full_name}
              onChange={(e) => updateForm('full_name', e.target.value)}
              placeholder="Enter full name"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Phone *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateForm('phone', e.target.value)}
              placeholder="Enter phone number"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              placeholder="Enter email address"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Role</label>
            <input
              value={form.role}
              onChange={(e) => updateForm('role', e.target.value)}
              placeholder="e.g. Technician, Plumber, Electrician"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => updateForm('is_active', e.target.checked)}
                style={styles.checkbox}
              />
              <span>Active</span>
            </label>
          </div>

          <div style={styles.drawerActions}>
            <Button variant="secondary" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveWorker} loading={saving}>
              {editingWorker ? 'Update' : 'Create'}
            </Button>
          </div>

          {editingWorker && (
            <div style={styles.dangerZone}>
              <Button
                variant="danger"
                onClick={() => deleteWorker(editingWorker)}
                style={{ width: '100%' }}
              >
                Delete Worker
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        open={detailDrawerOpen}
        onClose={closeDetailDrawer}
        title={selectedWorker?.full_name || ''}
        subtitle={selectedWorker?.role || 'No role set'}
        isMobile={isMobile}
      >
        {selectedWorker && (
          <div style={styles.drawerContent}>
            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Status</div>
              <StatusBadge status={selectedWorker.is_active ? 'ACTIVE' : 'INACTIVE'} />
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Phone</div>
              <div style={styles.detailValue}>{selectedWorker.phone}</div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Email</div>
              <div style={styles.detailValue}>{selectedWorker.email || 'Not set'}</div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Created</div>
              <div style={styles.detailValue}>
                {new Date(selectedWorker.created_at).toLocaleString()}
              </div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Assigned Tickets</div>
              {loadingWorkerTickets ? (
                <div style={styles.ticketLoading}>Loading...</div>
              ) : workerTickets.length === 0 ? (
                <div style={styles.noTickets}>No tickets assigned</div>
              ) : (
                <div style={styles.ticketList}>
                  {workerTickets.map((ticket) => (
                    <div key={ticket.id} style={styles.ticketItem}>
                      <div style={styles.ticketItemMain}>
                        <span style={styles.ticketNumber}>#{ticket.ticket_number}</span>
                        <span style={styles.ticketProject}>{ticket.project_code}</span>
                      </div>
                      <StatusBadge status={ticket.status} size="sm" />
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => viewWorkerTickets(selectedWorker.id)}
                  >
                    View all assigned tickets
                  </Button>
                </div>
              )}
            </div>

            <div style={styles.drawerActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  closeDetailDrawer()
                  openEditDrawer(selectedWorker)
                }}
                style={{ flex: 1 }}
              >
                Edit Worker
              </Button>
              <Button
                variant="primary"
                onClick={() => viewWorkerTickets(selectedWorker.id)}
                style={{ flex: 1 }}
              >
                View Tickets
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Mobile Bottom Actions */}
      {isMobile && (
        <div style={styles.mobileBottomActions}>
          <Button variant="primary" onClick={openCreateDrawer} style={{ flex: 1 }}>
            Add Worker
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
  filterSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    minWidth: '140px',
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
  workerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
    padding: '20px',
  },
  workerCard: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  workerCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  workerAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #d97706 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 600,
    fontSize: '18px',
    flexShrink: 0,
  },
  workerInfo: {
    flex: 1,
    minWidth: 0,
  },
  workerName: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    marginBottom: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  workerRole: {
    fontSize: '13px',
    color: theme.colors.textMuted,
  },
  workerMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  workerMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: theme.colors.textSecondary,
  },
  workerActions: {
    display: 'flex',
    gap: '8px',
    paddingTop: '16px',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
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
  formInput: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: theme.colors.primary,
  },
  drawerActions: {
    display: 'flex',
    gap: '10px',
    paddingTop: '12px',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  dangerZone: {
    paddingTop: '20px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '8px',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailValue: {
    fontSize: '14px',
    color: theme.colors.textPrimary,
  },
  ticketLoading: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    padding: '12px 0',
  },
  noTickets: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    padding: '12px 0',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  ticketItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: theme.colors.surfaceActive,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
  },
  ticketItemMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  ticketNumber: {
    fontSize: '13px',
    fontWeight: 500,
    color: theme.colors.textPrimary,
  },
  ticketProject: {
    fontSize: '12px',
    color: theme.colors.primary,
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
