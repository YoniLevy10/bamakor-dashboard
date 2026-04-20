'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { theme } from '../components/ui'

export interface OnboardingData {
  companyName: string
  logoFile: File | null
  smsSenderName: string
  whatsappPhoneId: string
  whatsappAccessToken: string
  buildingName: string
  buildingAddress: string
  assignedWorker: string
}

export interface OnboardingPageProps {
  workers?: Array<{ id: string; name: string }>
  onComplete?: (data: OnboardingData) => void
  onTestWhatsApp?: (phoneId: string, token: string) => Promise<boolean>
}

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error'

export default function OnboardingPage({ 
  workers = [],
  onComplete,
  onTestWhatsApp,
}: OnboardingPageProps) {
  const [step, setStep] = useState(1)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    logoFile: null,
    smsSenderName: '',
    whatsappPhoneId: '',
    whatsappAccessToken: '',
    buildingName: '',
    buildingAddress: '',
    assignedWorker: '',
  })

  const updateData = (key: keyof OnboardingData, value: string | File | null) => {
    setData(prev => ({ ...prev, [key]: value }))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      updateData('logoFile', file)
    }
  }

  const handleTestConnection = async () => {
    if (!data.whatsappPhoneId || !data.whatsappAccessToken) return
    
    setConnectionStatus('testing')
    try {
      const success = await onTestWhatsApp?.(data.whatsappPhoneId, data.whatsappAccessToken)
      setConnectionStatus(success ? 'success' : 'error')
    } catch {
      setConnectionStatus('error')
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.companyName.trim() !== ''
      case 2:
        return data.whatsappPhoneId.trim() !== '' && data.whatsappAccessToken.trim() !== ''
      case 3:
        return data.buildingName.trim() !== '' && data.buildingAddress.trim() !== ''
      default:
        return false
    }
  }

  const handleFinish = () => {
    onComplete?.(data)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <Image
            src="/apple-icon.png"
            alt="Bamakor"
            width={48}
            height={48}
            style={{ borderRadius: theme.radius.md }}
          />
        </div>

        {/* Progress Bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${(step / 3) * 100}%`,
              }}
            />
          </div>
          <div style={styles.progressLabels}>
            <span style={step >= 1 ? styles.progressLabelActive : styles.progressLabel}>
              Company Details
            </span>
            <span style={step >= 2 ? styles.progressLabelActive : styles.progressLabel}>
              WhatsApp
            </span>
            <span style={step >= 3 ? styles.progressLabelActive : styles.progressLabel}>
              First Building
            </span>
          </div>
        </div>

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Company Details</h2>
            <p style={styles.stepDescription}>
              Let&apos;s start by setting up your company profile
            </p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Company Name</label>
              <input
                type="text"
                value={data.companyName}
                onChange={(e) => updateData('companyName', e.target.value)}
                placeholder="Enter your company name"
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Company Logo</label>
              <div
                style={styles.dropZone}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                {data.logoFile ? (
                  <div style={styles.uploadedFile}>
                    <CheckIcon />
                    <span>{data.logoFile.name}</span>
                  </div>
                ) : (
                  <>
                    <UploadIcon />
                    <span style={styles.dropZoneText}>
                      Drag & drop your logo here, or click to browse
                    </span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => updateData('logoFile', e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>SMS Sender Name</label>
              <input
                type="text"
                value={data.smsSenderName}
                onChange={(e) => updateData('smsSenderName', e.target.value)}
                placeholder="e.g., Bamakor"
                style={styles.input}
                maxLength={11}
              />
              <span style={styles.hint}>Max 11 characters, no spaces</span>
            </div>
          </div>
        )}

        {/* Step 2: WhatsApp Connection */}
        {step === 2 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Connect WhatsApp</h2>
            <p style={styles.stepDescription}>
              Connect your WhatsApp Business account to enable notifications
            </p>

            <div style={styles.infoCard}>
              <InfoIcon />
              <span>Copy the details from your Meta Business Manager account</span>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Phone Number ID</label>
              <input
                type="text"
                value={data.whatsappPhoneId}
                onChange={(e) => {
                  updateData('whatsappPhoneId', e.target.value)
                  setConnectionStatus('idle')
                }}
                placeholder="Enter Phone Number ID"
                style={styles.input}
                dir="ltr"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Access Token</label>
              <input
                type="password"
                value={data.whatsappAccessToken}
                onChange={(e) => {
                  updateData('whatsappAccessToken', e.target.value)
                  setConnectionStatus('idle')
                }}
                placeholder="Enter Access Token"
                style={styles.input}
                dir="ltr"
              />
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              style={{
                ...styles.testButton,
                opacity: (!data.whatsappPhoneId || !data.whatsappAccessToken || connectionStatus === 'testing') ? 0.6 : 1,
              }}
              disabled={!data.whatsappPhoneId || !data.whatsappAccessToken || connectionStatus === 'testing'}
            >
              {connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>

            {connectionStatus === 'success' && (
              <div style={styles.statusBadgeSuccess}>
                <CheckIcon /> Connection Successful
              </div>
            )}
            {connectionStatus === 'error' && (
              <div style={styles.statusBadgeError}>
                <XIcon /> Connection Failed
              </div>
            )}
          </div>
        )}

        {/* Step 3: First Building */}
        {step === 3 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Add Your First Building</h2>
            <p style={styles.stepDescription}>
              Set up your first property to start managing
            </p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Building Name</label>
              <input
                type="text"
                value={data.buildingName}
                onChange={(e) => updateData('buildingName', e.target.value)}
                placeholder="e.g., Central Tower"
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Address</label>
              <input
                type="text"
                value={data.buildingAddress}
                onChange={(e) => updateData('buildingAddress', e.target.value)}
                placeholder="Enter building address"
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Assign Worker (Optional)</label>
              <select
                value={data.assignedWorker}
                onChange={(e) => updateData('assignedWorker', e.target.value)}
                style={styles.select}
              >
                <option value="">Select a worker</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={styles.buttonContainer}>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              style={styles.backButton}
            >
              Back
            </button>
          )}
          
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              style={{
                ...styles.nextButton,
                opacity: canProceed() ? 1 : 0.5,
                marginLeft: step === 1 ? 'auto' : undefined,
              }}
              disabled={!canProceed()}
            >
              Next
              <ArrowRightIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              style={{
                ...styles.finishButton,
                opacity: canProceed() ? 1 : 0.5,
              }}
              disabled={!canProceed()}
            >
              Finish & Start
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Icons
function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.colors.background,
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '520px',
    background: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: '40px',
    boxShadow: theme.shadows.lg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: '24px',
  },
  progressContainer: {
    width: '100%',
    marginBottom: '32px',
  },
  progressBar: {
    width: '100%',
    height: '4px',
    background: theme.colors.border,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: theme.colors.primary,
    borderRadius: theme.radius.full,
    transition: 'width 0.3s ease',
  },
  progressLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '12px',
  },
  progressLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.fontWeight.medium,
  },
  progressLabelActive: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  stepContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  stepTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    margin: 0,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    margin: 0,
    textAlign: 'center',
    marginBottom: '8px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: theme.typography.fontSize.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    fontSize: theme.typography.fontSize.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
  },
  hint: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textMuted,
  },
  dropZone: {
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropZoneText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  uploadedFile: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: theme.colors.success,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  infoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: theme.colors.infoMuted,
    padding: '14px 16px',
    borderRadius: theme.radius.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  testButton: {
    padding: '12px 20px',
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary,
    background: theme.colors.primaryMuted,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  statusBadgeSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: theme.colors.successMuted,
    color: theme.colors.success,
    padding: '10px 14px',
    borderRadius: theme.radius.md,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  statusBadgeError: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: theme.colors.errorMuted,
    color: theme.colors.error,
    padding: '10px 14px',
    borderRadius: theme.radius.md,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: '32px',
    gap: '12px',
  },
  backButton: {
    padding: '14px 24px',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
    background: theme.colors.muted,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
  },
  nextButton: {
    padding: '14px 24px',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textInverse,
    background: theme.colors.primary,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  finishButton: {
    flex: 1,
    padding: '14px 24px',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textInverse,
    background: theme.colors.success,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
  },
}
