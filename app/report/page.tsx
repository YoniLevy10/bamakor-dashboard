'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

export default function ReportPage() {
  const searchParams = useSearchParams()
  const projectCode = (searchParams.get('project') || '').toUpperCase()

  const [description, setDescription] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = useMemo(() => {
    return Boolean(projectCode && description.trim().length >= 3)
  }, [projectCode, description])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setSuccessMessage('')
    setErrorMessage('')

    if (!projectCode) {
      setErrorMessage('Missing project code.')
      return
    }

    if (description.trim().length < 3) {
      setErrorMessage('Please enter a short description of the issue.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/create-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_code: projectCode,
          description: description.trim(),
          reporter_name: reporterName.trim() || null,
          source: 'web_form',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create ticket')
      }

      setSuccessMessage(
        `The issue was submitted successfully. Ticket number: ${result.ticketNumber}`
      )
      setDescription('')
      setReporterName('')
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrapper}>
        <div style={styles.brandRow}>
          <div style={styles.logoBox}>B</div>
          <div>
            <div style={styles.brandTitle}>Bamakor</div>
            <div style={styles.brandSubtitle}>Maintenance Report Form</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.headerBlock}>
            <h1 style={styles.title}>Report an Issue</h1>
            <p style={styles.subtitle}>
              Fill in the details below and we will forward the issue for treatment.
            </p>
          </div>

          <div style={styles.projectInfo}>
            <span style={styles.projectLabel}>Project Code</span>
            <span style={styles.projectValue}>{projectCode || 'Not provided'}</span>
          </div>

          {!projectCode && (
            <div style={styles.errorBox}>
              This page is missing a project code. Please scan the QR code again.
            </div>
          )}

          {successMessage && <div style={styles.successBox}>{successMessage}</div>}
          {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label htmlFor="reporterName" style={styles.label}>
                Your Name (optional)
              </label>
              <input
                id="reporterName"
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Enter your name"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="description" style={styles.label}>
                Issue Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Water leak near the elevator / electrical issue / broken door..."
                style={styles.textarea}
                rows={6}
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              style={{
                ...styles.submitButton,
                opacity: !canSubmit || loading ? 0.6 : 1,
                cursor: !canSubmit || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Submitting...' : 'Submit Issue'}
            </button>
          </form>

          <div style={styles.footerNote}>
            After submitting, the issue will be recorded in the Bamakor system.
          </div>

          <div style={styles.backRow}>
            <Link href="/" style={styles.backLink}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg, #F5F6F8 0%, #EEF1F4 100%)',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    padding: '32px 16px',
    color: '#111827',
  },
  wrapper: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  logoBox: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #C1121F 0%, #8F0B16 100%)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '18px',
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: 800,
  },
  brandSubtitle: {
    fontSize: '13px',
    color: '#6B7280',
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 12px 30px rgba(17, 24, 39, 0.06)',
  },
  headerBlock: {
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    fontWeight: 800,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: '10px 0 0 0',
    color: '#6B7280',
    fontSize: '15px',
    lineHeight: 1.6,
  },
  projectInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '14px',
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  projectLabel: {
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  projectValue: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#111827',
  },
  form: {
    display: 'grid',
    gap: '18px',
  },
  field: {
    display: 'grid',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #D1D5DB',
    background: '#FFFFFF',
    fontSize: '15px',
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #D1D5DB',
    background: '#FFFFFF',
    fontSize: '15px',
    color: '#111827',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
  },
  submitButton: {
    background: '#111827',
    color: '#FFFFFF',
    border: '1px solid #111827',
    borderRadius: '12px',
    padding: '14px 18px',
    fontSize: '15px',
    fontWeight: 800,
  },
  successBox: {
    background: '#ECFDF5',
    color: '#166534',
    border: '1px solid #BBF7D0',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    fontWeight: 600,
  },
  errorBox: {
    background: '#FEF2F2',
    color: '#B91C1C',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    fontWeight: 600,
  },
  footerNote: {
    marginTop: '18px',
    fontSize: '13px',
    color: '#6B7280',
    lineHeight: 1.6,
  },
  backRow: {
    marginTop: '18px',
  },
  backLink: {
    color: '#111827',
    fontWeight: 700,
    textDecoration: 'none',
  },
}
