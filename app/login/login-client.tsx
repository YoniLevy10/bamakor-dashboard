'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { AppShell, Card, Button, theme } from '@/app/components/ui'

export function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const redirectTo = useMemo(() => {
    const v = searchParams.get('redirectTo')
    if (!v) return '/'
    if (!v.startsWith('/')) return '/'
    if (v.startsWith('//')) return '/'
    return v
  }, [searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const e1 = email.trim()
    if (!e1 || !password) {
      setError('נא להזין אימייל וסיסמה')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: e1,
        password,
      })
      if (signInError) throw signInError
      router.replace(redirectTo)
      router.refresh()
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message || '')
          : 'התחברות נכשלה'
      setError(msg || 'התחברות נכשלה')
    }
    setLoading(false)
  }

  return (
    <AppShell isMobile={false}>
      <div
        style={{
          minHeight: 'calc(100vh - 40px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 16px',
        }}
      >
        <Card
          title="התחברות"
          subtitle="כניסה למערכת במקור"
          style={{ width: '100%', maxWidth: '420px' }}
        >
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: theme.colors.textSecondary }}>
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                dir="ltr"
                style={{
                  padding: '12px 14px',
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.surface,
                  fontSize: '15px',
                  color: theme.colors.textPrimary,
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: theme.colors.textSecondary }}>
                סיסמה
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                dir="ltr"
                style={{
                  padding: '12px 14px',
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.surface,
                  fontSize: '15px',
                  color: theme.colors.textPrimary,
                }}
              />
            </div>

            {error ? <div style={{ color: theme.colors.error, fontSize: '14px' }}>{error}</div> : null}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button variant="primary" type="submit" loading={loading}>
                התחבר
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  )
}

