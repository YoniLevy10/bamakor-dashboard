'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode, type CSSProperties } from 'react'

// ============================================================================
// DESIGN TOKENS - Modern Premium 2026 Design System
// ============================================================================

export const theme = {
  colors: {
    // Base - Premium Grays
    background: '#FAFBFC',
    surface: '#FFFFFF',
    surfaceElevated: '#F8F9FA',
    surfaceHover: '#F3F4F6',
    surfaceActive: '#EEF0F3',
    muted: '#F7F8F9',
    
    // Borders - Subtle & Modern
    border: '#E2E8F0',
    borderSubtle: '#EBF0F5',
    borderStrong: '#CBD5E1',
    
    // Text - Better Hierarchy
    textPrimary: '#0F1419',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textInverse: '#FFFFFF',
    
    // Primary - Original Brand Crimson (Enhanced)
    primary: '#C41E3A',
    primaryHover: '#A91B32',
    primaryActive: '#8F1729',
    primaryMuted: 'rgba(196, 30, 58, 0.06)',
    primarySubtle: 'rgba(196, 30, 58, 0.12)',
    primaryText: '#C41E3A',
    
    // Status Colors - Modern Palette
    success: '#10B981',
    successMuted: '#ECFDF5',
    warning: '#F59E0B',
    warningMuted: '#FFFBEB',
    error: '#EF4444',
    errorMuted: '#FEF2F2',
    info: '#3B82F6',
    infoMuted: '#EFF6FF',
    
    // Additional colors for modern design
    overlay: 'rgba(15, 20, 25, 0.5)',
    overlayLight: 'rgba(15, 20, 25, 0.25)',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
    xxxl: '48px',
  },
  typography: {
    fontSize: {
      xs: '12px',
      sm: '13px',
      base: '14px',
      lg: '15px',
      xl: '16px',
      '2xl': '18px',
      '3xl': '20px',
      '4xl': '24px',
      '5xl': '28px',
      '6xl': '32px',
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
      loose: 2,
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '0em',
      wide: '0.04em',
    },
  },
  shadows: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.1)',
    card: '0 1px 4px rgba(0, 0, 0, 0.06)',
    hover: '0 8px 16px rgba(0, 0, 0, 0.08)',
    focus: '0 0 0 3px rgba(196, 30, 58, 0.1)',
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
  const color = active ? theme.colors.primary : theme.colors.textMuted
  
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
    background: theme.colors.background,
    borderRight: `1px solid ${theme.colors.border}`,
    padding: '24px 16px',
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
    width: '44px',
    height: '44px',
    borderRadius: theme.radius.lg,
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 700,
    fontSize: '18px',
    flexShrink: 0,
    boxShadow: theme.shadows.md,
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    marginTop: '2px',
    fontWeight: 500,
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
    gap: '12px',
    padding: '11px 12px',
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    border: `1px solid transparent`,
    cursor: 'pointer',
  },
  navLinkActive: {
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
    borderColor: theme.colors.primarySubtle,
  },
  footer: {
    padding: '16px 8px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    fontWeight: 500,
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
    background: theme.colors.background,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    margin: '2px 0 0 0',
    fontWeight: 500,
  },
  menuButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
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
    gap: '24px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: theme.typography.fontSize['5xl'],
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: '15px',
    color: theme.colors.textMuted,
    margin: '8px 0 0 0',
    lineHeight: theme.typography.lineHeight.normal,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '12px',
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
    padding: '28px',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    width: '100%',
    boxShadow: theme.shadows.card,
    cursor: 'pointer',
  },
  cardActive: {
    borderColor: theme.colors.primary,
    background: theme.colors.primaryMuted,
    boxShadow: theme.shadows.hover,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  value: {
    fontSize: theme.typography.fontSize['6xl'],
    fontWeight: 700,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
    lineHeight: 1,
    marginBottom: '12px',
  },
  trend: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: 600,
    marginTop: '12px',
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
  title: tooltip,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  title?: string
}) {
  const [hovered, setHovered] = useState(false)

  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: theme.colors.primary,
      color: theme.colors.textInverse,
      border: 'none',
      boxShadow: theme.shadows.md,
    },
    secondary: {
      background: theme.colors.surface,
      color: theme.colors.textPrimary,
      border: `1.5px solid ${theme.colors.border}`,
    },
    ghost: {
      background: 'transparent',
      color: theme.colors.textSecondary,
      border: 'none',
    },
    danger: {
      background: theme.colors.errorMuted,
      color: theme.colors.error,
      border: `1.5px solid ${theme.colors.error}`,
    },
  }
  
  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: '8px 14px', fontSize: theme.typography.fontSize.sm, height: '36px' },
    md: { padding: '11px 20px', fontSize: theme.typography.fontSize.base, height: '42px' },
    lg: { padding: '14px 28px', fontSize: theme.typography.fontSize.lg, height: '50px' },
  }

  const hoverStateStyles: Record<string, CSSProperties> = {
    primary: {
      background: hovered && !disabled ? theme.colors.primaryHover : theme.colors.primary,
      transform: hovered && !disabled ? 'scale(1.02)' : 'scale(1)',
      boxShadow: hovered && !disabled ? theme.shadows.hover : theme.shadows.md,
    },
    secondary: {
      background: hovered && !disabled ? theme.colors.surfaceHover : theme.colors.surface,
      borderColor: hovered && !disabled ? theme.colors.primary : theme.colors.border,
    },
    ghost: {
      background: hovered && !disabled ? theme.colors.surfaceActive : 'transparent',
      color: hovered && !disabled ? theme.colors.primary : theme.colors.textSecondary,
    },
    danger: {
      background: hovered && !disabled ? theme.colors.error : theme.colors.errorMuted,
      color: hovered && !disabled ? theme.colors.textInverse : theme.colors.error,
      borderColor: hovered && !disabled ? theme.colors.error : theme.colors.error,
    },
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-ui="button"
      data-variant={variant}
      data-size={size}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...buttonStyles.base,
        ...variantStyles[variant],
        ...hoverStateStyles[variant],
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
    fontWeight: 600,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: 'pointer',
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
// TOOLTIP
// ============================================================================

export function Tooltip({ 
  text, 
  children 
}: { 
  text: string
  children: ReactNode 
}) {
  const [visible, setVisible] = useState(false)
  
  return (
    <div style={tooltipStyles.wrapper}>
      <div 
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {visible && (
        <div style={tooltipStyles.tooltip}>{text}</div>
      )}
    </div>
  )
}

const tooltipStyles: Record<string, CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    padding: '8px 12px',
    background: theme.colors.textPrimary,
    color: theme.colors.textInverse,
    fontSize: theme.typography.fontSize.xs,
    borderRadius: theme.radius.sm,
    whiteSpace: 'nowrap',
    zIndex: 1000,
    boxShadow: theme.shadows.lg,
    pointerEvents: 'none',
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
  const statusConfig: Record<string, { bg: string; text: string; border?: string }> = {
    NEW: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    ASSIGNED: { bg: theme.colors.infoMuted, text: theme.colors.info },
    IN_PROGRESS: { bg: theme.colors.infoMuted, text: theme.colors.info },
    WAITING_PARTS: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    CLOSED: { bg: theme.colors.successMuted, text: theme.colors.success },
    ACTIVE: { bg: theme.colors.successMuted, text: theme.colors.success },
    INACTIVE: { bg: theme.colors.errorMuted, text: theme.colors.error },
    HIGH: { bg: theme.colors.errorMuted, text: theme.colors.error },
    MEDIUM: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    LOW: { bg: theme.colors.surfaceElevated, text: theme.colors.textSecondary },
  }
  
  const config = statusConfig[status] || statusConfig.LOW
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '4px 11px' : '6px 13px',
      borderRadius: theme.radius.full,
      fontSize: size === 'sm' ? theme.typography.fontSize.xs : theme.typography.fontSize.sm,
      fontWeight: 700,
      letterSpacing: theme.typography.letterSpacing.wide,
      background: config.bg,
      color: config.text,
      textTransform: 'uppercase',
      lineHeight: 1,
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
    <div data-ui="card" style={{ ...cardStyles.container, ...customStyle }}>
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
    boxShadow: theme.shadows.card,
    transition: 'all 0.2s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 28px',
    borderBottom: `1px solid ${theme.colors.borderSubtle}`,
    gap: '16px',
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: 700,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: '4px',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  content: {
    padding: '28px',
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
    gap: '8px',
  },
  label: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: 600,
    color: theme.colors.textSecondary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  input: {
    background: theme.colors.surface,
    border: `1.5px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '12px 16px',
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    outline: 'none',
    transition: 'all 0.2s ease',
    lineHeight: theme.typography.lineHeight.normal,
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
    gap: '8px',
  },
  label: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: 600,
    color: theme.colors.textSecondary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  select: {
    background: theme.colors.surface,
    border: `1.5px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '12px 16px',
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    outline: 'none',
    cursor: 'pointer',
    minHeight: '46px',
    transition: 'all 0.2s ease',
    lineHeight: theme.typography.lineHeight.normal,
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
  width = 480,
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
          <button onClick={onClose} style={drawerStyles.closeButton} data-ui="icon-button" aria-label="Close">
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
    background: theme.colors.overlay,
    zIndex: 50,
    animation: 'fadeIn 0.2s ease',
  },
  container: {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100dvh',
    background: theme.colors.background,
    borderLeft: `1px solid ${theme.colors.border}`,
    zIndex: 60,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideInRight 0.25s ease',
    boxShadow: theme.shadows.xl,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 28px',
    paddingTop: 'calc(24px + env(safe-area-inset-top))',
    borderBottom: `1px solid ${theme.colors.borderSubtle}`,
    gap: '16px',
    flexShrink: 0,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 700,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textMuted,
    marginTop: '4px',
    fontWeight: 500,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.md,
    background: theme.colors.surface,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '28px',
    paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
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
    padding: '64px 24px',
    textAlign: 'center',
    minHeight: '400px',
  },
  icon: {
    marginBottom: '24px',
    opacity: 0.35,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: 700,
    color: theme.colors.textPrimary,
    marginBottom: '8px',
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  description: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textMuted,
    maxWidth: '360px',
    lineHeight: theme.typography.lineHeight.relaxed,
    fontWeight: 500,
  },
  action: {
    marginTop: '24px',
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
      gridTemplateColumns: isMobile ? '1fr' : '260px 1fr',
      minHeight: '100dvh',
      height: '100dvh',
      overflow: 'hidden',
      background: theme.colors.muted,
    }}>
      {!isMobile && <Sidebar />}
      <main style={{
        overflow: 'auto',
        overscrollBehavior: 'contain',
        padding: isMobile ? '0' : '32px',
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
    background: theme.colors.overlay,
    zIndex: 100,
  },
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '300px',
    height: '100dvh',
    background: theme.colors.background,
    borderRight: `1px solid ${theme.colors.border}`,
    zIndex: 101,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInLeft 0.25s ease',
    boxShadow: theme.shadows.xl,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 24px',
    paddingTop: 'calc(24px + env(safe-area-inset-top))',
    borderBottom: `1px solid ${theme.colors.borderSubtle}`,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBox: {
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.lg,
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 700,
    fontSize: '18px',
    boxShadow: theme.shadows.md,
  },
  brandText: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 600,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 12px',
    gap: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    fontSize: theme.typography.fontSize.base,
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  navLinkActive: {
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
    borderColor: theme.colors.primarySubtle,
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
    <div data-ui="search" style={{ ...searchStyles.container, ...customStyle }}>
      <svg 
        width="18" 
        height="18" 
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
        data-ui="input"
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
    left: '16px',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    background: theme.colors.surface,
    border: `1.5px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '12px 16px 12px 48px',
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    outline: 'none',
    transition: 'all 0.2s ease',
    lineHeight: theme.typography.lineHeight.normal,
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
              background: value === opt.value ? theme.colors.primary : theme.colors.surfaceElevated,
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
    padding: '6px',
    background: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflowX: 'auto',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: theme.colors.background,
    color: theme.colors.textPrimary,
    boxShadow: theme.shadows.sm,
  },
  count: {
    padding: '3px 9px',
    borderRadius: theme.radius.full,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: 700,
    lineHeight: 1,
  },
}
