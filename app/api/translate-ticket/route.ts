import { NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/fetch-timeout'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''

    if (!text || text.length < 2) {
      return NextResponse.json({ error: 'טקסט ריק' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'שרת התרגום לא מוגדר (ANTHROPIC_API_KEY)' },
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
      return NextResponse.json({ error: '⏱️ External API timeout' }, { status: 504 })
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
      error?: { message?: string }
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'שגיאת תרגום' },
        { status: res.status }
      )
    }

    const block = data.content?.[0]
    const translation =
      block?.type === 'text' && block.text ? block.text.trim() : ''

    if (!translation) {
      return NextResponse.json({ error: 'לא התקבל תרגום' }, { status: 502 })
    }

    return NextResponse.json({ translation })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
