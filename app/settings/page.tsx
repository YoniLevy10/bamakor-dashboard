'use client'

/**
 * Settings: Next.js 16 / React 19 / TypeScript / Supabase / inline CSS (theme from ui), RTL Hebrew UI.
 * Style aligned with app/projects/page.tsx — Card, Button, theme.colors, form patterns.
 * WhatsApp credentials are stored in Supabase `clients` (not .env); env vars remain read-only at runtime for server defaults elsewhere.
 */

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, asyncHandler } from '@/lib/error-handler'
import {
  AppShell,
  MobileHeader,
  MobileMenu,
  PageHeader,
  Card,
  Button,
  LoadingSpinner,
  theme,
} from '../components/ui'

type ClientRow = {
  id: string
  manager_phone?: string | null
  default_worker_phone?: string | null
  sms_on_ticket_open?: boolean | null
  sms_on_ticket_close?: boolean | null
  whatsapp_phone_number_id?: string | null
  whatsapp_access_token?: string | null
}

const TABS = [
  { id: 'notifications', label: 'התראות' },
  { id: 'whatsapp', label: 'וואטסאפ / הטמעה' },
] as const

type TabId = (typeof TABS)[number]['id']

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as TabId | null
  const activeTab: TabId =
    tabFromUrl && TABS.some((t) => t.id === tabFromUrl) ? tabFromUrl : 'notifications'

  function goTab(id: TabId) {
    router.replace(`/settings?tab=${encodeURIComponent(id)}`, { scroll: false })
  }

  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const [clientId, setClientId] = useState<string>('')
  const [client, setClient] = useState<ClientRow | null>(null)

  const [managerPhone, setManagerPhone] = useState('')
  const [defaultWorkerPhone, setDefaultWorkerPhone] = useState('')
  const [smsOnOpen, setSmsOnOpen] = useState(true)
  const [smsOnClose, setSmsOnClose] = useState(true)

  const [waPhoneNumberId, setWaPhoneNumberId] = useState('')
  const [waAccessToken, setWaAccessToken] = useState('')
  const [waTokenLoaded, setWaTokenLoaded] = useState(false)

  const [savingNotifications, setSavingNotifications] = useState(false)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [testingWa, setTestingWa] = useState(false)

  const [origin, setOrigin] = useState('')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only origin for webhook URL
    setOrigin(typeof window !== 'undefined' ? window.location.origin : '')
  }, [])

  const webhookUrl = useMemo(
    () => (origin ? `${origin}/api/webhook/whatsapp` : '/api/webhook/whatsapp'),
    [origin]
  )

  async function resolveBamakorClientId(): Promise<string> {
    const envClientId = process.env.NEXT_PUBLIC_BAMAKOR_CLIENT_ID
    if (envClientId) return envClientId

    // Dev-only fallback (keeps single-tenant DX when env isn't set)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_BAMAKOR_CLIENT_ID is not set')
    }

    const { data: rows, error } = await supabase
      .from('clients')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) throw error
    const firstId = (rows as Array<{ id?: string }> | null)?.[0]?.id
    if (!firstId) throw new Error('לא נמצא רשומת לקוח')
    return firstId
  }

  async function load() {
    setLoading(true)
    await asyncHandler(
      async () => {
        const resolvedClientId = await resolveBamakorClientId()

        const { data: row, error: cErr } = await supabase
          .from('clients')
          .select('id, manager_phone, default_worker_phone, sms_on_ticket_open, sms_on_ticket_close, whatsapp_phone_number_id, whatsapp_access_token')
          .eq('id', resolvedClientId)
          .maybeSingle()

        if (cErr) throw cErr
        if (!row?.id) throw new Error('לא נמצא רשומת לקוח')

        setClientId(row.id)
        setClient(row)

        setManagerPhone(row.manager_phone || '')
        setDefaultWorkerPhone(row.default_worker_phone || '')
        setSmsOnOpen(row.sms_on_ticket_open !== false)
        setSmsOnClose(row.sms_on_ticket_close !== false)

        setWaPhoneNumberId(row.whatsapp_phone_number_id || '')
        setWaAccessToken(row.whatsapp_access_token || '')
        setWaTokenLoaded(true)

        return true
      },
      { context: 'טעינת הגדרות נכשלה — הריצו מיגרציה ל-clients אם עדיין לא', showErrorToast: true }
    )
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from Supabase
    void load()
  }, [])

  async function saveNotifications() {
    if (!clientId) return
    setSavingNotifications(true)
    await asyncHandler(
      async () => {
        const { error } = await supabase
          .from('clients')
          .update({
            manager_phone: managerPhone.trim() || null,
            default_worker_phone: defaultWorkerPhone.trim() || null,
            sms_on_ticket_open: smsOnOpen,
            sms_on_ticket_close: smsOnClose,
          })
          .eq('id', clientId)
        if (error) throw error
        toast.success('נשמר')
        await load()
        return true
      },
      { context: 'שמירה נכשלה', showErrorToast: true }
    )
    setSavingNotifications(false)
  }

  async function saveWhatsapp() {
    if (!clientId) return
    setSavingWhatsapp(true)
    await asyncHandler(
      async () => {
        const payload: Record<string, string | null> = {
          whatsapp_phone_number_id: waPhoneNumberId.trim() || null,
        }
        if (waAccessToken.trim()) {
          payload.whatsapp_access_token = waAccessToken.trim()
        }
        const { error } = await supabase.from('clients').update(payload).eq('id', clientId)
        if (error) throw error
        toast.success('נשמר')
        await load()
        return true
      },
      { context: 'שמירה נכשלה', showErrorToast: true }
    )
    setSavingWhatsapp(false)
  }

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success('הועתק')
    } catch {
      toast.error('העתקה נכשלה')
    }
  }

  async function testWhatsapp() {
    if (!clientId) return
    setTestingWa(true)
    await asyncHandler(
      async () => {
        const res = await fetch('/api/settings/test-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'בדיקה נכשלה')
        toast.success('הודעת בדיקה נשלחה')
        return true
      },
      { context: 'בדיקת וואטסאפ נכשלה', showErrorToast: true }
    )
    setTestingWa(false)
  }

  return (
    <AppShell isMobile={isMobile}>
      {isMobile && (
        <MobileHeader
          title="הגדרות"
          subtitle="העדפות מערכת"
          onMenuClick={() => setMenuOpen(true)}
        />
      )}
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div style={styles.content}>
        {!isMobile && (
          <PageHeader title="הגדרות" subtitle="התראות ווואטסאפ" />
        )}

        {loading ? (
          <div style={styles.loadingContainer}>
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div style={styles.tabBar} role="tablist" aria-label="הגדרות">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => goTab(t.id)}
                  style={{
                    ...styles.tabBtn,
                    ...(activeTab === t.id ? styles.tabBtnActive : {}),
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'notifications' && (
              <Card noPadding>
                <div style={styles.cardInner}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>טלפון מנהל</label>
                    <input
                      type="tel"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      style={styles.input}
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>טלפון עובד ברירת מחדל</label>
                    <input
                      type="tel"
                      value={defaultWorkerPhone}
                      onChange={(e) => setDefaultWorkerPhone(e.target.value)}
                      style={styles.input}
                      placeholder="אופציונלי"
                    />
                  </div>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={smsOnOpen}
                      onChange={(e) => setSmsOnOpen(e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span>שלח SMS בפתיחת תקלה</span>
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={smsOnClose}
                      onChange={(e) => setSmsOnClose(e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span>שלח SMS בסגירת תקלה</span>
                  </label>
                  <div style={styles.drawerActions}>
                    <Button variant="primary" onClick={saveNotifications} loading={savingNotifications}>
                      שמור שינויים
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'whatsapp' && (
              <Card noPadding>
                <div style={styles.cardInner}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>WhatsApp Phone Number ID</label>
                    <input
                      value={waPhoneNumberId}
                      onChange={(e) => setWaPhoneNumberId(e.target.value)}
                      style={styles.input}
                      placeholder="מזהה מספר מטא"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>WhatsApp Access Token</label>
                    <input
                      type="password"
                      value={waAccessToken}
                      onChange={(e) => setWaAccessToken(e.target.value)}
                      style={styles.input}
                      placeholder={waTokenLoaded && client?.whatsapp_access_token ? 'הזינו טוקן חדש להחלפה' : 'הדביקו טוקן ארוך-טווח'}
                      autoComplete="off"
                    />
                    <span style={styles.formHint}>השאירו ריק אם אינכם משנים את הטוקן השמור</span>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Webhook URL (קריאה בלבד)</label>
                    <div style={styles.readonlyRow}>
                      <input readOnly value={webhookUrl} style={{ ...styles.input, flex: 1 }} />
                      <Button variant="secondary" type="button" onClick={copyWebhook}>
                        העתק
                      </Button>
                    </div>
                  </div>
                  <div style={styles.drawerActions}>
                    <Button variant="secondary" type="button" onClick={testWhatsapp} loading={testingWa}>
                      בדוק חיבור
                    </Button>
                    <Button variant="primary" onClick={saveWhatsapp} loading={savingWhatsapp}>
                      שמור שינויים
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppShell isMobile={false}>
          <div style={{ padding: '80px 40px', display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size="lg" />
          </div>
        </AppShell>
      }
    >
      <SettingsPageInner />
    </Suspense>
  )
}

const styles: Record<string, CSSProperties> = {
  content: {
    padding: '32px 40px',
    maxWidth: '900px',
    margin: '0 auto',
    outline: 'none',
    boxShadow: 'none',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '80px 0',
  },
  tabBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '24px',
    position: 'relative',
    zIndex: 2,
  },
  tabBtn: {
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '14px',
    fontWeight: 500,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 2,
  },
  tabBtnActive: {
    border: `1px solid ${theme.colors.primary}`,
    background: theme.colors.primaryMuted,
    color: theme.colors.primary,
  },
  cardInner: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: theme.colors.textSecondary,
  },
  input: {
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    fontSize: '15px',
    color: theme.colors.textPrimary,
  },
  formHint: {
    fontSize: '12px',
    color: theme.colors.textMuted,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    color: theme.colors.textPrimary,
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: theme.colors.primary,
  },
  drawerActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    paddingTop: '16px',
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: '8px',
  },
  readonlyRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
}
