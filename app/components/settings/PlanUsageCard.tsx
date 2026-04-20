'use client'

import { theme } from '../ui'

export type PlanType = 'Basic' | 'Pro' | 'Enterprise'

export interface UsageData {
  buildings: { current: number; limit: number }
  workers: { current: number; limit: number }
  tenants: { current: number; limit: number }
}

export interface PlanUsageCardProps {
  plan: PlanType
  usage: UsageData
  onUpgrade?: () => void
}

export default function PlanUsageCard({
  plan,
  usage,
  onUpgrade,
}: PlanUsageCardProps) {
  const getUsageColor = (current: number, limit: number) => {
    const percentage = (current / limit) * 100
    if (percentage >= 90) return theme.colors.error
    if (percentage >= 60) return theme.colors.warning
    return theme.colors.success
  }

  const getUsageBackgroundColor = (current: number, limit: number) => {
    const percentage = (current / limit) * 100
    if (percentage >= 90) return theme.colors.errorMuted
    if (percentage >= 60) return theme.colors.warningMuted
    return theme.colors.successMuted
  }

  const getPlanBadgeStyle = (planType: PlanType): React.CSSProperties => {
    switch (planType) {
      case 'Enterprise':
        return {
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          color: '#FFFFFF',
        }
      case 'Pro':
        return {
          background: theme.colors.primary,
          color: '#FFFFFF',
        }
      default:
        return {
          background: theme.colors.muted,
          color: theme.colors.textSecondary,
        }
    }
  }

  const renderProgressBar = (
    label: string,
    current: number,
    limit: number
  ) => {
    const percentage = Math.min((current / limit) * 100, 100)
    const color = getUsageColor(current, limit)
    const bgColor = getUsageBackgroundColor(current, limit)

    return (
      <div style={styles.usageItem}>
        <div style={styles.usageHeader}>
          <span style={styles.usageLabel}>{label}</span>
          <span style={styles.usageCount}>
            <span style={{ color, fontWeight: 600 }}>{current}</span>
            <span style={styles.usageLimit}>/{limit}</span>
          </span>
        </div>
        <div style={{ ...styles.progressTrack, background: bgColor }}>
          <div
            style={{
              ...styles.progressBar,
              width: `${percentage}%`,
              background: color,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      {/* Plan Badge */}
      <div style={styles.header}>
        <h3 style={styles.title}>Current Plan</h3>
        <span style={{ ...styles.planBadge, ...getPlanBadgeStyle(plan) }}>
          {plan}
        </span>
      </div>

      {/* Usage Progress Bars */}
      <div style={styles.usageSection}>
        {renderProgressBar('Buildings', usage.buildings.current, usage.buildings.limit)}
        {renderProgressBar('Workers', usage.workers.current, usage.workers.limit)}
        {renderProgressBar('Tenants', usage.tenants.current, usage.tenants.limit)}
      </div>

      {/* Upgrade Button */}
      {plan !== 'Enterprise' && (
        <button
          type="button"
          onClick={onUpgrade}
          style={styles.upgradeButton}
        >
          Upgrade Plan
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  planBadge: {
    padding: '6px 14px',
    borderRadius: theme.radius.full,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  usageSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  usageItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  usageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  usageCount: {
    fontSize: theme.typography.fontSize.sm,
  },
  usageLimit: {
    color: theme.colors.textMuted,
  },
  progressTrack: {
    height: '8px',
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.radius.full,
    transition: 'width 0.3s ease',
  },
  upgradeButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textInverse,
    background: theme.colors.primary,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
}
