/** Default timeout for browser `fetch` calls (ms). */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000

/**
 * `fetch` with an AbortController timeout. On timeout, rejects with an Error
 * whose message is suitable for user-facing toasts (Hebrew).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error('הבקשה ארכה זמן מדי — נסה שוב')
    }
    throw e
  } finally {
    clearTimeout(id)
  }
}
