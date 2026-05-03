/**
 * Multi-tenant: כל טעינה מהדפדפן לטבלאות עם `client_id` — חובה להוסיף `.eq`.
 * כשל בשכחה מסוכן ברמת אפליקציה; בנוסף RLS מהמיגרציה 028 דורשת משתמש `authenticated`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withClientId(query: any, clientId: string | null | undefined): any {
  const id = typeof clientId === 'string' ? clientId.trim() : ''
  if (!id) {
    throw new Error('Tenant scope חסר: client_id')
  }
  return query.eq('client_id', id)
}
