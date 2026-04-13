'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode, type CSSProperties } from 'react'

// ============================================================================
// DESIGN TOKENS - Premium Dark Theme
// ============================================================================

export const theme = {
  colors: {
    background: '#0a0a0b',
    surface: '#111113',
    surfaceElevated: '#18181b',
    surfaceHover: '#1f1f23',
    surfaceActive: '#27272a',
    border: '#27272a',
    borderSubtle: '#1f1f23',
    borderStrong: '#3f3f46',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textInverse: '#0a0a0b',
    accent: '#f59e0b',
    accentHover: '#fbbf24',
    accentMuted: 'rgba(245, 158, 11, 0.15)',
    accentText: '#fcd34d',
    success: '#22c55e',
    successMuted: 'rgba(34, 197, 94, 0.15)',
    warning: '#f59e0b',
    warningMuted: 'rgba(245, 158, 11, 0.15)',
    error: '#ef4444',
    errorMuted: 'rgba(239, 68, 68, 0.15)',
    info: '#3b82f6',
    infoMuted: 'rgba(59, 130, 246, 0.15)',
  },
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 12px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
    glow: '0 0 20px rgba(245, 158, 11, 0.15)',
  },
}

// ============================================================================
// SIDEBAR NAVIGATION
// ============================================================================

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'grid' },
  { href: '/tickets', label: 'Tickets', icon: 'ticket' },
  { href: '/projects', label: 'Projects', icon: 'folder' },
  { href: '/workers', label: 'Workers', icon: 'users' },
  { href: '/qr', label: 'QR Codes', icon: 'qr' },
  { href: '/summary', label: 'Summary', icon: 'chart' },
]

function NavIcon({ type, active }: { type: string; active?: boolean }) {
  const color = active ? theme.colors.accent : theme.colors.textSecondary
  
  const icons: Record<string, ReactNode> = {
    grid: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    ticket: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" />
        <path d="M13 17v2" />
        <path d="M13 11v2" />
      </svg>
    ),
    folder: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    ),
    users: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    qr: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="5" height="5" x="3" y="3" rx="1" />
        <rect width="5" height="5" x="16" y="3" rx="1" />
        <rect width="5" height="5" x="3" y="16" rx="1" />
        <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
        <path d="M21 21v.01" />
        <path d="M12 7v3a2 2 0 0 1-2 2H7" />
        <path d="M3 12h.01" />
        <path d="M12 3h.01" />
        <path d="M12 16v.01" />
        <path d="M16 12h1" />
        <path d="M21 12v.01" />
        <path d="M12 21v-1" />
      </svg>
    ),
    chart: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  }
  
  return <>{icons[type] || null}</>
}

export function Sidebar() {
  const pathname = usePathname()
  
  return (
    <aside style={sidebarStyles.container}>
      <div style={sidebarStyles.brand}>
        <div style={sidebarStyles.logoBox}>B</div>
        <div>
          <div style={sidebarStyles.title}>Bamakor</div>
          <div style={sidebarStyles.subtitle}>Maintenance</div>
        </div>
      </div>
      
      <nav style={sidebarStyles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...sidebarStyles.navLink,
                ...(isActive ? sidebarStyles.navLinkActive : {}),
              }}
            >
              <NavIcon type={item.icon} active={isActive} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      
      <div style={sidebarStyles.footer}>
        <div style={sidebarStyles.footerText}>Bamakor v2.0</div>
      </div>
    </aside>
  )
}

