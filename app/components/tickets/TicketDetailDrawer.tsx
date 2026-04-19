'use client'

import { type CSSProperties } from 'react'
import { Drawer, Button, theme } from '../ui'

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

interface AttachmentRow {
  id: string
  ticket_id: string
  file_name: string
  file_url: string | null
  file_size?: number | null
  mime_type: string
  created_at: string
  signed_url?: string | null
}

interface TicketLog {
  id: string
  ticket_id: string
  action_type: string
  old_value: string | null
  new_value: string | null
  performed_by: string | null
  notes: string | null
  created_at: string
}

const editableStatusOptions = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] as const

interface TicketDetailDrawerProps {
  selectedTicket: TicketRow | null
  isMobile: boolean
  draftDescription: string
  draftWorkerId: string
  draftStatus: string
  selectedTicketAttachments: AttachmentRow[]
  ticketLogs: TicketLog[]
  drawerLoading: boolean
  savingTicket: boolean
  workersMap: Record<string, string>
  onClose: () => void
  onDescriptionChange: (value: string) => void
  onWorkerChange: (value: string) => void
  onStatusChange: (value: string) => void
  onSave: () => void
  onSelectImage: (url: string) => void
  onCloseTicket: () => void
  getImageUrl: (attachment: AttachmentRow) => string
}

export function TicketDetailDrawer({
  selectedTicket,
  isMobile,
  draftDescription,
  draftWorkerId,
  draftStatus,
  selectedTicketAttachments,
  ticketLogs,
  drawerLoading,
  savingTicket,
  workersMap,
  onClose,
  onDescriptionChange,
  onWorkerChange,
  onStatusChange,
  onSave,
  onSelectImage,
  onCloseTicket,
  getImageUrl,
}: TicketDetailDrawerProps) {
  function formatLogTitle(actionType: string) {
    switch (actionType) {
      case 'TICKET_CREATED':
        return 'Ticket Created'
      case 'USER_MESSAGE':
        return 'User Message'
      case 'ASSIGNED_TO_WORKER':
        return 'Assigned To Worker'
      case 'TICKET_CLOSED':
        return 'Ticket Closed'
      case 'AUTO_ASSIGNED':
        return 'Auto Assigned'
      default:
        return actionType
    }
  }

  return (
    <Drawer
      open={!!selectedTicket}
      onClose={onClose}
      title={`Ticket #${selectedTicket?.ticket_number}`}
      subtitle={selectedTicket?.project_name || selectedTicket?.project_code}
      isMobile={isMobile}
    >
      {selectedTicket && (
        <div style={styles.drawerContent}>
          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Status</div>
            <select
              value={draftStatus}
              onChange={(e) => onStatusChange(e.target.value)}
              style={styles.drawerSelect}
            >
              {editableStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Assigned Worker</div>
            <select
              value={draftWorkerId}
              onChange={(e) => onWorkerChange(e.target.value)}
              style={styles.drawerSelect}
            >
              <option value="">Unassigned</option>
              {Object.entries(workersMap).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Description</div>
            <textarea
              value={draftDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              style={styles.drawerTextarea}
              rows={4}
            />
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Reporter Phone</div>
            <a 
              href={`tel:${selectedTicket.reporter_phone}`}
              style={styles.phoneLink}
            >
              {selectedTicket.reporter_phone}
            </a>
          </div>

          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>Created</div>
            <div style={styles.drawerValue}>
              {new Date(selectedTicket.created_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Attachments */}
          {selectedTicketAttachments.length > 0 && (
            <div style={styles.drawerSection}>
              <div style={styles.drawerLabel}>Attachments</div>
              <div style={styles.attachmentGrid}>
                {selectedTicketAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    onClick={() => onSelectImage(getImageUrl(attachment))}
                    style={styles.attachmentThumb}
                  >
                    {attachment.mime_type.startsWith('image/') ? (
                      <img
                        src={getImageUrl(attachment)}
                        alt={attachment.file_name}
                        style={styles.attachmentImg}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div style={styles.attachmentFile}>{attachment.file_name}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={styles.drawerActions}>
            <Button
              variant="primary"
              onClick={onSave}
              loading={savingTicket}
              style={{ width: '100%' }}
            >
              Save Changes
            </Button>
            {selectedTicket.status !== 'CLOSED' && (
              <Button
                variant="danger"
                onClick={onCloseTicket}
                style={{ width: '100%' }}
              >
                Close Ticket
              </Button>
            )}
          </div>

          {/* History */}
          <div style={styles.drawerSection}>
            <div style={styles.drawerLabel}>History</div>
            {drawerLoading ? (
              <div style={styles.loadingState}>Loading...</div>
            ) : ticketLogs.length === 0 ? (
              <div style={styles.emptyLogs}>No history available</div>
            ) : (
              <div style={styles.logsList}>
                {ticketLogs.map((log) => (
                  <div key={log.id} style={styles.logItem}>
                    <div style={styles.logHeader}>
                      <span style={styles.logAction}>{formatLogTitle(log.action_type)}</span>
                      <span style={styles.logTime}>
                        {new Date(log.created_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {log.notes && <div style={styles.logNotes}>{log.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

const styles: Record<string, CSSProperties> = {
  drawerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  drawerSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  drawerLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  drawerValue: {
    fontSize: '14px',
    color: theme.colors.textPrimary,
  },
  phoneLink: {
    fontSize: '14px',
    color: theme.colors.primary,
    textDecoration: 'none',
    fontWeight: 500,
  },
  drawerSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
  },
  drawerTextarea: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '12px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    resize: 'vertical',
    minHeight: '100px',
    lineHeight: 1.5,
  },
  drawerActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingTop: '12px',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  attachmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '10px',
  },
  attachmentThumb: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    padding: 0,
  },
  attachmentImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  attachmentFile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '11px',
    color: theme.colors.textMuted,
    padding: '8px',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  emptyLogs: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    padding: '16px 0',
  },
  logsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  logItem: {
    padding: '12px',
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  logAction: {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  logTime: {
    fontSize: '11px',
    color: theme.colors.textMuted,
  },
  logNotes: {
    fontSize: '13px',
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
  },
  loadingState: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    padding: '16px 0',
  },
}
