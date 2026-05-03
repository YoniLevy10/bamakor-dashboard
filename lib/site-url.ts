/**
 * Canonical site URL for redirects / absolute links (prefer env in prod).
 */

type HeaderLike = { get(name: string): string | null }

export function getPublicSiteUrlFromHeaders(headers?: HeaderLike): string {
  const env = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') : ''
  if (env) return env

  if (!headers) return ''

  const proto = headers.get('x-forwarded-proto') || 'https'
  const host =
    headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headers.get('host')?.trim() ||
    ''
  if (!host) return ''

  return `${proto}://${host}`.replace(/\/$/, '')
}
