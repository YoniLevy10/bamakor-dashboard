import { NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/fetch-timeout'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimitDistributed } from '@/lib/api-validation'
import { getLogger } from '@/lib/logging'
import { requireSessionClientId } from '@/lib/api-auth'

export async function POST(req: Request) {
  const logger = getLogger()
  const requestId = `translate-${Date.now()}`
  try {
    const auth = await requireSessionClientId()
    if (!auth.ok) return auth.response

    // Rate limit (protects external API spend)
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || 'unknown'
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const rl = await checkRateLimitDistributed({
        supabaseAdmin,
        key: `ip:${ip}:translate-ticket`,
        windowMs: 60_000,
        maxRequests: 20,
      })
      if (rl.isLimited) {
        return NextResponse.json(
          { error: 'יותר מדי בקשות. נסו שוב בעוד דקה.', requestId },
          { status: 429 }
        )
      }
    } catch (e) {
      // If env is misconfigured, do not block translation. Log only.
      logger.warn('TRANSLATE_API', 'Rate limit check failed (non-blocking)', {
        requestId,
        error: e instanceof Error ? e.message : String(e),
      })
    }

    const body = await req.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''

    if (!text || text.length < 2) {
      return NextResponse.json({ error: 'טקסט ריק', requestId }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'שרת התרגום לא זמין כרגע.', requestId },
        { status: 503 }
      )
    }

    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `תרגם את הטקסט הבא לעברית:\n\n${text}`,
          },
        ],
      }),
    })
    if (!res) {
      return NextResponse.json({ error: '⏱️ External API timeout', requestId }, { status: 504 })
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
      error?: { message?: string }
    }

    if (!res.ok) {
      logger.warn('TRANSLATE_API', 'Anthropic error', {
        requestId,
        status: res.status,
        message: data.error?.message,
      })
      return NextResponse.json(
        { error: 'שגיאת תרגום', requestId },
        { status: res.status }
      )
    }

    const block = data.content?.[0]
    const translation =
      block?.type === 'text' && block.text ? block.text.trim() : ''

    if (!translation) {
      return NextResponse.json({ error: 'לא התקבל תרגום', requestId }, { status: 502 })
    }

    return NextResponse.json({ translation, requestId })
  } catch (e) {
    logger.error('TRANSLATE_API', 'Unhandled error', e instanceof Error ? e : new Error(String(e)), { requestId })
    return NextResponse.json({ error: 'Server error', requestId }, { status: 500 })
  }
}
