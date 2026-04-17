'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode, type CSSProperties } from 'react'

// ============================================================================
// DESIGN TOKENS - Apple-Inspired Premium Design System
// ============================================================================

export const theme = {
  colors: {
    // Base - Near-white background
    background: '#F9F9FB',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHover: '#F5F5F7',
    surfaceActive: '#EEEEEF',
    muted: '#F5F5F7',
    
    // Borders - Subtle
    border: '#E8E8ED',
    borderSubtle: '#F0F0F2',
    borderStrong: '#D1D1D6',
    
    // Text - Strong hierarchy
    textPrimary: '#1A1A2E',
    textSecondary: '#3C3C43',
    textMuted: '#86868B',
    textInverse: '#FFFFFF',
    
    // Primary - Deep blue accent
    primary: '#0066FF',
    primaryHover: '#0055DD',
    primaryActive: '#0044BB',
    primaryMuted: 'rgba(0, 102, 255, 0.08)',
    primarySubtle: 'rgba(0, 102, 255, 0.12)',
    primaryText: '#0066FF',
    
    // Status Colors
    success: '#34C759',
    successMuted: '#E8F9ED',
    warning: '#FF9500',
    warningMuted: '#FFF4E5',
    error: '#FF3B30',
    errorMuted: '#FFEBE9',
    info: '#0066FF',
    infoMuted: '#E5F0FF',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.4)',
    overlayLight: 'rgba(0, 0, 0, 0.2)',
  },
  radius: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
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
      base: '15px',
      lg: '17px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '28px',
      '4xl': '34px',
      '5xl': '40px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  shadows: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 2px 8px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.06)',
    lg: '0 8px 30px rgba(0, 0, 0, 0.08)',
    xl: '0 20px 50px rgba(0, 0, 0, 0.12)',
    focus: '0 0 0 4px rgba(0, 102, 255, 0.15)',
  },
}

// ============================================================================
// NAV ICONS
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
    ticket: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M13 5v2" />
        <path d="M13 17v2" />
        <path d="M13 11v2" />
      </svg>
    ),
    folder: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    qr: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
  }
  
  return <>{icons[type] || null}</>
}

// ============================================================================
// SIDEBAR - Slim, elegant, collapsible
// ============================================================================

export function Sidebar() {
  const pathname = usePathname()
  
  return (
    <aside style={sidebarStyles.container}>
      <div style={sidebarStyles.brand}>
        <Image 
          src="/apple-icon.png" 
          alt="Bamakor" 
          width={40} 
          height={40} 
          style={{ borderRadius: theme.radius.md, flexShrink: 0 }}
        />
        <div style={sidebarStyles.brandText}>
          <div style={sidebarStyles.title}>Bamakor</div>
          <div style={sidebarStyles.subtitle}>Property Management</div>
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
              <span style={isActive ? { color: theme.colors.primary } : {}}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      
      <div style={sidebarStyles.footer}>
        <div style={sidebarStyles.footerAvatar}>YL</div>
        <div style={sidebarStyles.footerInfo}>
          <div style={sidebarStyles.footerName}>Yoni Levy</div>
          <div style={sidebarStyles.footerRole}>Administrator</div>
        </div>
      </div>
    </aside>
  )
}

const sidebarStyles: Record<string, CSSProperties> = {
  container: {
    width: '240px',
    background: theme.colors.surface,
    borderRight: `1px solid ${theme.colors.border}`,
    padding: '24px 12px',
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 12px',
    marginBottom: '32px',
  },
  logoBox: {
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.md,
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 700,
    fontSize: '18px',
    flexShrink: 0,
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '17px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    letterSpacing: '-0.02em',
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
    gap: '12px',
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    fontSize: '15px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  navLinkActive: {
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 12px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: 'auto',
  },
  footerAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.full,
    background: theme.colors.muted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textSecondary,
  },
  footerInfo: {
    flex: 1,
  },
  footerName: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  footerRole: {
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
}

// ============================================================================
// TOP BAR - Minimal, just page title + avatar + CTA
// ============================================================================

export function TopBar({ 
  title,
  actions 
}: { 
  title: string
  actions?: ReactNode 
}) {
  return (
    <header style={topBarStyles.container}>
      <h1 style={topBarStyles.title}>{title}</h1>
      <div style={topBarStyles.actions}>
        {actions}
      </div>
    </header>
  )
}

const topBarStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 40px',
    background: theme.colors.background,
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
}

