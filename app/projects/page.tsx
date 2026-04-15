'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'
import { validateRequired } from '@/lib/validators'
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

type ProjectRow = {
  id: string
  name: string
  project_code: string
  address: string | null
  qr_identifier: string | null
  is_active: boolean
  created_at: string
  client_id: string
}

type ClientRow = {
  id: string
}

type ProjectForm = {
  name: string
  project_code: string
  address: string
  qr_identifier: string
  is_active: boolean
}

type TicketRow = {
  id: string
  ticket_number: number
  status: string
  priority?: string | null
}

const emptyForm: ProjectForm = {
  name: '',
  project_code: '',
  address: '',
  qr_identifier: '',
  is_active: true,
}

const WHATSAPP_NUMBER = '972559740732'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null)
  const [form, setForm] = useState<ProjectForm>(emptyForm)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [projectTickets, setProjectTickets] = useState<TicketRow[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

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

  async function loadProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    setProjects((data as ProjectRow[]) || [])
  }

  async function initializePage() {
    setLoading(true)
    setError('')
    await asyncHandler(
      async () => {
        await loadClientId()
        await loadProjects()
        return true
      },
      {
        context: 'Failed to load projects',
        showErrorToast: true,
        onError: (err) => setError(err),
      }
    )
    setLoading(false)
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    initializePage()
  }, [])

  function openCreateDrawer() {
    setEditingProject(null)
    setForm(emptyForm)
    setDrawerOpen(true)
  }

  function openEditDrawer(project: ProjectRow) {
    setEditingProject(project)
    setForm({
      name: project.name || '',
      project_code: project.project_code || '',
      address: project.address || '',
      qr_identifier: project.qr_identifier || '',
      is_active: project.is_active,
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    if (saving) return
    setDrawerOpen(false)
    setEditingProject(null)
    setForm(emptyForm)
  }

  async function openDetailDrawer(project: ProjectRow) {
    setSelectedProject(project)
    setDetailDrawerOpen(true)
    await fetchProjectTickets(project.id)
  }

  function closeDetailDrawer() {
    setDetailDrawerOpen(false)
    setSelectedProject(null)
    setProjectTickets([])
  }

  async function fetchProjectTickets(projectId: string) {
    setLoadingTickets(true)
    await asyncHandler(
      async () => {
        const { data, error } = await supabase
          .from('tickets')
          .select('id, ticket_number, status, priority')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })

        if (error) throw error

        setProjectTickets((data as TicketRow[]) || [])
        return true
      },
      {
        context: 'Failed to load project tickets',
        showErrorToast: false,
      }
    )
    setLoadingTickets(false)
  }

  function navigateToProjectTickets(projectCode: string) {
    window.location.href = `/tickets?project=${encodeURIComponent(projectCode)}`
  }

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function validateForm() {
    const nameError = validateRequired(form.name, 'Project name')
    if (nameError) return nameError.message

    const codeError = validateRequired(form.project_code, 'Project code')
    if (codeError) return codeError.message

    if (!clientId) return 'Client ID not found'
    return ''
  }

  async function saveProject() {
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
          name: form.name.trim(),
          project_code: form.project_code.trim().toUpperCase(),
          address: form.address.trim() || null,
          qr_identifier: form.qr_identifier.trim() || null,
          is_active: form.is_active,
          client_id: editingProject?.client_id || clientId,
        }

        if (editingProject) {
          const { error } = await supabase
            .from('projects')
            .update(payload)
            .eq('id', editingProject.id)

          if (error) throw error
          toast.success('Project updated')
        } else {
          const { error } = await supabase
            .from('projects')
            .insert(payload)

          if (error) throw error
          toast.success('Project created')
        }

        await loadProjects()
        closeDrawer()
        return true
      },
      {
        context: 'Failed to save project',
        showErrorToast: true,
      }
    )

    setSaving(false)
  }

  async function toggleProjectStatus(project: ProjectRow) {
    await asyncHandler(
      async () => {
        const { error } = await supabase
          .from('projects')
          .update({ is_active: !project.is_active })
          .eq('id', project.id)

        if (error) throw error

        toast.success(project.is_active ? 'Project deactivated' : 'Project activated')
        await loadProjects()
        return true
      },
      {
        context: 'Failed to update project status',
        showErrorToast: true,
      }
    )
  }

  async function deleteProject(project: ProjectRow) {
    const confirmed = window.confirm(
      `Delete ${project.name}?\n\nThis is a hard delete. If this project is linked to tickets, deletion may fail or break relations.`
    )

    if (!confirmed) return

    await asyncHandler(
      async () => {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', project.id)

        if (error) throw error

        toast.success('Project deleted')
        await loadProjects()

        if (editingProject?.id === project.id) {
          closeDrawer()
        }
        return true
      },
      {
        context: 'Failed to delete project',
        showErrorToast: true,
      }
    )
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(label)
    } catch {
      toast.error('Copy failed')
    }
  }

  function getStartCode(project: ProjectRow) {
    return project.qr_identifier?.trim() || `START_${project.project_code}`
  }

  function getWhatsappLink(project: ProjectRow) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(getStartCode(project))}`
  }

  const stats = useMemo(() => {
    const total = projects.length
    const active = projects.filter((p) => p.is_active).length
    const inactive = projects.filter((p) => !p.is_active).length

    return { total, active, inactive }
  }, [projects])

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const q = searchTerm.trim().toLowerCase()

      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.project_code.toLowerCase().includes(q) ||
        (project.address || '').toLowerCase().includes(q) ||
        (project.qr_identifier || '').toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && project.is_active) ||
        (statusFilter === 'INACTIVE' && !project.is_active)

      return matchesSearch && matchesStatus
    })
  }, [projects, searchTerm, statusFilter])

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="Projects"
          subtitle={`${filteredProjects.length} projects`}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="Projects"
            subtitle="Manage projects, codes and QR source identifiers"
            actions={
              <>
                <Button variant="primary" onClick={openCreateDrawer}>
                  + New Project
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', color: '#64748B', fontSize: '18px', cursor: 'pointer', userSelect: 'none' }} title="Language Settings">
                  🌐
                </div>
              </>
            }
          />
        )}

        {/* KPI Cards */}
        <div style={{
          ...styles.kpiGrid,
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
        }}>
          <KpiCard label="Total Projects" value={stats.total} />
          <KpiCard label="Active" value={stats.active} />
          <KpiCard label="Inactive" value={stats.inactive} />
        </div>

        {/* Projects Card */}
        <Card
          title="Project List"
          subtitle="Edit project details, status and QR identifiers"
          noPadding
        >
          {/* Filters */}
          <div style={styles.filtersRow}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name, code, address..."
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
              <span>Loading projects...</span>
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

          {!loading && !error && filteredProjects.length === 0 && (
            <EmptyState
              title="No projects found"
              description="Try adjusting your filters or create a new project."
              action={
                <Button variant="primary" onClick={openCreateDrawer}>
                  Add Project
                </Button>
              }
            />
          )}

          {!loading && !error && filteredProjects.length > 0 && (
            <div style={styles.projectGrid}>
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => openDetailDrawer(project)}
                  style={styles.projectCard}
                >
                  <div style={styles.projectCardHeader}>
                    <div>
                      <div style={styles.projectName}>{project.name}</div>
                      <div style={styles.projectCode}>{project.project_code}</div>
                    </div>
                    <StatusBadge status={project.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                  </div>

                  <div style={styles.projectMeta}>
                    <div style={styles.projectMetaItem}>
                      <span style={styles.projectMetaLabel}>Address</span>
                      <span style={styles.projectMetaValue}>{project.address || '-'}</span>
                    </div>
                    <div style={styles.projectMetaItem}>
                      <span style={styles.projectMetaLabel}>Start Code</span>
                      <span style={styles.projectMetaCode}>{getStartCode(project)}</span>
                    </div>
                  </div>

                  <div style={styles.projectActions} onClick={(e) => e.stopPropagation()}>
                    <Button variant="secondary" size="sm" onClick={() => openEditDrawer(project)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => toggleProjectStatus(project)}>
                      {project.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => copyText(getStartCode(project), 'Code copied')}>
                      Copy Code
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
        title={editingProject ? 'Edit Project' : 'Add Project'}
        subtitle={editingProject ? 'Update project details' : 'Create a new project'}
        isMobile={isMobile}
      >
        <div style={styles.drawerContent}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Project Name *</label>
            <input
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Enter project name"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Project Code *</label>
            <input
              value={form.project_code}
              onChange={(e) => updateForm('project_code', e.target.value.toUpperCase())}
              placeholder="e.g. PRJ001"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Address</label>
            <input
              value={form.address}
              onChange={(e) => updateForm('address', e.target.value)}
              placeholder="Project location"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>QR Identifier</label>
            <input
              value={form.qr_identifier}
              onChange={(e) => updateForm('qr_identifier', e.target.value)}
              placeholder={`Default: START_${form.project_code || 'CODE'}`}
              style={styles.formInput}
            />
            <span style={styles.formHint}>Leave empty to use default START code</span>
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
            <Button variant="primary" onClick={saveProject} loading={saving}>
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </div>

          {editingProject && (
            <div style={styles.dangerZone}>
              <Button
                variant="danger"
                onClick={() => deleteProject(editingProject)}
                style={{ width: '100%' }}
              >
                Delete Project
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        open={detailDrawerOpen}
        onClose={closeDetailDrawer}
        title={selectedProject?.name || ''}
        subtitle={selectedProject?.project_code}
        isMobile={isMobile}
      >
        {selectedProject && (
          <div style={styles.drawerContent}>
            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Status</div>
              <StatusBadge status={selectedProject.is_active ? 'ACTIVE' : 'INACTIVE'} />
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Address</div>
              <div style={styles.detailValue}>{selectedProject.address || 'Not set'}</div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Start Code</div>
              <div style={styles.detailCodeBox}>
                <code style={styles.detailCode}>{getStartCode(selectedProject)}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(getStartCode(selectedProject), 'Code copied')}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>WhatsApp Link</div>
              <div style={styles.detailCodeBox}>
                <div style={styles.detailLinkText}>{getWhatsappLink(selectedProject)}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyText(getWhatsappLink(selectedProject), 'Link copied')}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Created</div>
              <div style={styles.detailValue}>
                {new Date(selectedProject.created_at).toLocaleString()}
              </div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailLabel}>Recent Tickets</div>
              {loadingTickets ? (
                <div style={styles.ticketLoading}>Loading...</div>
              ) : projectTickets.length === 0 ? (
                <div style={styles.noTickets}>No tickets for this project</div>
              ) : (
                <div style={styles.ticketList}>
                  {projectTickets.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} style={styles.ticketItem}>
                      <span style={styles.ticketNumber}>#{ticket.ticket_number}</span>
                      <StatusBadge status={ticket.status} size="sm" />
                    </div>
                  ))}
                  {projectTickets.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigateToProjectTickets(selectedProject.project_code)}
                    >
                      View all {projectTickets.length} tickets
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div style={styles.drawerActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  closeDetailDrawer()
                  openEditDrawer(selectedProject)
                }}
                style={{ flex: 1 }}
              >
                Edit Project
              </Button>
              <Button
                variant="primary"
                onClick={() => navigateToProjectTickets(selectedProject.project_code)}
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
            Add Project
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
  projectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
    padding: '20px',
  },
  projectCard: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  projectCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  projectName: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    marginBottom: '4px',
  },
  projectCode: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.primary,
  },
  projectMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  projectMetaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  projectMetaLabel: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  projectMetaValue: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
  },
  projectMetaCode: {
    fontSize: '13px',
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  projectActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
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
  formHint: {
    fontSize: '12px',
    color: theme.colors.textMuted,
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
  detailCodeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    background: theme.colors.surfaceActive,
    padding: '10px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
  },
  detailCode: {
    fontSize: '13px',
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  detailLinkText: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    wordBreak: 'break-all',
    flex: 1,
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
  ticketNumber: {
    fontSize: '13px',
    fontWeight: 500,
    color: theme.colors.textPrimary,
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
