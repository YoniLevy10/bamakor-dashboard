'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { theme } from '@/app/components/ui'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function LoginClient() {
  const searchParams = useSearchParams()

  const redirectTo = useMemo(() => {
    const v = searchParams.get('redirectTo')
    if (!v) return '/'
    if (!v.startsWith('/')) return '/'
    if (v.startsWith('//')) return '/'
    return v
  }, [searchParams])

  const authError = searchParams.get('error')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(authError === 'auth' ? 'ההתחברות נכשלה. נסו שוב.' : '')

  async function signInWithGoogle() {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
        },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message || '')
          : 'התחברות נכשלה'
      setError(msg || 'התחברות נכשלה')
      setLoading(false)
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        paddingTop: 'calc(32px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
        background: theme.colors.background,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '28px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <Image
            src="/apple-icon.png"
            alt="במקור"
            width={72}
            height={72}
            priority
            style={{ borderRadius: theme.radius.lg }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 700,
              color: theme.colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            במקור
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            width: '100%',
            maxWidth: '320px',
            minHeight: '48px',
            padding: '12px 20px',
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.surface,
            color: theme.colors.textPrimary,
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: theme.shadows.sm,
            opacity: loading ? 0.75 : 1,
          }}
        >
          <GoogleIcon />
          {loading ? 'מפנים ל-Google…' : 'התחבר עם Google'}
        </button>

        {error ? (
          <p style={{ margin: 0, fontSize: '14px', color: theme.colors.error, textAlign: 'center' }}>
            {error}
          </p>
        ) : null}

        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: theme.colors.textMuted,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          מערכת ניהול תקלות לבניינים
        </p>
      </div>
    </div>
  )
}
