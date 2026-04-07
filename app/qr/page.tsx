'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'

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
  const [copyMessage, setCopyMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const qrRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (!copyMessage) return
    const timer = window.setTimeout(() => setCopyMessage(''), 1800)
    return () => window.clearTimeout(timer)
  }, [copyMessage])

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

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyMessage(label)
    } catch {
      alert('Copy failed')
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
  }, [projects])

  function navigateToProject(projectCode: string) {
    router.push(`/projects?project=${encodeURIComponent(projectCode)}`)
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
            <div>
              <h1 style={styles.title}>QR Codes</h1>
              <p style={styles.subtitle}>
                WhatsApp QR for fast reporting, plus a direct web form link for structured reporting
              </p>
            </div>

            <div style={styles.topActions}>
              <button onClick={loadProjects} style={styles.secondaryButton}>
                Refresh
              </button>
              <Link href="/" style={styles.primaryLinkButton}>
                Back to Dashboard
              </Link>
            </div>
          </div>

          {copyMessage && <div style={styles.copyToast}>{copyMessage}</div>}

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
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                  <div key={project.id} style={styles.projectCard}>
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
  shell: {
    display: 'grid',
    minHeight: '100vh',
  },
  sidebar: {
    background: '#FFFFFF',
    borderRight: '1px solid #E5E7EB',
    padding: '20px 16px',
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
    background: '#FFFFFF',
    color: '#111827',
    border: '1px solid #D1D5DB',
    borderRadius: '12px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 700,
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
  copyToast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#111827',
    color: '#FFFFFF',
    padding: '10px 14px',
    borderRadius: '999px',
    zIndex: 100,
    fontSize: '13px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
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
    background: '#FFFFFF',
    color: '#111827',
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 700,
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
}