'use client'

import { type CSSProperties } from 'react'
import { KpiCard, theme } from '../ui'

interface DashboardStatsProps {
  stats: {
    total: number
    open: number
    assigned: number
    closed: number
  }
  activeKpi: 'ALL' | 'NEW' | 'ASSIGNED' | 'CLOSED'
  onKpiChange: (kpi: 'ALL' | 'NEW' | 'ASSIGNED' | 'CLOSED') => void
  isMobile: boolean
}

export function DashboardStats({ stats, activeKpi, onKpiChange, isMobile }: DashboardStatsProps) {
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
        active={activeKpi === 'ALL'}
        onClick={() => onKpiChange('ALL')}
      />
      <KpiCard
        label="Open"
        value={stats.open}
        active={activeKpi === 'NEW'}
        onClick={() => onKpiChange('NEW')}
      />
      <KpiCard
        label="Assigned"
        value={stats.assigned}
        active={activeKpi === 'ASSIGNED'}
        onClick={() => onKpiChange('ASSIGNED')}
      />
      <KpiCard
        label="Closed"
        value={stats.closed}
        active={activeKpi === 'CLOSED'}
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
