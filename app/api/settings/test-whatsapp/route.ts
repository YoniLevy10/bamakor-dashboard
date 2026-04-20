import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendWhatsAppTextMessageWithCredentials } from '@/lib/whatsapp-send'

/**
 * Sends a test WhatsApp using credentials stored on `clients` (not .env).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const clientId = body?.client_id as string | undefined

    if (!clientId) {
      return NextResponse.json({ error: 'חסר client_id' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: client, error } = await admin
      .from('clients')
      .select('name, whatsapp_phone_number_id, whatsapp_access_token, manager_phone')
      .eq('id', clientId)
      .single()

    if (error || !client) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
    }

    const phoneNumberId = client.whatsapp_phone_number_id as string | null
    const accessToken = client.whatsapp_access_token as string | null
    const to = (client.manager_phone as string | null)?.trim()

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'נדרשים מזהה מספר וואטסאפ וטוקן בהגדרות' },
        { status: 400 }
      )
    }

    if (!to) {
      return NextResponse.json(
        { error: 'נדרש מספר מנהל בהגדרות (התראות) לשליחת בדיקה' },
        { status: 400 }
      )
    }

    const digits = to.replace(/\D/g, '')
    const waTo =
      digits.startsWith('972') ? digits : digits.startsWith('0') ? `972${digits.slice(1)}` : digits

    await sendWhatsAppTextMessageWithCredentials(
      phoneNumberId,
      accessToken,
      waTo,
      `✅ בדיקת חיבור מהמערכת — ${(client as { name?: string | null }).name || 'המערכת'}`
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
