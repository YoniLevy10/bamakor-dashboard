import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkAuthenticatedPostRouteLimit } from '@/lib/rate-limit'
import { requireSessionClientId } from '@/lib/api-auth'
import { getLogger, getAuditLogger } from '@/lib/logging'

const BUCKET = 'client-logos'

export async function POST(req: Request) {
  const logger = getLogger()
  const audit = getAuditLogger()
  const requestId = `upload-logo-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response
    const clientId = auth.ctx.clientId

    const admin = getSupabaseAdmin()
    const rl = await checkAuthenticatedPostRouteLimit(admin, auth.ctx.userId, 'settings-upload-logo')
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId }, { status: 429 })
    }

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'חסר קובץ', requestId }, { status: 400 })
    }

    const mime = (file as Blob).type || 'application/octet-stream'
    const size = (file as Blob).size || 0
    const MAX = 2 * 1024 * 1024 // 2MB
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp'])
    if (!allowed.has(mime)) {
      return NextResponse.json({ error: 'סוג קובץ לא נתמך (PNG/JPEG/WEBP בלבד)', requestId }, { status: 400 })
    }
    if (size <= 0 || size > MAX) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 2MB)', requestId }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('png') ? 'png' : 'webp'
    const path = `${clientId}/logo-${Date.now()}.${ext}`

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: true,
    })

    if (upErr) {
      logger.error('SETTINGS', 'Logo upload failed', new Error(upErr.message), { requestId, clientId })
      audit.logFailedOperation('UPLOAD', 'CLIENT_LOGO', clientId, clientId, upErr.message)
      return NextResponse.json({ error: 'העלאה נכשלה', requestId }, { status: 500 })
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)

    audit.logAction('UPLOAD', 'CLIENT_LOGO', clientId, clientId, 'dashboard')
    return NextResponse.json({ url: pub.publicUrl, requestId })
  } catch (e) {
    console.error('[settings/upload-logo]', e)
    logger.error('SETTINGS', 'Unhandled upload-logo error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'internal', requestId }, { status: 500 })
  }
}
