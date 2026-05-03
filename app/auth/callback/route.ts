import { NextResponse, type NextRequest } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getPublicSiteUrlFromHeaders } from '@/lib/site-url'

function sanitizeNext(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//')) return '/'
  return raw
}

/**
 * OAuth PKCE: Google מחזיר לכאן עם ?code= — מחליפים לסשן ומפנים ליעד הבטוח.
 * יש להוסיף ב-Supabase Dashboard → Authentication → URL configuration:
 * Redirect URLs: https://<your-domain>/auth/callback
 */
export async function GET(request: NextRequest) {
  const hdrs = await headers()
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = sanitizeNext(url.searchParams.get('next'))
  const siteBase = getPublicSiteUrlFromHeaders(hdrs)
  const origin = siteBase || url.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
