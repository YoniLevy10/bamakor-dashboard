'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/error-handler'
import { Button, SearchInput, theme } from '../components/ui'

type ProjectRow = {
  id: string
  client_id: string
  name: string
  project_code: string
  address?: string | null
  qr_identifier?: string | null
  is_active?: boolean | null
  created_at?: string
}

const WHATSAPP_NUMBER = '972559740732'

export default function QrPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [isMobile, setIsMobile] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const qrRefs = useRef<Record<string, HTMLDivElement | null>>({})

  async function loadProjects() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('projects')
      .select('id, client_id, name, project_code, address, qr_identifier, is_active, created_at')
      .order('project_code', { ascending: true })

    if (error) {
      setError(error.message || 'Failed to load projects')
      setProjects([])
      setLoading(false)
      return
    }

    setProjects((data as ProjectRow[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadProjects()
  }, [])



  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(label)
    } catch {
      toast.error('Copy failed')
    }
  }

  function buildStartCode(project: ProjectRow) {
    return project.qr_identifier || `START_${project.project_code}`
  }

  function buildWhatsAppLink(project: ProjectRow) {
    const startCode = buildStartCode(project)
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(startCode)}`
  }

  function buildReportLink(project: ProjectRow) {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '')

    return `${baseUrl}/report?project=${encodeURIComponent(project.project_code)}`
  }

  function downloadQr(projectCode: string) {
    const container = qrRefs.current[projectCode]
    if (!container) return

    const canvas = container.querySelector('canvas')
    if (!canvas) return

    const pngUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = pngUrl
    link.download = `${projectCode}-whatsapp-qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const q = searchTerm.trim().toLowerCase()
      if (!q) return true

      return (
        project.name?.toLowerCase().includes(q) ||
        project.project_code?.toLowerCase().includes(q) ||
        project.address?.toLowerCase().includes(q) ||
        project.qr_identifier?.toLowerCase().includes(q)
      )
    })
  }, [projects, searchTerm])

  const stats = useMemo(() => {
    const total = projects.length
    const active = projects.filter((p) => p.is_active !== false).length
    const inactive = projects.filter((p) => p.is_active === false).length
    const ready = projects.filter((p) => Boolean(buildWhatsAppLink(p))).length

    return { total, active, inactive, ready }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects])

  function navigateToProject(projectCode: string) {
    router.push(`/projects?project=${encodeURIComponent(projectCode)}`)
  }

  function openProjectDrawer(project: ProjectRow) {
    setSelectedProject(project)
    setIsDrawerOpen(true)
  }

  function closeProjectDrawer() {
    setIsDrawerOpen(false)
    setSelectedProject(null)
  }

  return (
    <main style={styles.page}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
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
                <div style={styles.sidebarSubtitle}>Maintenance SaaS</div>
              </div>
            </div>

            <nav style={styles.sidebarNav}>
              <Link href="/" style={styles.sidebarNavLink}>
                Dashboard
              </Link>

              <Link href="/tickets" style={styles.sidebarNavLink}>
                Tickets
              </Link>

              <Link href="/projects" style={styles.sidebarNavLink}>
                Projects
              </Link>

              <Link href="/workers" style={styles.sidebarNavLink}>
                Workers
              </Link>

              <Link href="/qr" style={{ ...styles.sidebarNavLink, ...styles.sidebarNavItemActive }}>
                QR Codes
              </Link>

              <Link href="/summary" style={styles.sidebarNavLink}>
                Summary
              </Link>
            </nav>

            <div style={styles.sidebarFooter}>All rights reserved to Yoni Levy</div>
          </aside>
        )}

        <section style={styles.content}>
          <div style={styles.topBar}>
            <div style={styles.mobileTopRow}>
              <div>
                <h1 style={styles.title}>QR Codes</h1>
                <p style={styles.subtitle}>
                  WhatsApp QR for fast reporting, plus a direct web form link for structured reporting
                </p>
              </div>
            </div>

            <div style={styles.topActions}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', color: '#64748B', fontSize: '18px', cursor: 'pointer', userSelect: 'none' }} title="Language Settings">
                🌐
              </div>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Total Projects</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Active</div>
              <div style={styles.statValue}>{stats.active}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Inactive</div>
              <div style={styles.statValue}>{stats.inactive}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>QR Ready</div>
              <div style={styles.statValue}>{stats.ready}</div>
            </div>
          </div>

          <div style={styles.infoBanner}>
            <div style={styles.infoBannerTitle}>How it works</div>
            <div style={styles.infoBannerText}>
              The main QR opens WhatsApp with the correct START code. Each project also has a direct
              web form link for cases where a structured report page is preferred.
            </div>
          </div>

          <div
            style={{
              ...styles.filtersRow,
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by project name, code, address or QR identifier..."
              style={styles.searchInput}
            />
          </div>

          {loading && <p style={styles.infoText}>Loading projects...</p>}
          {error && <p style={styles.errorText}>{error}</p>}

          {!loading && !error && filteredProjects.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyStateTitle}>No projects found</div>
              <div style={styles.emptyStateText}>
                Try a different search, or add projects in Supabase.
              </div>
            </div>
          )}

          {!loading && !error && filteredProjects.length > 0 && (
            <div style={styles.cardsGrid}>
              {filteredProjects.map((project) => {
                const qrIdentifier = buildStartCode(project)
                const whatsappLink = buildWhatsAppLink(project)
                const reportLink = buildReportLink(project)

                return (
                  <div key={project.id} style={{ ...styles.projectCard, cursor: 'pointer' }} onClick={() => openProjectDrawer(project)}>
                    <div style={styles.projectCardTop}>
                      <div>
                        <div 
                          style={styles.projectCode}
                          onClick={() => navigateToProject(project.project_code)}
                          title="Click to view project"
                        >
                          {project.project_code}
                        </div>
                        <div style={styles.projectName}>{project.name}</div>
                      </div>

                      <span
                        style={{
                          ...styles.activeBadge,
                          ...(project.is_active === false
                            ? styles.inactiveBadge
                            : styles.activeBadgeLive),
                        }}
                      >
                        {project.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Address</span>
                      <span style={styles.metaValue}>{project.address || '-'}</span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Start Code</span>
                      <span 
                        style={styles.metaCode}
                        onClick={() => copyText(qrIdentifier, 'START code copied')}
                        title="Click to copy"
                      >
                        {qrIdentifier}
                      </span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>WhatsApp Link</span>
                      <span style={styles.metaLink}>{whatsappLink}</span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>Report Form</span>
                      <span style={styles.metaLink}>{reportLink}</span>
                    </div>

                    <div style={styles.qrPreviewBox}>
                      <div style={styles.qrPreviewInner}>
                        <div style={styles.qrPreviewTitle}>WhatsApp QR</div>
                        <div style={styles.qrPreviewText}>
                          Scan to open WhatsApp with the correct START code for {project.project_code}.
                        </div>

                        <div
                          ref={(el) => {
                            qrRefs.current[project.project_code] = el
                          }}
                          style={styles.qrCanvasWrap}
                        >
                          <QRCodeCanvas
                            value={whatsappLink}
                            size={140}
                            bgColor="#FFFFFF"
                            fgColor="#111827"
                            includeMargin
                          />
                        </div>
                      </div>
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        onClick={() => copyText(qrIdentifier, 'START code copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy START Code
                      </button>

                      <button
                        onClick={() => copyText(whatsappLink, 'WhatsApp link copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy WhatsApp Link
                      </button>

                      <button
                        onClick={() => copyText(reportLink, 'Report form link copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy Report Link
                      </button>

                      <button
                        onClick={() => downloadQr(project.project_code)}
                        style={styles.secondaryButtonSmall}
                      >
                        Download QR
                      </button>

                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.primaryActionButton}
                      >
                        Open WhatsApp
                      </a>

                      <a
                        href={reportLink}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.secondaryLinkActionButton}
                      >
                        Open Report Form
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {isDrawerOpen && selectedProject && (
        <>
          <div
            style={styles.drawerOverlay}
            onClick={closeProjectDrawer}
            aria-label="Close drawer"
          />
          <div
            style={{
              ...styles.drawerPanel,
              width: isMobile ? '100%' : '460px',
            }}
          >
            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerTitle}>{selectedProject.name}</div>
                <div style={styles.drawerSubtitle}>{selectedProject.project_code}</div>
              </div>
              <button
                onClick={closeProjectDrawer}
                style={styles.closeButton}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={styles.drawerContent}>
              <div style={styles.qrPreviewSection}>
                <div
                  ref={(el) => {
                    if (el) qrRefs.current[selectedProject.project_code] = el
                  }}
                  style={styles.qrContainer}
                >
                  <QRCodeCanvas
                    value={buildWhatsAppLink(selectedProject)}
                    size={isMobile ? 160 : 200}
                    level="H"
                    includeMargin
                  />
                </div>
              </div>

              <div style={styles.drawerActionButtons}>
                <button
                  onClick={() => copyText(buildStartCode(selectedProject), 'START code copied!')}
                  style={styles.actionButton}
                >
                  Copy START Code
                </button>
                <button
                  onClick={() =>
                    copyText(buildWhatsAppLink(selectedProject), 'WhatsApp link copied!')
                  }
                  style={styles.actionButton}
                >
                  Copy WhatsApp Link
                </button>
                <button
                  onClick={() => copyText(buildReportLink(selectedProject), 'Report link copied!')}
                  style={styles.actionButton}
                >
                  Copy Report Link
                </button>
                <button
                  onClick={() => downloadQr(selectedProject.project_code)}
                  style={styles.actionButton}
                >
                  Download QR
                </button>
                <a
                  href={`/report?project=${encodeURIComponent(selectedProject.project_code)}`}
                  style={styles.actionButtonLink}
                >
                  Open Report Page
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    height: '100dvh',
    width: '100%',
    background: '#F4F4F5',
    color: '#2F2F33',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    overflow: 'hidden',
  },
  shell: {
    display: 'grid',
    minHeight: '100dvh',
    height: '100dvh',
    overflow: 'hidden',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    padding: '24px 16px',
    position: 'sticky',
    top: 0,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
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
    color: '#FFFFFF',
    fontWeight: 800,
    fontSize: '18px',
    boxShadow: '0 8px 20px rgba(193, 18, 31, 0.22)',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#2F2F33',
  },
  sidebarSubtitle: {
    fontSize: '12px',
    color: '#6B7280',
  },
  sidebarFooter: {
    marginTop: 'auto',
    fontSize: '13px',
    color: '#6B7280',
    padding: '12px 14px',
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
  content: {
    padding: '28px',
    paddingTop: 'calc(28px + env(safe-area-inset-top))',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    height: '100%',
    boxSizing: 'border-box',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',    rowGap: '16px',  },
  title: {
    margin: 0,
    fontSize: '30px',
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1,
  },
  subtitle: {
    margin: '8px 0 0 0',
    fontSize: '14px',
    color: '#6B7280',
  },
  topActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  secondaryButton: {
    background: theme.colors.surface,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'none',
  },
  primaryLinkButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: '1px solid #111827',
    borderRadius: '12px',
    padding: '10px 14px',
    textDecoration: 'none',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px',
    marginBottom: '18px',
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
  infoBanner: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '18px',
    marginBottom: '18px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  infoBannerTitle: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '6px',
  },
  infoBannerText: {
    fontSize: '14px',
    color: '#4B5563',
    lineHeight: 1.5,
  },
  filtersRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '18px',
  },
  searchInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    background: '#FFFFFF',
    color: '#111827',
    border: '1px solid #D1D5DB',
    outline: 'none',
    fontSize: '14px',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '16px',
  },
  projectCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '22px',
    padding: '18px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
  },
  projectCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px',
  },
  projectCode: {
    fontSize: '12px',
    color: '#B91C1C',
    fontWeight: 800,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  projectName: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#111827',
    lineHeight: 1.2,
  },
  activeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  activeBadgeLive: {
    background: '#DCFCE7',
    color: '#166534',
  },
  inactiveBadge: {
    background: '#F3F4F6',
    color: '#4B5563',
  },
  metaRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '10px',
    alignItems: 'start',
    marginBottom: '10px',
  },
  metaLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  metaValue: {
    fontSize: '14px',
    color: '#111827',
    wordBreak: 'break-word',
  },
  metaCode: {
    fontSize: '14px',
    color: '#B91C1C',
    fontWeight: 800,
    wordBreak: 'break-word',
    cursor: 'pointer',
    borderBottom: '2px dotted #B91C1C',
    padding: '0 2px',
    transition: 'all 0.2s ease',
  },
  metaLink: {
    fontSize: '13px',
    color: '#4B5563',
    lineHeight: 1.45,
    wordBreak: 'break-word',
  },
  qrPreviewBox: {
    marginTop: '16px',
    marginBottom: '16px',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    padding: '16px',
  },
  qrPreviewInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center',
    textAlign: 'center',
  },
  qrPreviewTitle: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#111827',
  },
  qrPreviewText: {
    fontSize: '13px',
    color: '#6B7280',
    lineHeight: 1.45,
    maxWidth: '280px',
  },
  qrCanvasWrap: {
    background: '#FFFFFF',
    borderRadius: '18px',
    padding: '12px',
    border: '1px solid #E5E7EB',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  secondaryButtonSmall: {
    background: theme.colors.surface,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '13px',
  },
  primaryActionButton: {
    background: '#B91C1C',
    color: '#FFFFFF',
    border: '1px solid #B91C1C',
    borderRadius: '10px',
    padding: '10px 12px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  secondaryLinkActionButton: {
    background: '#FFFFFF',
    color: '#111827',
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    padding: '10px 12px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '13px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  emptyState: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
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
    lineHeight: 1.5,
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
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 998,
    animation: 'fadeIn 0.2s ease',
  },
  drawerPanel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: '460px',
    background: '#FFFFFF',
    boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.1)',
    zIndex: 999,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.3s ease',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px',
    borderBottom: '1px solid #E5E7EB',
    gap: '16px',
  },
  drawerTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#111827',
    margin: 0,
    marginBottom: '4px',
  },
  drawerSubtitle: {
    fontSize: '13px',
    color: '#6B7280',
    margin: 0,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    color: '#6B7280',
    cursor: 'pointer',
    padding: '4px 8px',
    marginTop: '-2px',
    transition: 'color 0.2s ease',
  },
  drawerContent: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 24px',
  },
  qrPreviewSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #E5E7EB',
  },
  qrContainer: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '16px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerActionButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  actionButton: {
    background: '#B91C1C',
    color: '#FFFFFF',
    border: '1px solid #B91C1C',
    borderRadius: '10px',
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    minHeight: '44px',
    transition: 'all 0.2s ease',
  },
  actionButtonLink: {
    background: '#B91C1C',
    color: '#FFFFFF',
    border: '1px solid #B91C1C',
    borderRadius: '10px',
    padding: '12px 16px',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '14px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  mobileTopRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
}