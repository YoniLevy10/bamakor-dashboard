'use client'

import { useState } from 'react'
import Image from 'next/image'
import { theme } from '../components/ui'

export interface LoginPageProps {
  onLogin?: (email: string, password: string) => void
  onForgotPassword?: () => void
  isLoading?: boolean
  error?: string | null
}

export default function LoginPage({ 
  onLogin, 
  onForgotPassword, 
  isLoading = false,
  error = null 
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onLogin?.(email, password)
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <Image
            src="/apple-icon.png"
            alt="Bamakor"
            width={64}
            height={64}
            style={{ borderRadius: theme.radius.lg }}
          />
        </div>

        {/* Title */}
        <h1 style={styles.title}>Bamakor</h1>
        <p style={styles.subtitle}>Maintenance & Ticket Management System</p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={styles.input}
              dir="ltr"
              required
              autoComplete="email"
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              dir="ltr"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.submitButton,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span style={styles.loadingSpinner} />
            ) : (
              'Sign In'
            )}
          </button>

          <button
            type="button"
            onClick={onForgotPassword}
            style={styles.forgotLink}
          >
            Forgot Password?
          </button>
        </form>
      </div>
    </div>
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
    maxWidth: '400px',
    background: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: '48px 40px',
    boxShadow: theme.shadows.lg,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: '24px',
  },
  title: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: '8px',
    marginBottom: '32px',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  errorBox: {
    background: theme.colors.errorMuted,
    color: theme.colors.error,
    padding: '12px 16px',
    borderRadius: theme.radius.md,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
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
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  submitButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textInverse,
    background: theme.colors.primary,
    border: 'none',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    transition: 'background 0.15s, transform 0.1s',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  loadingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  forgotLink: {
    background: 'none',
    border: 'none',
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    cursor: 'pointer',
    padding: 0,
    alignSelf: 'center',
  },
}
