'use client'

import { type CSSProperties } from 'react'
import { Card, Button, theme } from '../ui'

interface ProjectRow {
  id: string
  name: string
  project_code: string
}

interface QrManagementSectionProps {
  projects: ProjectRow[]
  onCopyText: (value: string, label: string) => void
}

const WHATSAPP_NUMBER = '972559740732'

export function QrManagementSection({ projects, onCopyText }: QrManagementSectionProps) {
  function buildWhatsappLink(projectCode: string) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`START_${projectCode}`)}`
  }

  return (
    <Card
      title="QR Management"
      subtitle="Copy project links and generate QR codes"
      style={{ marginBottom: '20px' }}
    >
      <div style={styles.qrGrid}>
        {projects.map((project) => {
          const startCode = `START_${project.project_code}`
          const whatsappLink = buildWhatsappLink(project.project_code)

          return (
            <div key={project.id} style={styles.qrCard}>
              <div style={styles.qrCardHeader}>
                <span style={styles.qrCardCode}>{project.project_code}</span>
                <span style={styles.qrCardName}>{project.name}</span>
              </div>
              <div style={styles.qrCardMeta}>
                <div style={styles.qrMetaLabel}>Start Code</div>
                <div style={styles.qrMetaValue}>{startCode}</div>
              </div>
              <div style={styles.qrCardActions}>
                <Button variant="secondary" size="sm" onClick={() => onCopyText(startCode, 'Code copied')}>
                  Copy Code
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onCopyText(whatsappLink, 'Link copied')}>
                  Copy Link
                </Button>
                <a href={whatsappLink} target="_blank" rel="noreferrer" style={styles.qrOpenLink}>
                  Open
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

const styles: Record<string, CSSProperties> = {
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  qrCard: {
    padding: '16px',
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
  },
  qrCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  qrCardCode: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.primary,
  },
  qrCardName: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
  },
  qrCardMeta: {
    marginBottom: '12px',
  },
  qrMetaLabel: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  qrMetaValue: {
    fontSize: '13px',
    color: theme.colors.textPrimary,
    fontFamily: 'monospace',
  },
  qrCardActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  qrOpenLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: theme.radius.md,
    background: theme.colors.primary,
    color: theme.colors.textInverse,
    fontSize: '13px',
    fontWeight: 500,
    textDecoration: 'none',
  },
}
