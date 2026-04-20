'use client'

import { type CSSProperties } from 'react'
import { KpiCard } from '../ui'

interface DashboardStatsProps {
  stats: {
    total: number
    open: number
    assigned: number
    closed: number
  }
  onKpiChange: (kpi: 'ALL' | 'NEW' | 'ASSIGNED' | 'CLOSED') => void
  isMobile: boolean
}

export function DashboardStats({ stats, onKpiChange, isMobile }: DashboardStatsProps) {
  return (
    <div
      style={{
        ...styles.kpiGrid,
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      }}
    >
      <KpiCard
        label="Total Tickets"
        value={stats.total}
        onClick={() => onKpiChange('ALL')}
      />
      <KpiCard
        label="Open"
        value={stats.open}
        onClick={() => onKpiChange('NEW')}
      />
      <KpiCard
        label="Assigned"
        value={stats.assigned}
        onClick={() => onKpiChange('ASSIGNED')}
      />
      <KpiCard
        label="Closed"
        value={stats.closed}
        onClick={() => onKpiChange('CLOSED')}
      />
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  kpiGrid: {
    display: 'grid',
    gap: '16px',
    marginBottom: '24px',
  },
}
