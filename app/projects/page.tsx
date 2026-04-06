'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

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

const emptyForm: ProjectForm = {
  name: '',
  project_code: '',
  address: '',
  qr_identifier: '',
  is_active: true,
}

const WHATSAPP_NUMBER = '972559740732'

export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [isMobile, setIsMobile] = useState(false)
  const [highlightedProjectCode, setHighlightedProjectCode] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null)
  const [form, setForm] = useState<ProjectForm>(emptyForm)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const projectParam = searchParams.get('project')
    if (projectParam) {
      setHighlightedProjectCode(projectParam)
      setSearchTerm('')
      setStatusFilter('ALL')
    }
  }, [searchParams])

  useEffect(() => {
    initializePage()
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => setSuccessMessage(''), 1800)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  async function initializePage() {
    setLoading(true)
    setError('')
    try {
      await loadClientId()
      await loadProjects()
    } catch (err: any) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

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

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function validateForm() {
    if (!form.name.trim()) return 'Project name is required'
    if (!form.project_code.trim()) return 'Project code is required'
    if (!clientId) return 'Client ID not found'
    return ''
  }

  async function saveProject() {
    const validationError = validateForm()
    if (validationError) {
      alert(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
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
        setSuccessMessage('Project updated')
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(payload)

        if (error) throw error
        setSuccessMessage('Project created')
      }

      await loadProjects()
      closeDrawer()
    } catch (err: any) {
      setError(err.message || 'Failed to save project')
      alert(err.message || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  async function toggleProjectStatus(project: ProjectRow) {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: !project.is_active })
        .eq('id', project.id)

      if (error) throw error

      setSuccessMessage(project.is_active ? 'Project deactivated' : 'Project activated')
      await loadProjects()
    } catch (err: any) {
      alert(err.message || 'Failed to update project status')
    }
  }

  async function deleteProject(project: ProjectRow) {
    const confirmed = window.confirm(
      `Delete ${project.name}?\n\nThis is a hard delete. If this project is linked to tickets, deletion may fail or break relations.`
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id)

      if (error) throw error

      setSuccessMessage('Project deleted')
      await loadProjects()

      if (editingProject?.id === project.id) {
        closeDrawer()
      }
    } catch (err: any) {
      alert(
        err.message ||
          'Failed to delete project. If this project is linked to tickets, deactivate it instead.'
      )
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setSuccessMessage(label)
    } catch {
      alert('Copy failed')
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
              <a href="/" style={styles.sidebarNavLink}>Dashboard</a>
              <a href="/tickets" style={styles.sidebarNavLink}>Tickets</a>
              <a href="/projects" style={{ ...styles.sidebarNavLink, ...styles.sidebarNavItemActive }}>Projects</a>
              <a href="/workers" style={styles.sidebarNavLink}>Workers</a>
              <a href="/qr" style={styles.sidebarNavLink}>QR Codes</a>
              <a href="/summary" style={styles.sidebarNavLink}>Summary</a>
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
                    Projects
                  </h1>
                  <p
                    style={{
                      ...styles.subtitle,
                      ...(isMobile ? styles.subtitleMobile : {}),
                    }}
                  >
                    Manage projects, codes and QR source identifiers
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.topActions}>
              <button onClick={initializePage} style={styles.secondaryButton}>
                Refresh
              </button>
              <button onClick={openCreateDrawer} style={styles.primaryButton}>
                Add Project
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
              <div style={styles.statLabel}>Total Projects</div>
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
                <div style={styles.cardTitle}>Project List</div>
                <div style={styles.cardSubtitle}>
                  Edit project details, status and QR identifiers
                </div>
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
                placeholder="Search by name, code, address or QR identifier..."
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

            {loading && <p style={styles.infoText}>Loading projects...</p>}
            {error && <p style={styles.errorText}>{error}</p>}

            {!loading && !error && filteredProjects.length === 0 && (
              <p style={styles.infoText}>No projects found.</p>
            )}

            {!loading && !error && filteredProjects.length > 0 && (
              <div
                style={{
                  ...styles.projectGrid,
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : 'repeat(auto-fit, minmax(340px, 1fr))',
                }}
              >
                {filteredProjects.map((project) => (
                  <div 
                    key={project.id} 
                    style={{
                      ...styles.projectCard,
                      ...(highlightedProjectCode === project.project_code ? {
                        borderColor: '#C1121F',
                        borderWidth: '2px',
                        boxShadow: '0 0 0 3px rgba(193, 18, 31, 0.1), 0 10px 30px rgba(0,0,0,0.04)',
                      } : {}),
                    }}
                  >
                    <div style={styles.projectTopRow}>
                      <div>
                        <div style={styles.projectName}>{project.name}</div>
                        <div 
                          style={styles.projectCode}
                          onClick={() => setHighlightedProjectCode(highlightedProjectCode === project.project_code ? null : project.project_code)}
                          title="Click to highlight project"
                        >
                          {project.project_code}
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusPill,
                          ...(project.is_active ? styles.activePill : styles.inactivePill),
                        }}
                      >
                        {project.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div style={styles.projectInfoBlock}>
                      <div style={styles.projectInfoLine}>📍 {project.address || '-'}</div>
                      <div style={styles.projectInfoLine}>🔑 {getStartCode(project)}</div>
                      <div style={styles.projectInfoLine}>
                        🕒 {new Date(project.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={styles.projectLinkBlock}>
                      <div style={styles.smallLabel}>WhatsApp Link</div>
                      <div style={styles.linkPreview}>{getWhatsappLink(project)}</div>
                    </div>

                    <div style={styles.projectActions}>
                      <button
                        onClick={() => openEditDrawer(project)}
                        style={styles.secondaryButtonSmall}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => toggleProjectStatus(project)}
                        style={styles.secondaryButtonSmall}
                      >
                        {project.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => copyText(getStartCode(project), 'Start code copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy Code
                      </button>

                      <button
                        onClick={() => copyText(getWhatsappLink(project), 'WhatsApp link copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy Link
                      </button>

                      <button
                        onClick={() => deleteProject(project)}
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
                  {editingProject ? 'Edit Project' : 'Add Project'}
                </div>
                <div style={styles.drawerSubtitle}>
                  {editingProject
                    ? 'Update project details and QR data'
                    : 'Create a new project for this client'}
                </div>
              </div>

              <button onClick={closeDrawer} style={styles.drawerCloseButton}>
                ✕
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Project Name</label>
              <input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                style={styles.input}
                placeholder="Enter project name"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Project Code</label>
              <input
                value={form.project_code}
                onChange={(e) => updateForm('project_code', e.target.value)}
                style={styles.input}
                placeholder="BMK1 / BMK2 ..."
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Address</label>
              <input
                value={form.address}
                onChange={(e) => updateForm('address', e.target.value)}
                style={styles.input}
                placeholder="Enter project address"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>QR Identifier</label>
              <input
                value={form.qr_identifier}
                onChange={(e) => updateForm('qr_identifier', e.target.value)}
                style={styles.input}
                placeholder="Optional custom code. If empty → START_PROJECTCODE"
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
              <button onClick={saveProject} style={styles.primaryButton}>
                {saving ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    maxWidth: '100%',
    overflowX: 'hidden',
    background: '#F4F4F5',
    color: '#2F2F33',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
  },
  appShell: {
    display: 'grid',
    width: '100%',
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
  },
  mainAreaMobile: {
    padding: '18px 14px',
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
    fontSize: '40px',
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
  projectGrid: {
    display: 'grid',
    gap: '14px',
  },
  projectCard: {
    background: '#FAFAFA',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '16px',
  },
  projectTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  projectName: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '4px',
  },
  projectCode: {
    fontSize: '13px',
    color: '#C1121F',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
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
  projectInfoBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '14px',
  },
  projectInfoLine: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
  projectLinkBlock: {
    marginBottom: '14px',
    padding: '12px',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
  },
  smallLabel: {
    fontSize: '11px',
    color: '#6B7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  linkPreview: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
  projectActions: {
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
    height: '100vh',
    background: '#FFFFFF',
    borderLeft: '1px solid #D7D7DB',
    zIndex: 60,
    padding: '18px',
    overflowY: 'auto',
    boxShadow: '-10px 0 30px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
  },
  drawerHeader: {
    position: 'sticky',
    top: 0,
    background: '#FFFFFF',
    paddingTop: '4px',
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

