/** True when PostgREST/Postgres indicates a table or column is missing (migrations not applied). */
export function isRelationMissingError(err: { code?: string; message?: string; details?: string } | null): boolean {
  if (!err) return false
  const m = `${err.message || ''} ${err.details || ''}`.toLowerCase()
  const c = String(err.code || '')
  return (
    c === '42P01' ||
    c === 'PGRST205' ||
    m.includes('does not exist') ||
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}

export function isPendingResidentsTableError(err: { message?: string } | null): boolean {
  if (!err?.message) return false
  const m = err.message.toLowerCase()
  return m.includes('pending_resident_join_requests')
}

/** GET /api/pending-residents: treat as "no rows" when migration 015 was not applied. */
export function pendingResidentsQueryUnavailable(
  err: { code?: string; message?: string; statusCode?: string; details?: string } | null
): boolean {
  if (!err) return false
  if (isPendingResidentsTableError(err)) return true
  if (isRelationMissingError(err)) return true
  if (String(err.statusCode || '') === '404') return true
  if ((err as { status?: number }).status === 404) return true
  return false
}
