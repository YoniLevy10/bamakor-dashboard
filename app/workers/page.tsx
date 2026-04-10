'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'
import { validateRequired, validatePhoneNumber, validateEmail } from '@/lib/validators'

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
  const [successMessage, setSuccessMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [isMobile, setIsMobile] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => setSuccessMessage(''), 1800)
    return () => window.clearTimeout(timer)
  }, [successMessage])

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
          // Handle projects as either single object or array
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
              <Link href="/workers" style={{ ...styles.sidebarNavLink, ...styles.sidebarNavItemActive }}>Workers</Link>
              <Link href="/qr" style={styles.sidebarNavLink}>QR Codes</Link>
              <Link href="/summary" style={styles.sidebarNavLink}>Summary</Link>
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
            <div style={styles.titleWrap}>
              <div style={styles.mobileTopRow}>
                <Link href="/" style={styles.backButton}>
                  ←
                </Link>

                <div>
                  <h1
                    style={{
                      ...styles.title,
                      ...(isMobile ? styles.titleMobile : {}),
                    }}
                  >
                    Workers
                  </h1>
                  <p
                    style={{
                      ...styles.subtitle,
                      ...(isMobile ? styles.subtitleMobile : {}),
                    }}
                  >
                    Manage your team directly from the dashboard
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.topActions}>
              <button onClick={initializePage} style={styles.secondaryButton}>
                Refresh
              </button>
              <button onClick={openCreateDrawer} style={styles.primaryButton}>
                Add Worker
              </button>
            </div>
          </div>

          {successMessage && <div style={styles.toast}>{successMessage}</div>}

          <div
            style={{
              ...styles.statsGrid,
              gridTemplateColumns: isMobile
                ? 'repeat(2, minmax(0, 1fr))'
                : 'repeat(3, minmax(0, 1fr))',
            }}
          >
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Total Workers</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Active</div>
              <div style={styles.statValue}>{stats.active}</div>
            </div>

            <div
              style={{
                ...styles.statCard,
                ...(isMobile ? styles.statCardFullWidthMobile : {}),
              }}
            >
              <div style={styles.statLabel}>Inactive</div>
              <div style={styles.statValue}>{stats.inactive}</div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.cardTitle}>Team Members</div>
                <div style={styles.cardSubtitle}>Search, edit, activate or remove workers</div>
              </div>
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
                placeholder="Search by name, phone, email or role..."
                style={styles.searchInput}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                style={{
                  ...styles.filterSelect,
                  width: isMobile ? '100%' : '190px',
                }}
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {loading && <p style={styles.infoText}>Loading workers...</p>}
            {error && <p style={styles.errorText}>{error}</p>}

            {!loading && !error && filteredWorkers.length === 0 && (
              <p style={styles.infoText}>No workers found.</p>
            )}

            {!loading && !error && filteredWorkers.length > 0 && (
              <div
                style={{
                  ...styles.workerGrid,
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : 'repeat(auto-fit, minmax(320px, 1fr))',
                }}
              >
                {filteredWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    style={{
                      ...styles.workerCard,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => openDetailDrawer(worker)}
                  >
                    <div style={styles.workerTopRow}>
                      <div>
                        <div style={styles.workerName}>{worker.full_name}</div>
                        <div style={styles.workerRole}>{worker.role || 'No role set'}</div>
                      </div>

                      <span
                        style={{
                          ...styles.statusPill,
                          ...(worker.is_active ? styles.activePill : styles.inactivePill),
                        }}
                      >
                        {worker.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div style={styles.workerInfoBlock}>
                      <div style={styles.workerInfoLine}>📞 {worker.phone}</div>
                      <div style={styles.workerInfoLine}>✉️ {worker.email || '-'}</div>
                      <div style={styles.workerInfoLine}>
                        🕒 {new Date(worker.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={styles.workerActions}>
                      <button
                        onClick={() => openEditDrawer(worker)}
                        style={styles.secondaryButtonSmall}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => toggleWorkerStatus(worker)}
                        style={styles.secondaryButtonSmall}
                      >
                        {worker.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => deleteWorker(worker)}
                        style={styles.dangerButtonSmall}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {detailDrawerOpen && selectedWorker && (
        <>
          <div style={styles.drawerOverlay} onClick={closeDetailDrawer} />
          <div
            style={{
              ...styles.drawer,
              width: isMobile ? '100%' : '460px',
            }}
          >
            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerTitle}>{selectedWorker.full_name}</div>
                <div style={styles.drawerSubtitle}>{selectedWorker.role || 'No role set'}</div>
              </div>
              <button onClick={closeDetailDrawer} style={styles.drawerCloseButton}>
                ✕
              </button>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Phone</div>
              <div style={styles.drawerValue}>{selectedWorker.phone}</div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Email</div>
              <div style={styles.drawerValue}>{selectedWorker.email || '-'}</div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Status</div>
              <div
                style={{
                  ...styles.statusPill,
                  ...(selectedWorker.is_active ? styles.activePill : styles.inactivePill),
                }}
              >
                {selectedWorker.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Created</div>
              <div style={styles.drawerValue}>
                {new Date(selectedWorker.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>

            <div style={{ ...styles.drawerSection, marginTop: '24px', borderTop: '1px solid #EFEFF1', paddingTop: '16px' }}>
              <div style={styles.drawerLabel}>Assigned Tickets</div>
              {loadingWorkerTickets && (
                <div style={styles.drawerValue}>Loading tickets...</div>
              )}
              {!loadingWorkerTickets && workerTickets.length === 0 && (
                <div style={styles.drawerValue}>No tickets assigned</div>
              )}
              {!loadingWorkerTickets && workerTickets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {workerTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      style={{
                        background: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        padding: '12px',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '4px', color: '#111827' }}>
                        #{ticket.ticket_number} - {ticket.project_code}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...getTicketStatusStyle(ticket.status),
                          }}
                        >
                          {ticket.status}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...getTicketPriorityStyle(ticket.priority),
                          }}
                        >
                          {ticket.priority || 'LOW'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.drawerActions}>
              <button
                onClick={() => viewWorkerTickets(selectedWorker.id)}
                style={{ ...styles.primaryButton, width: '100%' }}
              >
                View Assigned Tickets
              </button>
            </div>
          </div>
        </>
      )}

      {drawerOpen && (
        <>
          <div style={styles.drawerOverlay} onClick={closeDrawer} />

          <div
            style={{
              ...styles.drawer,
              width: isMobile ? '100%' : '460px',
            }}
          >
            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerTitle}>
                  {editingWorker ? 'Edit Worker' : 'Add Worker'}
                </div>
                <div style={styles.drawerSubtitle}>
                  {editingWorker
                    ? 'Update worker details and status'
                    : 'Create a new worker for this client'}
                </div>
              </div>

              <button onClick={closeDrawer} style={styles.drawerCloseButton}>
                ✕
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                value={form.full_name}
                onChange={(e) => updateForm('full_name', e.target.value)}
                style={styles.input}
                placeholder="Enter worker full name"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => updateForm('phone', e.target.value)}
                style={styles.input}
                placeholder="Enter phone number"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                value={form.email}
                onChange={(e) => updateForm('email', e.target.value)}
                style={styles.input}
                placeholder="Enter email"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Role</label>
              <input
                value={form.role}
                onChange={(e) => updateForm('role', e.target.value)}
                style={styles.input}
                placeholder="Technician / Electrician / Manager..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select
                value={form.is_active ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => updateForm('is_active', e.target.value === 'ACTIVE')}
                style={styles.input}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div style={styles.drawerActions}>
              <button onClick={saveWorker} style={styles.primaryButton}>
                {saving ? 'Saving...' : editingWorker ? 'Save Changes' : 'Create Worker'}
              </button>

              <button onClick={closeDrawer} style={styles.secondaryButton}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

function getTicketStatusStyle(status: string): CSSProperties {
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

function getTicketPriorityStyle(priority?: string | null): CSSProperties {
  switch ((priority || '').toUpperCase()) {
    case 'URGENT':
    case 'HIGH':
      return { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }
    case 'MEDIUM':
    case 'NORMAL':
      return { background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }
    case 'LOW':
      return { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
    default:
      return { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }
  }
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
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    height: '100%',
  },
  mainAreaMobile: {
    padding: 'calc(18px + env(safe-area-inset-top)) 14px 18px 14px',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    height: '100%',
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
  titleWrap: {
    minWidth: 0,
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
    border: '1px solid #D7D7DB',
    color: '#111827',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    flexShrink: 0,
  },
  topActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
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
  secondaryButton: {
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '12px',
    background: '#FFFFFF',
    border: '1px solid #D7D7DB',
    color: '#2F2F33',
    cursor: 'pointer',
    fontWeight: 700,
    transition: 'all 0.2s ease',
  },
  primaryButton: {
    padding: '10px 14px',
    fontSize: '13px',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid #111827',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 700,
    transition: 'all 0.2s ease',
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
    transition: 'all 0.2s ease',
  },
  dangerButtonSmall: {
    padding: '8px 10px',
    fontSize: '12px',
    borderRadius: '10px',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#B91C1C',
    cursor: 'pointer',
    fontWeight: 700,
  },
  toast: {
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
  statsGrid: {
    display: 'grid',
    gap: '14px',
    marginBottom: '18px',
    width: '100%',
  },
  statCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
    minHeight: '110px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  statCardFullWidthMobile: {
    gridColumn: '1 / -1',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: '14px',
    marginBottom: '12px',
    fontWeight: 600,
  },
  statValue: {
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
    boxSizing: 'border-box',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
  },
  filterSelect: {
    width: '190px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #D7D7DB',
    background: '#FFFFFF',
    color: '#2F2F33',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
  },
  workerGrid: {
    display: 'grid',
    gap: '14px',
  },
  workerCard: {
    background: '#FAFAFA',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '16px',
  },
  workerTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  workerName: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '4px',
  },
  workerRole: {
    fontSize: '13px',
    color: '#6B7280',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  activePill: {
    background: '#DCFCE7',
    color: '#166534',
  },
  inactivePill: {
    background: '#F3F4F6',
    color: '#4B5563',
  },
  workerInfoBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '14px',
  },
  workerInfoLine: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
  workerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
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
    maxWidth: '100%',
    height: '100dvh',
    background: '#FFFFFF',
    borderLeft: '1px solid #D7D7DB',
    zIndex: 60,
    padding: 0,
    boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  drawerHeader: {
    background: '#FFFFFF',
    padding: '18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    borderBottom: '1px solid #EFEFF1',
    flex: '0 0 auto',
    zIndex: 10,
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
  drawerContent: {
    flex: '1 1 0%',
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    padding: '18px',
    paddingTop: '16px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 700,
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #D7D7DB',
    background: '#FFFFFF',
    color: '#2F2F33',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
  },
  drawerActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  drawerSection: {
    marginBottom: '16px',
  },
  drawerLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 700,
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  drawerValue: {
    fontSize: '14px',
    color: '#2F2F33',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  infoText: {
    color: '#6B7280',
    margin: 0,
  },
  errorText: {
    color: '#B91C1C',
    margin: 0,
    fontWeight: 600,
  },
}

