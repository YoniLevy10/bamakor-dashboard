'use client'

import type { CSSProperties } from 'react'

const bar: CSSProperties = {
  height: '14px',
  borderRadius: '8px',
  background: 'var(--color-muted, #F5F5F7)',
  width: '100%',
}

const row: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid var(--color-border, #E8E8ED)',
  background: 'var(--color-surface, #FFFFFF)',
}

/** Pulse skeleton rows for list/dashboard loading states. */
export function PageListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bamakor-skeleton-row" style={row}>
          <div className="bamakor-skeleton-bar" style={{ ...bar, width: '38%' }} />
          <div className="bamakor-skeleton-bar" style={{ ...bar, width: '72%' }} />
        </div>
      ))}
    </div>
  )
}

export function PageKpiSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}
      aria-hidden
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="bamakor-skeleton-row" style={{ ...row, padding: '20px' }}>
          <div className="bamakor-skeleton-bar" style={{ ...bar, width: '55%' }} />
          <div className="bamakor-skeleton-bar" style={{ ...bar, width: '30%', height: '28px' }} />
        </div>
      ))}
    </div>
  )
}

export function PageKpiSkeletonN({ columns = 3 }: { columns?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '16px',
        marginBottom: '24px',
      }}
      aria-hidden
    >
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="bamakor-skeleton-row" style={{ ...row, padding: '20px' }}>
          <div className="bamakor-skeleton-bar" style={{ ...bar, width: '55%' }} />
          <div className="bamakor-skeleton-bar" style={{ ...bar, width: '30%', height: '28px' }} />
        </div>
      ))}
    </div>
  )
}
