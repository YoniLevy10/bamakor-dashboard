'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'

// ============================================================================
// TYPES
// ============================================================================

export interface LoginPageProps {
  onSubmit?: (email: string, password: string) => void
  loading?: boolean
  error?: string
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const theme = {
  colors: {
    background: '#F9F9FB',
    surface: '#FFFFFF',
    border: '#E8E8ED',
    textPrimary: '#1A1A2E',
    textSecondary: '#3C3C43',
    textMuted: '#86868B',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    error: '#FF3B30',
    errorMuted: '#FFEBE9',
  },
  radius: {
    md: '12px',
    lg: '16px',
  },
  shadows: {
    lg: '0 8px 30px rgba(0, 0, 0, 0.08)',
  },
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LoginPage({ onSubmit, loading = false, error }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(email, password)
  }

  return (
    <div style={styles.container} dir="rtl">
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <Image
            src="/apple-icon.png"
            alt="Bamakor"
            width={64}
            height={64}
            style={{ borderRadius: theme.radius.md }}
          />
        </div>

        {/* Title */}
        <h1 style={styles.title}>Bamakor</h1>
        <p style={styles.subtitle}>מערכת ניהול תקלות ואחזקה</p>

        {/* Error Message */}
        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="הכנס אימייל"
              style={styles.input}
              required
              dir="ltr"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הכנס סיסמה"
              style={styles.input}
              required
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.loadingSpinner} />
            ) : (
              'כניסה למערכת'
            )}
          </button>
        </form>

        {/* Forgot Password */}
        <button
          type="button"
          style={styles.forgotLink}
          onClick={() => {}}
        >
          שכחתי סיסמה
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadows.lg,
    padding: '48px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    margin: 0,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    margin: 0,
    marginBottom: '32px',
  },
  errorBox: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: theme.colors.errorMuted,
    color: theme.colors.error,
    borderRadius: theme.radius.md,
    fontSize: '14px',
    marginBottom: '24px',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  submitButton: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: theme.colors.primary,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px',
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  forgotLink: {
    marginTop: '24px',
    fontSize: '14px',
    color: theme.colors.primary,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
  },
}
