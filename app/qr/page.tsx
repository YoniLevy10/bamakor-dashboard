'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/error-handler'
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
  LoadingSpinner,
  theme
} from '../components/ui'

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
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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

  async function loadProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('id, client_id, name, project_code, address, qr_identifier, is_active, created_at')
      .order('project_code', { ascending: true })

    if (error) {
      toast.error(error.message || 'Failed to load projects')
      setProjects([])
    } else {
      setProjects((data as ProjectRow[]) || [])
    }
    setLoading(false)
  }

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
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildStartCode(project))}`
  }

  function buildReportLink(project: ProjectRow) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
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

  function openProjectDrawer(project: ProjectRow) {
    setSelectedProject(project)
    setIsDrawerOpen(true)
  }

  function closeProjectDrawer() {
    setIsDrawerOpen(false)
    setSelectedProject(null)
  }

  const stats = useMemo(() => {
    const total = projects.length
    const active = projects.filter((p) => p.is_active !== false).length
    const inactive = projects.filter((p) => p.is_active === false).length
    return { total, active, inactive }
  }, [projects])

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

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="QR Codes"
          subtitle={`${filteredProjects.length} projects`}
          onMenuClick={() => setMenuOpen(true)}
        />
      )}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader
            title="QR Codes"
            subtitle="Generate and manage WhatsApp QR codes for fast reporting"
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

        {/* Info Banner */}
        <div style={styles.infoBanner}>
          <div style={styles.infoBannerIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <div>
            <div style={styles.infoBannerTitle}>How it works</div>
            <div style={styles.infoBannerText}>
              Each QR code opens WhatsApp with the correct START code pre-filled. Print these QR codes and place them at each property for easy maintenance reporting.
            </div>
          </div>
        </div>

        {/* Search + Grid */}
        <Card noPadding>
          <div style={styles.filtersRow}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by project name, code, or address..."
              style={{ maxWidth: isMobile ? '100%' : '400px' }}
            />
          </div>

          {loading ? (
            <div style={styles.loadingContainer}>
              <LoadingSpinner />
            </div>
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              title="No projects found"
              description="Try a different search term or add projects first."
            />
          ) : (
            <div style={{
              ...styles.qrGrid,
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
            }}>
              {filteredProjects.map((project) => {
                const whatsappLink = buildWhatsAppLink(project)
                const startCode = buildStartCode(project)

                return (
                  <div
                    key={project.id}
                    style={styles.qrCard}
                    onClick={() => openProjectDrawer(project)}
                    data-ui="card"
                  >
                    <div style={styles.qrCardHeader}>
                      <div>
                        <div style={styles.projectName}>{project.name}</div>
                        <div style={styles.projectCode}>{project.project_code}</div>
                      </div>
                      <StatusBadge status={project.is_active === false ? 'INACTIVE' : 'ACTIVE'} size="sm" />
                    </div>

                    <div
                      ref={(el) => { qrRefs.current[project.project_code] = el }}
                      style={styles.qrContainer}
                    >
                      <QRCodeCanvas
                        value={whatsappLink}
                        size={140}
                        bgColor="#FFFFFF"
                        fgColor={theme.colors.textPrimary}
                        includeMargin
                        level="M"
                      />
                    </div>

                    <div style={styles.startCodeBox}>
                      <span style={styles.startCodeLabel}>Start Code</span>
                      <span style={styles.startCodeValue}>{startCode}</span>
                    </div>

                    <div style={styles.qrCardActions} onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyText(startCode, 'Code copied')}
                      >
                        Copy Code
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => downloadQr(project.project_code)}
                      >
                        Download
                      </Button>
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.whatsappButton}
                      >
                        Open WhatsApp
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Project Drawer */}
      <Drawer
        open={isDrawerOpen}
        onClose={closeProjectDrawer}
        title={selectedProject?.name || ''}
        subtitle={selectedProject?.project_code}
        isMobile={isMobile}
      >
        {selectedProject && (
          <div style={styles.drawerContent}>
            <div
              ref={(el) => { if (el) qrRefs.current[selectedProject.project_code] = el }}
              style={styles.drawerQrContainer}
            >
              <QRCodeCanvas
                value={buildWhatsAppLink(selectedProject)}
                size={isMobile ? 200 : 240}
                level="H"
                includeMargin
                bgColor="#FFFFFF"
                fgColor={theme.colors.textPrimary}
              />
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Start Code</span>
                <span style={styles.detailCode}>{buildStartCode(selectedProject)}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Address</span>
                <span style={styles.detailValue}>{selectedProject.address || '-'}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <StatusBadge status={selectedProject.is_active === false ? 'INACTIVE' : 'ACTIVE'} size="sm" />
              </div>
            </div>

            <div style={styles.actionButtons}>
              <Button
                variant="secondary"
                onClick={() => copyText(buildStartCode(selectedProject), 'START code copied')}
                style={{ flex: 1 }}
              >
                Copy START Code
              </Button>
              <Button
                variant="secondary"
                onClick={() => copyText(buildWhatsAppLink(selectedProject), 'WhatsApp link copied')}
                style={{ flex: 1 }}
              >
                Copy Link
              </Button>
            </div>

            <div style={styles.actionButtons}>
              <Button
                variant="secondary"
                onClick={() => copyText(buildReportLink(selectedProject), 'Report link copied')}
                style={{ flex: 1 }}
              >
                Copy Report Link
              </Button>
              <Button
                variant="secondary"
                onClick={() => downloadQr(selectedProject.project_code)}
                style={{ flex: 1 }}
              >
                Download QR
              </Button>
            </div>

            <div style={styles.primaryActions}>
              <a
                href={buildWhatsAppLink(selectedProject)}
                target="_blank"
                rel="noreferrer"
                style={styles.primaryButton}
              >
                Open WhatsApp
              </a>
              <a
                href={buildReportLink(selectedProject)}
                target="_blank"
                rel="noreferrer"
                style={styles.secondaryLink}
              >
                View Report Page
              </a>
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
  infoBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '20px',
    background: theme.colors.infoMuted,
    borderRadius: theme.radius.lg,
    marginBottom: '24px',
  },
  infoBannerIcon: {
    color: theme.colors.info,
    flexShrink: 0,
    marginTop: '2px',
  },
  infoBannerTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    marginBottom: '4px',
  },
  infoBannerText: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },
  filtersRow: {
    padding: '20px 24px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '64px 0',
  },
  qrGrid: {
    display: 'grid',
    gap: '20px',
    padding: '24px',
  },
  qrCard: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  qrCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    textAlign: 'left',
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
  qrContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
    background: theme.colors.muted,
    borderRadius: theme.radius.md,
    marginBottom: '16px',
  },
  startCodeBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: theme.colors.muted,
    borderRadius: theme.radius.sm,
    marginBottom: '16px',
  },
  startCodeLabel: {
    fontSize: '13px',
    color: theme.colors.textMuted,
  },
  startCodeValue: {
    fontSize: '14px',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  qrCardActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  whatsappButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 14px',
    borderRadius: theme.radius.md,
    background: '#25D366',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  drawerQrContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '24px',
    background: theme.colors.muted,
    borderRadius: theme.radius.lg,
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
    fontSize: '14px',
    fontFamily: 'monospace',
    fontWeight: 600,
    color: theme.colors.primary,
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
  },
  primaryActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '8px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '4px',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px 24px',
    borderRadius: theme.radius.md,
    background: '#25D366',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
  secondaryLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    borderRadius: theme.radius.md,
    background: theme.colors.muted,
    color: theme.colors.textSecondary,
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
}