// ============================================================================
// APP SHELL - Layout wrapper
// ============================================================================

export function AppShell({ 
  children, 
  isMobile 
}: { 
  children: ReactNode
  isMobile?: boolean 
}) {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: theme.colors.background,
    }}>
      {!isMobile && <Sidebar />}
      <main style={{
        flex: 1,
        marginLeft: isMobile ? 0 : '240px',
        minWidth: 0,
      }}>
        {children}
      </main>
    </div>
  )
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
        <button onClick={onMenuClick} style={mobileHeaderStyles.menuButton} aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    padding: '20px 20px',
    paddingTop: 'calc(20px + env(safe-area-inset-top))',
    background: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    margin: '2px 0 0 0',
  },
  menuButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textSecondary,
    border: 'none',
    cursor: 'pointer',
  },
}

// ============================================================================
// MOBILE MENU
// ============================================================================

export function MobileMenu({ 
  open, 
  onClose 
}: { 
  open: boolean
  onClose: () => void 
}) {
  const pathname = usePathname()
  
  if (!open) return null
  
  return (
    <>
      <div style={mobileMenuStyles.overlay} onClick={onClose} />
      <div style={mobileMenuStyles.panel}>
        <div style={mobileMenuStyles.header}>
          <div style={mobileMenuStyles.brand}>
            <Image 
              src="/apple-icon.png" 
              alt="Bamakor" 
              width={36} 
              height={36} 
              style={{ borderRadius: theme.radius.sm }}
            />
            <span style={mobileMenuStyles.brandName}>Bamakor</span>
          </div>
          <button onClick={onClose} style={mobileMenuStyles.closeButton} aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    zIndex: 200,
    animation: 'fadeIn 0.2s ease',
  },
  panel: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '280px',
    background: theme.colors.surface,
    zIndex: 201,
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBox: {
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.sm,
    background: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textInverse,
    fontWeight: 700,
    fontSize: '16px',
  },
  brandName: {
    fontSize: '17px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textMuted,
    border: 'none',
    cursor: 'pointer',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 16px',
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: 500,
  },
  navLinkActive: {
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
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
    fontSize: '34px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    margin: 0,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '15px',
    color: theme.colors.textMuted,
    margin: '8px 0 0 0',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
}

// ============================================================================
// KPI CARDS - Large bold numbers, small label, colored left-border accent
// ============================================================================

export function KpiCard({ 
  label, 
  value, 
  accent,
  active,
  onClick 
}: { 
  label: string
  value: string | number
  accent?: 'primary' | 'success' | 'warning' | 'error'
  active?: boolean
  onClick?: () => void
}) {
  const accentColors = {
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  }
  
  const accentColor = accent ? accentColors[accent] : theme.colors.border
  
  return (
    <button
      onClick={onClick}
      style={{
        ...kpiStyles.card,
        borderLeftColor: accentColor,
        ...(active ? { 
          background: theme.colors.primaryMuted,
          borderColor: theme.colors.primary,
        } : {}),
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={kpiStyles.value}>{value}</div>
      <div style={kpiStyles.label}>{label}</div>
    </button>
  )
}

const kpiStyles: Record<string, CSSProperties> = {
  card: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderLeft: '3px solid',
    borderRadius: theme.radius.lg,
    padding: '24px',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    width: '100%',
  },
  value: {
    fontSize: '40px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    marginBottom: '8px',
  },
  label: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    fontWeight: 500,
  },
}

// ============================================================================
// CARD - Use space and hierarchy instead of borders everywhere
// ============================================================================

export function Card({
  children,
  title,
  subtitle,
  actions,
  noPadding,
  style,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
  noPadding?: boolean
  style?: CSSProperties
}) {
  return (
    <div style={{ ...cardStyles.container, ...style }} data-ui="card">
      {(title || actions) && (
        <div style={cardStyles.header}>
          <div>
            {title && <h3 style={cardStyles.title}>{title}</h3>}
            {subtitle && <p style={cardStyles.subtitle}>{subtitle}</p>}
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
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadows.sm,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 24px 0',
    gap: '16px',
  },
  title: {
    fontSize: '17px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    margin: '4px 0 0',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  content: {
    padding: '24px',
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}) {
  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: theme.colors.primary,
      color: theme.colors.textInverse,
      border: 'none',
    },
    secondary: {
      background: theme.colors.surface,
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
    sm: { padding: '8px 14px', fontSize: '13px', height: '34px' },
    md: { padding: '10px 18px', fontSize: '15px', height: '40px' },
    lg: { padding: '12px 24px', fontSize: '16px', height: '48px' },
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-ui="button"
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
      {loading ? <span style={buttonStyles.loader} /> : children}
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
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
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
// STATUS BADGE - Pill shaped, soft color fills
// ============================================================================

export function StatusBadge({ 
  status, 
  size = 'md' 
}: { 
  status: string
  size?: 'sm' | 'md'
}) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    NEW: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    ASSIGNED: { bg: theme.colors.infoMuted, text: theme.colors.info },
    IN_PROGRESS: { bg: theme.colors.infoMuted, text: theme.colors.info },
    WAITING_PARTS: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    CLOSED: { bg: theme.colors.successMuted, text: theme.colors.success },
    ACTIVE: { bg: theme.colors.successMuted, text: theme.colors.success },
    INACTIVE: { bg: theme.colors.muted, text: theme.colors.textMuted },
    HIGH: { bg: theme.colors.errorMuted, text: theme.colors.error },
    MEDIUM: { bg: theme.colors.warningMuted, text: theme.colors.warning },
    LOW: { bg: theme.colors.infoMuted, text: theme.colors.info },
  }
  
  const config = statusConfig[status] || { bg: theme.colors.muted, text: theme.colors.textMuted }
  
  const sizeStyles = {
    sm: { padding: '4px 10px', fontSize: '11px' },
    md: { padding: '5px 12px', fontSize: '12px' },
  }
  
  return (
    <span style={{
      ...badgeStyles.base,
      ...sizeStyles[size],
      background: config.bg,
      color: config.text,
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const badgeStyles: Record<string, CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: theme.radius.full,
    fontWeight: 600,
    textTransform: 'capitalize',
    letterSpacing: '0.01em',
  },
}

// ============================================================================
// PRIORITY DOT - Colored dot only, not text
// ============================================================================

export function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    HIGH: theme.colors.error,
    MEDIUM: theme.colors.warning,
    LOW: theme.colors.success,
  }
  
  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: colors[priority] || theme.colors.textMuted,
      display: 'inline-block',
      flexShrink: 0,
    }} />
  )
}

