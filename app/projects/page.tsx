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
  Select,
  Drawer,
  EmptyState,
  LoadingSpinner,
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

type ClientRow = { id: string }

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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    initializePage()
  }, [])

  async function loadClientId() {
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) throw error
    const firstClient = (data as ClientRow[] | null)?.[0]
    if (!firstClient?.id) throw new Error('No client found')
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
    await asyncHandler(
      async () => {
        await loadClientId()
        await loadProjects()
        return true
      },
      { context: 'Failed to load projects', showErrorToast: true }
    )
    setLoading(false)
  }

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
      { context: 'Failed to load project tickets', showErrorToast: false }
    )
    setLoadingTickets(false)
  }

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
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
          const { error } = await supabase.from('projects').insert(payload)
          if (error) throw error
          toast.success('Project created')
        }

        await loadProjects()
        closeDrawer()
        return true
      },
      { context: 'Failed to save project', showErrorToast: true }
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
      { context: 'Failed to update project status', showErrorToast: true }
    )
  }

  async function deleteProject(project: ProjectRow) {
    const confirmed = window.confirm(`Delete ${project.name}? This action cannot be undone.`)
    if (!confirmed) return

    await asyncHandler(
      async () => {
        const { error } = await supabase.from('projects').delete().eq('id', project.id)
        if (error) throw error
        toast.success('Project deleted')
        await loadProjects()
        if (editingProject?.id === project.id) closeDrawer()
        return true
      },
      { context: 'Failed to delete project', showErrorToast: true }
    )
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
      const matchesSearch = !q ||
        project.name.toLowerCase().includes(q) ||
        project.project_code.toLowerCase().includes(q) ||
        (project.address || '').toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'ALL' ||
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
            subtitle="Manage your properties and locations"
            actions={
              <Button variant="primary" onClick={openCreateDrawer}>
                New Project
              </Button>
            }
          />
        )}

        {/* KPI Cards */}
        <div style={{
          ...styles.kpiGrid,
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
        }}>
          <KpiCard label="Total Projects" value={stats.total} accent="primary" />
          <KpiCard label="Active" value={stats.active} accent="success" />
          <KpiCard label="Inactive" value={stats.inactive} />
        </div>

        {/* Filters + Grid */}
        <Card noPadding>
          <div style={{
            ...styles.filtersRow,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search projects..."
              style={{ flex: 1, maxWidth: isMobile ? '100%' : '320px' }}
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              options={[
                { label: 'All Status', value: 'ALL' },
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Inactive', value: 'INACTIVE' },
              ]}
              style={{ minWidth: '140px' }}
            />
          </div>

          {loading ? (
            <div style={styles.loadingContainer}>
              <LoadingSpinner />
            </div>
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              title="No projects found"
              description="Try adjusting your filters or create a new project."
              action={
                <Button variant="primary" onClick={openCreateDrawer}>
                  Add Project
                </Button>
              }
            />
          ) : (
            <div style={{
              ...styles.projectGrid,
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
            }}>
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => openDetailDrawer(project)}
                  style={styles.projectCard}
                  data-ui="card"
                >
                  <div style={styles.projectHeader}>
                    <div>
                      <div style={styles.projectName}>{project.name}</div>
                      <div style={styles.projectCode}>{project.project_code}</div>
                    </div>
                    <StatusBadge status={project.is_active ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                  </div>

                  <div style={styles.projectMeta}>
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Address</span>
                      <span style={styles.metaValue}>{project.address || '-'}</span>
                    </div>
                    <div style={styles.metaItem}>
                      <span style={styles.metaLabel}>Start Code</span>
                      <span style={styles.metaCode}>
                        {project.qr_identifier || `START_${project.project_code}`}
                      </span>
                    </div>
                  </div>

                  <div style={styles.projectActions} onClick={(e) => e.stopPropagation()}>
                    <Button variant="secondary" size="sm" onClick={() => openEditDrawer(project)}>
                      Edit
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => toggleProjectStatus(project)}>
                      {project.is_active ? 'Deactivate' : 'Activate'}
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
        title={editingProject ? 'Edit Project' : 'New Project'}
        subtitle={editingProject ? 'Update project details' : 'Create a new property'}
        isMobile={isMobile}
      >
        <div style={styles.drawerContent}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Project Name *</label>
            <input
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Enter project name"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Project Code *</label>
            <input
              value={form.project_code}
              onChange={(e) => updateForm('project_code', e.target.value.toUpperCase())}
              placeholder="e.g. PRJ001"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Address</label>
            <input
              value={form.address}
              onChange={(e) => updateForm('address', e.target.value)}
              placeholder="Project location"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>QR Identifier</label>
            <input
              value={form.qr_identifier}
              onChange={(e) => updateForm('qr_identifier', e.target.value)}
              placeholder={`Default: START_${form.project_code || 'CODE'}`}
              style={styles.input}
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
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <StatusBadge status={selectedProject.is_active ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Address</span>
                <span style={styles.detailValue}>{selectedProject.address || '-'}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Start Code</span>
                <span style={styles.detailCode}>
                  {selectedProject.qr_identifier || `START_${selectedProject.project_code}`}
                </span>
              </div>
            </div>

            <div style={styles.ticketsSection}>
              <div style={styles.ticketsSectionHeader}>
                <h4 style={styles.ticketsSectionTitle}>Recent Tickets</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.href = `/tickets?project=${encodeURIComponent(selectedProject.project_code)}`}
                >
                  View All
                </Button>
              </div>

              {loadingTickets ? (
                <div style={styles.loadingSmall}>
                  <LoadingSpinner size="sm" />
                </div>
              ) : projectTickets.length === 0 ? (
                <p style={styles.emptyText}>No tickets for this project</p>
              ) : (
                <div style={styles.ticketList}>
                  {projectTickets.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} style={styles.ticketItem}>
                      <span style={styles.ticketNumber}>#{ticket.ticket_number}</span>
                      <StatusBadge status={ticket.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.drawerActions}>
              <Button variant="secondary" onClick={() => openEditDrawer(selectedProject)}>
                Edit Project
              </Button>
              <Button
                variant="primary"
                onClick={() => window.location.href = `/qr?project=${encodeURIComponent(selectedProject.project_code)}`}
              >
                View QR Code
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </AppShell>
  )
}

const styles: Record<string, CSSProperties> = {
  content: {
    padding: '32px 40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  kpiGrid: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px',
  },
  filtersRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '64px 0',
  },
  projectGrid: {
    display: 'grid',
    gap: '20px',
    padding: '24px',
  },
  projectCard: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  projectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  projectName: {
    fontSize: '17px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  projectCode: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  projectMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  metaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: '13px',
    color: theme.colors.textMuted,
  },
  metaValue: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
  },
  metaCode: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: theme.colors.textSecondary,
    background: theme.colors.muted,
    padding: '4px 8px',
    borderRadius: theme.radius.sm,
  },
  projectActions: {
    display: 'flex',
    gap: '8px',
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textSecondary,
  },
  input: {
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '15px',
    color: theme.colors.textPrimary,
  },
  formHint: {
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
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
    gap: '12px',
    justifyContent: 'flex-end',
    paddingTop: '16px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '8px',
  },
  dangerZone: {
    paddingTop: '20px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '12px',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px',
    background: theme.colors.muted,
    borderRadius: theme.radius.md,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: '13px',
    color: theme.colors.textMuted,
  },
  detailValue: {
    fontSize: '14px',
    color: theme.colors.textPrimary,
  },
  detailCode: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: theme.colors.primary,
  },
  ticketsSection: {
    marginTop: '8px',
  },
  ticketsSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  ticketsSectionTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  loadingSmall: {
    display: 'flex',
    justifyContent: 'center',
    padding: '24px 0',
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: '14px',
    padding: '24px 0',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  ticketItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: theme.colors.muted,
    borderRadius: theme.radius.sm,
  },
  ticketNumber: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textPrimary,
  },
}
