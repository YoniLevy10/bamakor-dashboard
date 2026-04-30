import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveClientIdForUserId } from '@/lib/tenant-resolution'

/** משתמש "חדש" להפניה ל-onboarding: נרשם ב־30 הימים האחרונים */
const NEW_USER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes: do not block WhatsApp webhook or login screen
  if (
    pathname.startsWith('/api/webhook/whatsapp') ||
    pathname.startsWith('/api/public/') ||
    pathname.startsWith('/api/worker-auth') ||
    pathname.startsWith('/api/worker/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/report') ||
    pathname === '/worker' ||
    pathname.startsWith('/worker/') ||
    pathname === '/offline.html'
  ) {
    return NextResponse.next()
  }

  // Let Next handle static assets
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.png' ||
    pathname === '/apple-icon.png' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html'
  ) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return res
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceKey && supabaseUrl && !pathname.startsWith('/api/')) {
    try {
      const admin = createClient(supabaseUrl, serviceKey)
      const clientId = await resolveClientIdForUserId(admin, user.id)

      if (!clientId && !pathname.startsWith('/onboarding') && !pathname.startsWith('/login')) {
        const url = req.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }

      if (
        clientId &&
        !pathname.startsWith('/onboarding') &&
        !pathname.startsWith('/login')
      ) {
        const { count, error: cErr } = await admin
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('is_active', true)

        if (cErr) {
          return res
        }

        const createdMs = user.created_at ? new Date(user.created_at).getTime() : 0
        const isNewUser =
          createdMs > 0 && Date.now() - createdMs < NEW_USER_MAX_AGE_MS

        if (isNewUser && (count ?? 0) === 0) {
          const url = req.nextUrl.clone()
          url.pathname = '/onboarding'
          return NextResponse.redirect(url)
        }
      }
    } catch {
      /* ignore onboarding redirect if admin client unavailable */
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

