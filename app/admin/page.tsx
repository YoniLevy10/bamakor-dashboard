'use client'

import { useState } from 'react'
import { theme } from '../components/ui'

export type PlanType = 'Basic' | 'Pro' | 'Enterprise'

export interface Customer {
  id: string
  name: string
  email: string
  plan: PlanType
  buildings: number
  tickets: number
  createdAt: string
  isActive: boolean
}

export interface AdminPageProps {
  customers?: Customer[]
  totalCustomers?: number
  activeCustomers?: number
  monthlyRevenue?: number
  onAddCustomer?: () => void
  onUpdatePlan?: (customerId: string, plan: PlanType) => void
  onToggleActive?: (customerId: string, isActive: boolean) => void
}

export default function AdminPage({
  customers = [],
  totalCustomers = 0,
  activeCustomers = 0,
  monthlyRevenue = 0,
  onAddCustomer,
  onUpdatePlan,
  onToggleActive,
}: AdminPageProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtitle}>Manage customers and subscriptions</p>
        </div>
        <button
          type="button"
          onClick={onAddCustomer}
          style={styles.addButton}
        >
          <PlusIcon />
          Add Customer
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>
            <UsersIcon />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>{totalCustomers}</span>
            <span style={styles.statLabel}>Total Customers</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: theme.colors.successMuted }}>
            <CheckCircleIcon />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>{activeCustomers}</span>
            <span style={styles.statLabel}>Active Customers</span>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: theme.colors.warningMuted }}>
            <CurrencyIcon />
          </div>
          <div style={styles.statContent}>
            <span style={styles.statValue}>{formatCurrency(monthlyRevenue)}</span>
            <span style={styles.statLabel}>Monthly Revenue</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <SearchIcon />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customers..."
          style={styles.searchInput}
        />
      </div>

      {/* Customers Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Plan</th>
              <th style={styles.th}>Buildings</th>
              <th style={styles.th}>Tickets</th>
              <th style={styles.th}>Created</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} style={styles.tableRow}>
                <td style={styles.td}>
                  <div style={styles.customerInfo}>
                    <div style={styles.customerAvatar}>
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={styles.customerName}>{customer.name}</div>
                      <div style={styles.customerEmail}>{customer.email}</div>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <select
                    value={customer.plan}
                    onChange={(e) => onUpdatePlan?.(customer.id, e.target.value as PlanType)}
                    style={styles.planSelect}
                  >
                    <option value="Basic">Basic</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </td>
                <td style={styles.td}>
                  <span style={styles.countBadge}>{customer.buildings}</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.countBadge}>{customer.tickets}</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.dateText}>{formatDate(customer.createdAt)}</span>
                </td>
                <td style={styles.td}>
                  <button
                    type="button"
                    onClick={() => onToggleActive?.(customer.id, !customer.isActive)}
                    style={{
                      ...styles.statusToggle,
                      background: customer.isActive
                        ? theme.colors.success
                        : theme.colors.border,
                    }}
                  >
                    <div
                      style={{
                        ...styles.toggleKnob,
                        transform: customer.isActive
                          ? 'translateX(16px)'
                          : 'translateX(0)',
                      }}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCustomers.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No customers found</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Icons
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function CurrencyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textMuted,
    margin: 0,
    marginTop: '4px',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textInverse,
    background: theme.colors.primary,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '24px',
    background: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: theme.radius.md,
    background: theme.colors.primaryMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: theme.colors.surface,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: '24px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    background: 'transparent',
  },
  tableContainer: {
    background: theme.colors.surface,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    background: theme.colors.muted,
  },
  th: {
    padding: '14px 20px',
    textAlign: 'left',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textSecondary,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  tableRow: {
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  td: {
    padding: '16px 20px',
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
    verticalAlign: 'middle',
  },
  customerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  customerAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.full,
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: theme.typography.fontSize.sm,
    flexShrink: 0,
  },
  customerName: {
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  customerEmail: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  planSelect: {
    padding: '8px 32px 8px 12px',
    fontSize: theme.typography.fontSize.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    cursor: 'pointer',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    padding: '4px 10px',
    background: theme.colors.muted,
    borderRadius: theme.radius.sm,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  dateText: {
    color: theme.colors.textMuted,
  },
  statusToggle: {
    width: '44px',
    height: '24px',
    borderRadius: theme.radius.full,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    padding: '2px',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s',
  },
  emptyState: {
    padding: '48px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textMuted,
    margin: 0,
  },
}
