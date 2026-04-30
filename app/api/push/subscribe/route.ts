import { NextResponse } from 'next/server'
import { requireSessionClientId } from '@/lib/api-auth'

type Body = { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }

export async function POST(req: Request) {
  const auth = await requireSessionClientId()
  if (!auth.ok) return auth.response

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'גוף לא תקין' }, { status: 400 })
  }

  const sub = body.subscription
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'מנוי לא תקין' }, { status: 400 })
  }

  const { admin, clientId, userId } = auth.ctx
  const subscription = sub as Record<string, unknown>

  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        client_id: clientId,
        user_id: userId,
        subscription,
      },
      { onConflict: 'user_id,client_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'שמירה נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
