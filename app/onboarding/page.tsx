'use client'

import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'
import { Card, Button, theme } from '../components/ui'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [workerName, setWorkerName] = useState('')
  const [workerPhone, setWorkerPhone] = useState('')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submitOrg(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שמירה נכשלה')
      setOrganizationId(data.organization_id as string)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function submitProject(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          project_code: projectCode.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שמירה נכשלה')
      void data
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  async function submitWorker(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!workerName.trim()) {
      setStep(4)
      return
    }
    setLoading(true)
    try {
      let oid = organizationId
      if (!oid) {
        const me = await fetch('/api/onboarding/session')
        const mj = await me.json()
        oid = mj.organization_id as string | null
      }
      if (!oid) {
        throw new Error('חסר מזהה ארגון — חזרו לשלב 1')
      }
      const res = await fetch('/api/create-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: workerName.trim(),
          phone: workerPhone.trim() || null,
          organization_id: oid,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שמירה נכשלה')
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  function skipWorker() {
    setStep(4)
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.title}>הגדרת חשבון</h1>
        <p style={styles.sub}>שלב {step} מתוך 4</p>

        {error && (
          <div style={styles.err} role="alert">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card title="שלב 1: הארגון" subtitle="שם החברה או הארגון שלכם">
            <form onSubmit={submitOrg} style={styles.form}>
              <label style={styles.lab}>שם ארגון</label>
              <input
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                style={styles.inp}
                placeholder="לדוגמה: ניהול נכסים בע״מ"
              />
              <Button type="submit" variant="primary" loading={loading}>
                המשך
              </Button>
            </form>
          </Card>
        )}

        {step === 2 && (
          <Card title="שלב 2: פרויקט ראשון" subtitle="בניין או אתר ראשון במערכת">
            <form onSubmit={submitProject} style={styles.form}>
              <label style={styles.lab}>שם פרויקט</label>
              <input
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                style={styles.inp}
                placeholder="לדוגמה: רחוב הרצל 10"
              />
              <label style={styles.lab}>קוד פרויקט (אנגלית ומספרים)</label>
              <input
                required
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                style={styles.inp}
                placeholder="לדוגמה: BMK01"
              />
              <Button type="submit" variant="primary" loading={loading}>
                המשך
              </Button>
            </form>
          </Card>
        )}

        {step === 3 && (
          <Card title="שלב 3: עובד ראשון (אופציונלי)" subtitle="אפשר לדלג ולהוסיף עובדים אחר כך">
            <form onSubmit={submitWorker} style={styles.form}>
              <label style={styles.lab}>שם מלא</label>
              <input
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                style={styles.inp}
                placeholder="שם הטכנאי או העובד"
              />
              <label style={styles.lab}>טלפון</label>
              <input
                value={workerPhone}
                onChange={(e) => setWorkerPhone(e.target.value)}
                style={styles.inp}
                placeholder="05x-xxxxxxx"
              />
              <div style={styles.row}>
                <Button type="button" variant="secondary" onClick={skipWorker}>
                  דילוג
                </Button>
                <Button type="submit" variant="primary" loading={loading}>
                  שמירה והמשך
                </Button>
              </div>
            </form>
          </Card>
        )}

        {step === 4 && (
          <Card title="סיימתם!" subtitle="המערכת מוכנה לשימוש">
            <p style={styles.done}>אפשר להתחיל לנהל תקלות ודיירים מהלוח הראשי.</p>
            <Button variant="primary" onClick={() => router.push('/')}>
              מעבר ללוח הבקרה
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 16px',
    background: theme.colors.background,
  },
  inner: { width: '100%', maxWidth: '480px' },
  title: { fontSize: '26px', fontWeight: 700, margin: '0 0 8px', color: theme.colors.textPrimary },
  sub: { fontSize: '15px', color: theme.colors.textMuted, marginBottom: '24px' },
  err: {
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    background: theme.colors.errorMuted,
    color: theme.colors.error,
    marginBottom: '16px',
    fontSize: '14px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  lab: { fontSize: '13px', fontWeight: 600, color: theme.colors.textSecondary },
  inp: {
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: '15px',
  },
  row: { display: 'flex', gap: '10px', marginTop: '8px' },
  done: { fontSize: '15px', lineHeight: 1.6, color: theme.colors.textSecondary, marginBottom: '20px' },
}
