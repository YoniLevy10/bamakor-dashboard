import { NextResponse } from 'next/server'
import { requireSessionClientId } from '@/lib/api-auth'
import { pushSubscribeBodySchema } from '@/lib/api-body-schemas'
import { checkAuthenticatedPostRouteLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response

    const { admin, clientId, userId } = auth.ctx
    const rl = await checkAuthenticatedPostRouteLimit(admin, userId, 'push-subscribe')
    if (rl.isLimited) {
      return NextResponse.json({ error: 'יותר מדי בקשות. נסו שוב בעוד דקה.' }, { status: 429 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'גוף לא תקין' }, { status: 400 })
    }

    const parsed = pushSubscribeBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const sub = parsed.data.subscription
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
  } catch (e) {
    console.error('[push/subscribe]', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
