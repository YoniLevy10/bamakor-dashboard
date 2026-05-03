type LogMeta = Record<string, unknown>

function line(level: 'info' | 'error', msg: string, meta?: LogMeta) {
  const ts = new Date().toISOString()
  const payload =
    meta && Object.keys(meta).length > 0 ? JSON.stringify({ level, msg, ts, ...meta }) : JSON.stringify({ level, msg, ts })

  if (level === 'error') {
    console.error(payload)
  } else {
    console.log(payload)
  }
}

/**
 * Structured single-line logs (Monitoring / dashboards friendly).
 */
export const logger = {
  info(msg: string, meta?: LogMeta): void {
    line('info', msg, meta)
  },
  error(msg: string, err?: unknown, meta?: LogMeta): void {
    const error =
      err instanceof Error ? { message: err.message, stack: err.stack } : err !== undefined ? { detail: String(err) } : undefined
    line('error', msg, error ? { ...meta, error } : meta)
  },
}
