'use client'

import { type CSSProperties } from 'react'
import { Card, StatusBadge, SearchInput, FilterTabs, EmptyState, Button, theme } from '../ui'

interface TicketRow {
  id: string
  ticket_number: number
  project_id?: string
  project_code?: string
  project_name?: string
  reporter_phone: string
  description: string
  status: string
  assigned_worker_id: string | null
  created_at: string
  closed_at: string | null
}

const statusOptions = ['ALL', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const

interface TicketsListProps {
  tickets: TicketRow[]
  filteredTickets: TicketRow[]
  loading: boolean
  error: string
  searchTerm: string
  statusFilter: string
  onSearchChange: (term: string) => void
  onStatusFilterChange: (status: string) => void
  onTicketClick: (ticket: TicketRow) => void
  onCreateClick: () => void
  onRetry: () => void
  selectedTicketId?: string
  workersMap: Record<string, string>
  isMobile: boolean
}

export function TicketsList({
  tickets,
  filteredTickets,
  loading,
  error,
  searchTerm,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onTicketClick,
  onCreateClick,
  onRetry,
  selectedTicketId,
  workersMap,
  isMobile,
}: TicketsListProps) {
  return (
    <Card
      title="All Tickets"
      subtitle="Live operational view connected to Supabase"
      noPadding
    >
      <div style={styles.filtersRow}>
        <SearchInput
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Search tickets..."
          style={{ maxWidth: isMobile ? '100%' : '320px' }}
        />
        <FilterTabs
          options={statusOptions.map((s) => ({
            value: s,
            label: s === 'ALL' ? 'All' : s.replace('_', ' '),
          }))}
          value={statusFilter}
          onChange={onStatusFilterChange}
        />
      </div>

      {loading && (
        <div style={styles.loadingState}>
          <div style={styles.loadingSpinner} />
          <span>Loading tickets...</span>
        </div>
      )}

      {error && (
        <div style={styles.errorState}>
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && filteredTickets.length === 0 && (
        <EmptyState
          title="No tickets found"
          description="Try adjusting your filters or create a new ticket."
          action={
            <Button variant="primary" onClick={onCreateClick}>
              Create Ticket
            </Button>
          }
        />
      )}

      {!loading && !error && filteredTickets.length > 0 && (
        <div style={styles.ticketList}>
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onTicketClick(ticket)}
              style={{
                ...styles.ticketRow,
                ...(selectedTicketId === ticket.id ? styles.ticketRowActive : {}),
              }}
            >
              <div style={styles.ticketRowMain}>
                <div style={styles.ticketNumber}>#{ticket.ticket_number}</div>
                <div style={styles.ticketProject}>{ticket.project_code || 'N/A'}</div>
                <StatusBadge status={ticket.status} size="sm" />
              </div>
              <div style={styles.ticketDescription}>{ticket.description || '-'}</div>
              <div style={styles.ticketMeta}>
                <span>{ticket.reporter_phone}</span>
                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                <span>{workersMap[ticket.assigned_worker_id || ''] || 'Unassigned'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

const styles: Record<string, CSSProperties> = {
  filtersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '48px 20px',
    color: theme.colors.textMuted,
    fontSize: '14px',
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '48px 20px',
    color: theme.colors.error,
    fontSize: '14px',
  },
  ticketList: {
    display: 'flex',
    flexDirection: 'column',
  },
  ticketRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  ticketRowActive: {
    background: theme.colors.primaryMuted,
    borderLeftColor: theme.colors.primary,
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
  },
  ticketRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  ticketNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  ticketProject: {
    fontSize: '13px',
    color: theme.colors.primary,
    fontWeight: 500,
  },
  ticketDescription: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  ticketMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
}
