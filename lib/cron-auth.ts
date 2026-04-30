import { type NextRequest } from 'next/server'

/** Vercel Cron and manual triggers: Authorization Bearer CRON_SECRET */
export function verifyCronRequest(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (bearer === secret) return true
  const q = req.nextUrl.searchParams.get('secret')
  return q === secret
}
