import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type AuditValues = Record<string, unknown> | null

/**
 * Persists row to audit_log (non-blocking failures are swallowed + console).
 */
export async function logAudit(
  opts: {
    clientId: string | null
    userId: string | null
    action: string
    entityType?: string | null
    entityId?: string | null
    oldValues?: AuditValues
    newValues?: AuditValues
  }
): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('audit_log').insert({
      client_id: opts.clientId,
      user_id: opts.userId,
      action: opts.action,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      old_values: opts.oldValues ?? null,
      new_values: opts.newValues ?? null,
    })
    if (error) {
      console.warn('[audit_log insert]', error.message)
    }
  } catch (e) {
    console.warn('[audit_log]', e instanceof Error ? e.message : String(e))
  }
}