// ============================================================================
// SEARCH INPUT
// ============================================================================

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  style,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: CSSProperties
}) {
  return (
    <div style={{ ...searchStyles.container, ...style }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={searchStyles.icon}>
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
    width: '100%',
    maxWidth: '320px',
  },
  icon: {
    position: 'absolute',
    left: '14px',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '15px',
    color: theme.colors.textPrimary,
    outline: 'none',
    transition: 'all 0.15s ease',
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
  options: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={filterTabStyles.container}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            ...filterTabStyles.tab,
            ...(value === option.value ? filterTabStyles.tabActive : {}),
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const filterTabStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    background: theme.colors.muted,
    borderRadius: theme.radius.md,
  },
  tab: {
    padding: '8px 16px',
    borderRadius: theme.radius.sm,
    border: 'none',
    background: 'transparent',
    color: theme.colors.textMuted,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabActive: {
    background: theme.colors.surface,
    color: theme.colors.textPrimary,
    boxShadow: theme.shadows.xs,
  },
}

// ============================================================================
// SELECT
// ============================================================================

export function Select({
  value,
  onChange,
  options,
  placeholder,
  style,
}: {
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  placeholder?: string
  style?: CSSProperties
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...selectStyles.select, ...style }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

const selectStyles: Record<string, CSSProperties> = {
  select: {
    padding: '10px 40px 10px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '15px',
    color: theme.colors.textPrimary,
    cursor: 'pointer',
    minWidth: '140px',
  },
}

// ============================================================================
// DRAWER - Slide-over panel
// ============================================================================

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  isMobile,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  isMobile?: boolean
}) {
  if (!open) return null
  
  return (
    <>
      <div style={drawerStyles.overlay} onClick={onClose} />
      <div style={{
        ...drawerStyles.panel,
        width: isMobile ? '100%' : '480px',
      }}>
        <div style={drawerStyles.header}>
          <div>
            <h2 style={drawerStyles.title}>{title}</h2>
            {subtitle && <p style={drawerStyles.subtitle}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={drawerStyles.closeButton} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    zIndex: 300,
    animation: 'fadeIn 0.2s ease',
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    background: theme.colors.surface,
    zIndex: 301,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px',
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    margin: '4px 0 0',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: theme.radius.md,
    background: 'transparent',
    color: theme.colors.textMuted,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
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
    <div style={emptyStateStyles.container}>
      <div style={emptyStateStyles.icon}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8v13H3V8" />
          <path d="M1 3h22v5H1z" />
          <path d="M10 12h4" />
        </svg>
      </div>
      <h3 style={emptyStateStyles.title}>{title}</h3>
      {description && <p style={emptyStateStyles.description}>{description}</p>}
      {action && <div style={emptyStateStyles.action}>{action}</div>}
    </div>
  )
}

const emptyStateStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center',
  },
  icon: {
    marginBottom: '20px',
    opacity: 0.5,
  },
  title: {
    fontSize: '17px',
    fontWeight: 600,
    color: theme.colors.textPrimary,
    margin: 0,
  },
  description: {
    fontSize: '14px',
    color: theme.colors.textMuted,
    margin: '8px 0 0',
    maxWidth: '320px',
  },
  action: {
    marginTop: '20px',
  },
}

