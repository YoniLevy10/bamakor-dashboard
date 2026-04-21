/**
 * Public app URL for SMS / deep links. Set NEXT_PUBLIC_APP_URL in .env.local and Vercel
 * (e.g. https://bamakor.vercel.app). Trimmed; trailing slash stripped before appending paths.
 */
export function getPublicTicketsUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set')
  }
  return `${base}/tickets`
}
