import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSingletonClientId } from '@/lib/singleton-client-server'

const BUCKET = 'client-logos'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const rawClientId = formData.get('client_id')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'חסר קובץ' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const clientId =
      typeof rawClientId === 'string' && rawClientId.trim()
        ? rawClientId.trim()
        : await getSingletonClientId(admin)
    const buf = Buffer.from(await file.arrayBuffer())
    const mime = (file as Blob).type || 'image/png'
    const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'png'
    const path = `${clientId}/logo-${Date.now()}.${ext}`

    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: true,
    })

    if (upErr) {
      return NextResponse.json(
        { error: `העלאה נכשלה: ${upErr.message}. ודאו שקיימת bucket: ${BUCKET}` },
        { status: 500 }
      )
    }

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({ url: pub.publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