// ============================================================================
// LOADING SPINNER
// ============================================================================

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: '20px', md: '32px', lg: '48px' }
  
  return (
    <div style={{
      width: sizes[size],
      height: sizes[size],
      border: `3px solid ${theme.colors.border}`,
      borderTopColor: theme.colors.primary,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

// ============================================================================
// ACTIVITY ITEM - For timeline/feed
// ============================================================================

export function ActivityItem({
  icon,
  title,
  description,
  time,
}: {
  icon: ReactNode
  title: string
  description?: string
  time: string
}) {
  return (
    <div style={activityStyles.container}>
      <div style={activityStyles.iconWrap}>{icon}</div>
      <div style={activityStyles.content}>
        <div style={activityStyles.title}>{title}</div>
        {description && <div style={activityStyles.description}>{description}</div>}
      </div>
      <div style={activityStyles.time}>{time}</div>
    </div>
  )
}

const activityStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 0',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  iconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.full,
    background: theme.colors.muted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textPrimary,
  },
  description: {
    fontSize: '13px',
    color: theme.colors.textMuted,
    marginTop: '2px',
  },
  time: {
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
}

// ============================================================
// Skeleton Loading Components
// ============================================================

export function Skeleton({ 
  width = '100%', 
  height = '20px', 
  borderRadius = theme.radius.sm 
}: { 
  width?: string | number
  height?: string | number
  borderRadius?: string 
}) {
  return (
    <div
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
        background: `linear-gradient(90deg, ${theme.colors.muted} 25%, ${theme.colors.border} 50%, ${theme.colors.muted} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

export function SkeletonCard() {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Skeleton width="40%" height="14px" />
        <Skeleton width="60%" height="28px" />
        <Skeleton width="30%" height="12px" />
      </div>
    </Card>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Skeleton width="30%" height="20px" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Skeleton width="5%" height="16px" />
            <Skeleton width="25%" height="16px" />
            <Skeleton width="20%" height="16px" />
            <Skeleton width="15%" height="24px" borderRadius={theme.radius.full} />
            <Skeleton width="15%" height="16px" />
            <Skeleton width="10%" height="16px" />
          </div>
        ))}
      </div>
    </Card>
  )
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
      gap: '16px' 
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// ============================================================
// Error State Component
// ============================================================

export function ErrorState({ 
  title = 'Something went wrong',
  message = 'Unable to load data. Please try again.',
  onRetry 
}: { 
  title?: string
  message?: string
  onRetry?: () => void 
}) {
  return (
    <Card>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: theme.radius.full,
          background: '#FEE2E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#DC2626',
          fontSize: '24px'
        }}>
          !
        </div>
        <div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 600, 
            color: theme.colors.textPrimary,
            marginBottom: '4px'
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: theme.colors.textMuted 
          }}>
            {message}
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '8px 16px',
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              color: theme.colors.textPrimary,
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Try Again
          </button>
        )}
      </div>
    </Card>
  )
}

// ============================================================
// Empty State Component
// ============================================================

export function EmptyState({ 
  title,
  message,
  action
}: { 
  title: string
  message: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <Card>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: theme.radius.full,
          background: theme.colors.muted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textMuted,
          fontSize: '20px'
        }}>
          ?
        </div>
        <div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 600, 
            color: theme.colors.textPrimary,
            marginBottom: '4px'
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: theme.colors.textMuted 
          }}>
            {message}
          </div>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '8px 16px',
              borderRadius: theme.radius.sm,
              background: theme.colors.accent,
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </Card>
  )
    flexShrink: 0,
  },
}