const sidebarStyles: Record<string, CSSProperties> = {
  container: {
    background: theme.colors.surface,
    borderRight: `1px solid ${theme.colors.border}`,
    padding: '20px 12px',
    position: 'sticky',
    top: 0,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 8px',
    marginBottom: '32px',
  },
  logoBox: {
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.lg,
    background: `linear-gradient(135deg, ${theme.colors.accent} 0%, #d97706 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 700,
    fontSize: '16px',
    boxShadow: theme.shadows.glow,
    flexShrink: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    marginTop: '1px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  navLinkActive: {
    background: theme.colors.accentMuted,
    color: theme.colors.accent,
  },
  footer: {
    padding: '12px 8px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
}

// ============================================================================
// MOBILE HEADER
// ============================================================================

export function MobileHeader({ 
  title, 
  subtitle,
  onMenuClick 
}: { 
  title: string
  subtitle?: string
  onMenuClick?: () => void 
}) {
  return (
    <header style={mobileHeaderStyles.container}>
      <div style={mobileHeaderStyles.left}>
        <Link href="/" style={mobileHeaderStyles.backButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 style={mobileHeaderStyles.title}>{title}</h1>
          {subtitle && <p style={mobileHeaderStyles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {onMenuClick && (
        <button onClick={onMenuClick} style={mobileHeaderStyles.menuButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" x2="21" y1="6" y2="6" />
            <line x1="3" x2="21" y1="12" y2="12" />
            <line x1="3" x2="21" y1="18" y2="18" />
          </svg>
        </button>
      )}
    </header>
  )
}

const mobileHeaderStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    paddingTop: 'calc(16px + env(safe-area-inset-top))',
    background: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceElevated,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    border: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    margin: '2px 0 0 0',
  },
  menuButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
    cursor: 'pointer',
  },
}

// ============================================================================
// PAGE HEADER
// ============================================================================

export function PageHeader({ 
  title, 
  subtitle,
  actions 
}: { 
  title: string
  subtitle?: string
  actions?: ReactNode 
}) {
  return (
    <div style={pageHeaderStyles.container}>
      <div>
        <h1 style={pageHeaderStyles.title}>{title}</h1>
        {subtitle && <p style={pageHeaderStyles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div style={pageHeaderStyles.actions}>{actions}</div>}
    </div>
  )
}

const pageHeaderStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    margin: '6px 0 0 0',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
}

// ============================================================================
// KPI CARDS
// ============================================================================

export function KpiCard({ 
  label, 
  value, 
  trend,
  active,
  onClick 
}: { 
  label: string
  value: string | number
  trend?: { value: string; positive?: boolean }
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...kpiStyles.card,
        ...(active ? kpiStyles.cardActive : {}),
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={kpiStyles.label}>{label}</div>
      <div style={kpiStyles.value}>{value}</div>
      {trend && (
        <div style={{
          ...kpiStyles.trend,
          color: trend.positive ? theme.colors.success : theme.colors.error,
        }}>
          {trend.positive ? '+' : ''}{trend.value}
        </div>
      )}
    </button>
  )
}

const kpiStyles: Record<string, CSSProperties> = {
  card: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '20px',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    width: '100%',
  },
  cardActive: {
    borderColor: theme.colors.accent,
    background: theme.colors.accentMuted,
  },
  label: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    marginBottom: '8px',
    fontWeight: 500,
  },
  value: {
    fontSize: '32px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  trend: {
    fontSize: '12px',
    fontWeight: 500,
    marginTop: '8px',
  },
}

// ============================================================================
// BUTTONS
// ============================================================================

export function Button({ 
  children, 
  variant = 'secondary',
  size = 'md',
  disabled,
  loading,
  onClick,
  style: customStyle,
  ...props
}: { 
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  style?: CSSProperties
}) {
  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: theme.colors.accent,
      color: theme.colors.textInverse,
      border: 'none',
      boxShadow: theme.shadows.glow,
    },
    secondary: {
      background: theme.colors.surfaceElevated,
      color: theme.colors.textPrimary,
      border: `1px solid ${theme.colors.border}`,
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.textSecondary,
      border: 'none',
    },
    danger: {
      background: theme.colors.errorMuted,
      color: theme.colors.error,
      border: `1px solid ${theme.colors.error}`,
    },
  }
  
  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: '13px', height: '32px' },
    md: { padding: '10px 16px', fontSize: '14px', height: '40px' },
    lg: { padding: '12px 20px', fontSize: '15px', height: '48px' },
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...buttonStyles.base,
        ...variantStyles[variant],
        ...sizeStyles[size],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...customStyle,
      }}
      {...props}
    >
      {loading ? (
        <span style={buttonStyles.loader} />
      ) : children}
    </button>
  )
}

const buttonStyles: Record<string, CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: theme.radius.md,
    fontWeight: 500,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  loader: {
    width: '16px',
    height: '16px',
    border: '2px solid transparent',
    borderTopColor: 'currentColor',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
}

// ============================================================================
// STATUS BADGE
// ============================================================================

export function StatusBadge({ 
  status, 
  size = 'md' 
}: { 
  status: string
  size?: 'sm' | 'md'
}) {
  const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
    NEW: { bg: theme.colors.warningMuted, text: theme.colors.warning, border: theme.colors.warning },
    ASSIGNED: { bg: theme.colors.infoMuted, text: theme.colors.info, border: theme.colors.info },
    IN_PROGRESS: { bg: theme.colors.infoMuted, text: theme.colors.info, border: theme.colors.info },
    WAITING_PARTS: { bg: theme.colors.warningMuted, text: theme.colors.warning, border: theme.colors.warning },
    CLOSED: { bg: theme.colors.successMuted, text: theme.colors.success, border: theme.colors.success },
    ACTIVE: { bg: theme.colors.successMuted, text: theme.colors.success, border: theme.colors.success },
    INACTIVE: { bg: theme.colors.errorMuted, text: theme.colors.error, border: theme.colors.error },
    HIGH: { bg: theme.colors.errorMuted, text: theme.colors.error, border: theme.colors.error },
    MEDIUM: { bg: theme.colors.warningMuted, text: theme.colors.warning, border: theme.colors.warning },
    LOW: { bg: theme.colors.surfaceActive, text: theme.colors.textSecondary, border: theme.colors.borderStrong },
  }
  
  const config = statusConfig[status] || statusConfig.LOW
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '3px 8px' : '4px 10px',
      borderRadius: '9999px',
      fontSize: size === 'sm' ? '11px' : '12px',
      fontWeight: 600,
      letterSpacing: '0.01em',
      background: config.bg,
      color: config.text,
      border: `1px solid ${config.border}`,
      textTransform: 'uppercase',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ============================================================================
// CARD
// ============================================================================

export function Card({ 
  children,
  title,
  subtitle,
  actions,
  noPadding,
  style: customStyle,
}: { 
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  noPadding?: boolean
  style?: CSSProperties
}) {
  return (
    <div style={{ ...cardStyles.container, ...customStyle }}>
      {(title || actions) && (
        <div style={cardStyles.header}>
          <div>
            {title && <div style={cardStyles.title}>{title}</div>}
            {subtitle && <div style={cardStyles.subtitle}>{subtitle}</div>}
          </div>
          {actions && <div style={cardStyles.actions}>{actions}</div>}
        </div>
      )}
      <div style={noPadding ? {} : cardStyles.content}>
        {children}
      </div>
    </div>
  )
}

const cardStyles: Record<string, CSSProperties> = {
  container: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: '16px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    marginTop: '4px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  content: {
    padding: '20px',
  },
}

// ============================================================================
// INPUT
// ============================================================================

export function Input({ 
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  style: customStyle,
}: { 
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  type?: string
  error?: string
  style?: CSSProperties
}) {
  return (
    <div style={inputStyles.container}>
      {label && <label style={inputStyles.label}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyles.input,
          borderColor: error ? theme.colors.error : theme.colors.border,
          ...customStyle,
        }}
      />
      {error && <div style={inputStyles.error}>{error}</div>}
    </div>
  )
}

const inputStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
  },
  input: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  error: {
    fontSize: '12px',
    color: theme.colors.error,
  },
}

// ============================================================================
// SELECT
// ============================================================================

export function Select({ 
  label,
  value,
  onChange,
  options,
  placeholder,
  style: customStyle,
}: { 
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  style?: CSSProperties
}) {
  return (
    <div style={selectStyles.container}>
      {label && <label style={selectStyles.label}>{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...selectStyles.select, ...customStyle }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

const selectStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
  },
  select: {
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    minHeight: '42px',
  },
}

// ============================================================================
// DRAWER
// ============================================================================

export function Drawer({ 
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 440,
  isMobile,
}: { 
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  width?: number
  isMobile?: boolean
}) {
  if (!open) return null
  
  return (
    <>
      <div style={drawerStyles.overlay} onClick={onClose} />
      <div style={{
        ...drawerStyles.container,
        width: isMobile ? '100%' : `${width}px`,
      }}>
        <div style={drawerStyles.header}>
          <div>
            {title && <div style={drawerStyles.title}>{title}</div>}
            {subtitle && <div style={drawerStyles.subtitle}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={drawerStyles.closeButton}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div style={drawerStyles.content}>
          {children}
        </div>
      </div>
    </>
  )
}

const drawerStyles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 50,
    animation: 'fadeIn 0.2s ease',
  },
  container: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100dvh',
    background: theme.colors.surface,
    borderLeft: `1px solid ${theme.colors.border}`,
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideInRight 0.25s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px',
    paddingTop: 'calc(20px + env(safe-area-inset-top))',
    borderBottom: `1px solid ${theme.colors.border}`,
    gap: '16px',
    flexShrink: 0,
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    marginTop: '4px',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceElevated,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
  },
}

// ============================================================================
// EMPTY STATE
// ============================================================================

export function EmptyState({ 
  title,
  description,
  action,
}: { 
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div style={emptyStyles.container}>
      <div style={emptyStyles.icon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          <path d="M12 10v6" />
          <path d="m9 13 3-3 3 3" />
        </svg>
      </div>
      <div style={emptyStyles.title}>{title}</div>
      {description && <div style={emptyStyles.description}>{description}</div>}
      {action && <div style={emptyStyles.action}>{action}</div>}
    </div>
  )
}

const emptyStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    textAlign: 'center',
  },
  icon: {
    marginBottom: '16px',
    opacity: 0.5,
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    maxWidth: '320px',
  },
  action: {
    marginTop: '20px',
  },
}

// ============================================================================
// APP SHELL
// ============================================================================

export function AppShell({ 
  children,
  isMobile,
}: { 
  children: ReactNode
  isMobile: boolean
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '240px 1fr',
      minHeight: '100dvh',
      height: '100dvh',
      overflow: 'hidden',
      background: theme.colors.background,
    }}>
      {!isMobile && <Sidebar />}
      <main style={{
        overflow: 'auto',
        overscrollBehavior: 'contain',
        padding: isMobile ? '0' : '24px',
        paddingTop: isMobile ? '0' : '24px',
      }}>
        {children}
      </main>
    </div>
  )
}

// ============================================================================
// MOBILE MENU
// ============================================================================

export function MobileMenu({ 
  open,
  onClose,
}: { 
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  
  if (!open) return null
  
  return (
    <>
      <div style={mobileMenuStyles.overlay} onClick={onClose} />
      <div style={mobileMenuStyles.container}>
        <div style={mobileMenuStyles.header}>
          <div style={mobileMenuStyles.brand}>
            <div style={mobileMenuStyles.logoBox}>B</div>
            <div style={mobileMenuStyles.brandText}>Bamakor</div>
          </div>
          <button onClick={onClose} style={mobileMenuStyles.closeButton}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <nav style={mobileMenuStyles.nav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={{
                  ...mobileMenuStyles.navLink,
                  ...(isActive ? mobileMenuStyles.navLinkActive : {}),
                }}
              >
                <NavIcon type={item.icon} active={isActive} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}

const mobileMenuStyles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 100,
  },
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '280px',
    height: '100dvh',
    background: theme.colors.surface,
    borderRight: `1px solid ${theme.colors.border}`,
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInLeft 0.25s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    paddingTop: 'calc(16px + env(safe-area-inset-top))',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBox: {
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.md,
    background: theme.colors.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 700,
    fontSize: '14px',
  },
  brandText: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.sm,
    background: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
    cursor: 'pointer',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    gap: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: 500,
  },
  navLinkActive: {
    background: theme.colors.accentMuted,
    color: theme.colors.accent,
  },
}

// ============================================================================
// SEARCH INPUT
// ============================================================================

export function SearchInput({ 
  value,
  onChange,
  placeholder = 'Search...',
  style: customStyle,
}: { 
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: CSSProperties
}) {
  return (
    <div style={{ ...searchStyles.container, ...customStyle }}>
      <svg 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke={theme.colors.textMuted} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        style={searchStyles.icon}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={searchStyles.input}
      />
    </div>
  )
}

const searchStyles: Record<string, CSSProperties> = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: '200px',
  },
  icon: {
    position: 'absolute',
    left: '14px',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    background: theme.colors.surfaceElevated,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px 10px 42px',
    fontSize: '14px',
    color: theme.colors.textPrimary,
    outline: 'none',
  },
}

// ============================================================================
// FILTER TABS
// ============================================================================

export function FilterTabs({ 
  options,
  value,
  onChange,
}: { 
  options: { value: string; label: string; count?: number }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={filterTabsStyles.container}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            ...filterTabsStyles.tab,
            ...(value === opt.value ? filterTabsStyles.tabActive : {}),
          }}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span style={{
              ...filterTabsStyles.count,
              background: value === opt.value ? theme.colors.accent : theme.colors.surfaceActive,
              color: value === opt.value ? theme.colors.textInverse : theme.colors.textMuted,
            }}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

const filterTabsStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    background: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabActive: {
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    boxShadow: theme.shadows.sm,
  },
  count: {
    padding: '2px 6px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 600,
  },
}
