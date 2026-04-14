'use client'

import { type CSSProperties } from 'react'
import { Button, theme } from '../ui'

interface ProjectRow {
  id: string
  name: string
  project_code: string
}

interface AddTicketModalProps {
  open: boolean
  onClose: () => void
  projects: ProjectRow[]
  projectCode: string
  description: string
  reporterName: string
  reporterPhone: string
  error: string
  loading: boolean
  onProjectCodeChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onReporterNameChange: (value: string) => void
  onReporterPhoneChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export function AddTicketModal({
  open,
  onClose,
  projects,
  projectCode,
  description,
  reporterName,
  reporterPhone,
  error,
  loading,
  onProjectCodeChange,
  onDescriptionChange,
  onReporterNameChange,
  onReporterPhoneChange,
  onSubmit,
}: AddTicketModalProps) {
  if (!open) return null

  return (
    <>
      <div style={styles.modalOverlay} onClick={onClose} />
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Create New Ticket</h2>
          <button onClick={onClose} style={styles.modalClose}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} style={styles.modalForm}>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Project</label>
            <select
              value={projectCode}
              onChange={(e) => onProjectCodeChange(e.target.value)}
              style={styles.formSelect}
            >
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.project_code}>
                  {p.name} ({p.project_code})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Description</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe the issue..."
              style={styles.formTextarea}
              rows={4}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Reporter Name (optional)</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => onReporterNameChange(e.target.value)}
              placeholder="Enter name"
              style={styles.formInput}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Reporter Phone (optional)</label>
            <input
              type="tel"
              value={reporterPhone}
              onChange={(e) => onReporterPhoneChange(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="Enter phone number"
              style={styles.formInput}
            />
          </div>

          {error && <div style={styles.formError}>{error}</div>}

          <div style={styles.modalActions}>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={loading}
              onClick={() => onSubmit({ preventDefault: () => {} } as React.FormEvent)}
            >
              Create Ticket
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

const styles: Record<string, CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 100,
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '480px',
    background: theme.colors.surface,
    borderRadius: theme.radius.xl,
    border: `1px solid ${theme.colors.border}`,
    zIndex: 101,
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  modalClose: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.sm,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
  },
  modalForm: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
  },
  formSelect: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
  },
  formInput: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
  },
  formTextarea: {
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
  formError: {
    padding: '10px 12px',
    background: theme.colors.errorMuted,
    color: theme.colors.error,
    borderRadius: theme.radius.md,
    fontSize: '13px',
  },
  modalActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
}
