'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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

const WHATSAPP_NUMBER = '972500000000'

export default function QrPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [isMobile, setIsMobile] = useState(false)

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

  function buildWhatsappLink(project: ProjectRow) {
    const startCode = buildStartCode(project)
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(startCode)}`
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
    const ready = projects.filter((p) => Boolean(buildStartCode(p))).length

    return { total, active, inactive, ready }
  }, [projects])

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

            <nav style={styles.nav}>
              <Link href="/" style={styles.navItem}>Dashboard</Link>
              <Link href="/tickets" style={styles.navItem}>Tickets</Link>
              <Link href="/qr" style={{ ...styles.navItem, ...styles.navItemActive }}>QR Codes</Link>
              <Link href="/workers" style={styles.navItemDisabled}>Workers</Link>
            </nav>
          </aside>
        )}

        <section style={styles.content}>
          <div style={styles.topBar}>
            <div>
              <h1 style={styles.title}>QR Codes</h1>
              <p style={styles.subtitle}>
                Manage building QR access points and WhatsApp start links
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

          {copyMessage && (
            <div style={styles.copyToast}>{copyMessage}</div>
          )}

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
              Each project gets a dedicated start code and WhatsApp link. You can copy the code,
              open the WhatsApp link, or generate a printable QR from that link in your next step.
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
                const startCode = buildStartCode(project)
                const whatsappLink = buildWhatsappLink(project)

                return (
                  <div key={project.id} style={styles.projectCard}>
                    <div style={styles.projectCardTop}>
                      <div>
                        <div style={styles.projectCode}>{project.project_code}</div>
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
                      <span style={styles.metaCode}>{startCode}</span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaLabel}>WhatsApp Link</span>
                      <span style={styles.metaLink}>{whatsappLink}</span>
                    </div>

                    <div style={styles.qrPreviewBox}>
                      <div style={styles.qrPreviewInner}>
                        <div style={styles.qrPreviewTitle}>QR Preview</div>
                        <div style={styles.qrPreviewText}>
                          Use the WhatsApp link below to generate the final QR image.
                        </div>
                        <div style={styles.qrCodePlaceholder}>
                          {project.project_code}
                        </div>
                      </div>
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        onClick={() => copyText(startCode, 'START code copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy START Code
                      </button>

                      <button
                        onClick={() => copyText(whatsappLink, 'WhatsApp link copied')}
                        style={styles.secondaryButtonSmall}
                      >
                        Copy Link
                      </button>

                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.primaryActionButton}
                      >
                        Open WhatsApp
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
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navItem: {
    display: 'block',
    padding: '12px 14px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: '#374151',
    fontWeight: 700,
    background: '#FFFFFF',
    border: '1px solid transparent',
  },
  navItemActive: {
    background: '#FEF2F2',
    color: '#B91C1C',
    border: '1px solid #FECACA',
  },
  navItemDisabled: {
    display: 'block',
    padding: '12px 14px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: '#9CA3AF',
    fontWeight: 700,
    background: '#F9FAFB',
    border: '1px solid #F3F4F6',
    pointerEvents: 'none',
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
    flexWrap: 'wrap',
  },
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
    gap: '12px',
    marginBottom: '18px',
  },
  statCard: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6B7280',
    marginBottom: '10px',
    fontWeight: 600,
  },
  statValue: {
    fontSize: '28px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
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
  qrCodePlaceholder: {
    width: '140px',
    height: '140px',
    borderRadius: '18px',
    border: '2px dashed #D1D5DB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#B91C1C',
    fontWeight: 800,
    background: '#FFFFFF',
    letterSpacing: '0.04em',
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
