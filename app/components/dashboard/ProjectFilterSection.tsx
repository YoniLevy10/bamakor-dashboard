'use client'

import { type CSSProperties } from 'react'
import { Card, Button, theme } from '../ui'

interface ProjectCount {
  id: string
  name: string
  project_code: string
  total: number
  open: number
  assigned: number
  closed: number
}

interface ProjectFilterSectionProps {
  projectCounts: ProjectCount[]
  selectedProjectCode: string
  onProjectSelect: (code: string) => void
}

export function ProjectFilterSection({
  projectCounts,
  selectedProjectCode,
  onProjectSelect,
}: ProjectFilterSectionProps) {
  return (
    <Card
      title="Projects"
      subtitle="Filter tickets by project"
      style={{ marginBottom: '20px' }}
    >
      <div style={styles.header}>
        <div style={styles.projectScroll}>
          {projectCounts.map((project) => (
            <button
              key={project.id}
              onClick={() =>
                onProjectSelect(selectedProjectCode === project.project_code ? 'ALL' : project.project_code)
              }
              style={{
                ...styles.projectChip,
                ...(selectedProjectCode === project.project_code ? styles.projectChipActive : {}),
              }}
              title={`Click to ${selectedProjectCode === project.project_code ? 'deselect' : 'filter by'} ${project.name}`}
            >
              <div style={styles.projectChipName}>{project.name}</div>
              <div style={styles.projectChipCode}>{project.project_code}</div>
              <div style={styles.projectChipCount}>
                {project.open > 0 && (
                  <span style={styles.projectChipOpenCount}>{project.open}</span>
                )}
                {project.total}
              </div>
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onProjectSelect('ALL')}
          title="Show all projects"
          style={{ flexShrink: 0 }}
        >
          Show All
        </Button>
      </div>
    </Card>
  )
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: 'flex',
    gap: '16px',
    alignItems: 'stretch',
  },
  projectScroll: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    WebkitOverflowScrolling: 'touch',
    flex: 1,
  },
  projectChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '14px 18px',
    borderRadius: theme.radius.lg,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    minWidth: '160px',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  projectChipActive: {
    borderColor: theme.colors.primary,
    background: theme.colors.primaryMuted,
    boxShadow: theme.shadows.md,
  },
  projectChipName: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    whiteSpace: 'nowrap',
  },
  projectChipCode: {
    fontSize: '12px',
    color: theme.colors.primary,
    fontWeight: 500,
  },
  projectChipCount: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  projectChipOpenCount: {
    color: theme.colors.warning,
    fontWeight: 600,
  },
}
