export type ParsedWhatsAppMessage = {
  from: string
  messageType: string
  textBody: string
  mediaId?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document'
}

export function parseIncomingWhatsAppMessage(body: unknown): ParsedWhatsAppMessage | null {
  const bodyRecord = body as Record<string, unknown>
  const entry = (bodyRecord.entry as unknown[])?.[0] as Record<string, unknown>
  const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
  const value = change?.value as Record<string, unknown>
  const message = (value?.messages as unknown[])?.[0] as Record<string, unknown>

  if (!message) return null

  const result: ParsedWhatsAppMessage = {
    from: String(message?.from || ''),
    messageType: String(message?.type || ''),
    textBody: String((message?.text as Record<string, unknown>)?.body || '').trim(),
  }

  // Extract media information if present
  if (message?.type === 'image' && (message?.image as Record<string, unknown>)?.id) {
    result.mediaId = String((message.image as Record<string, unknown>).id)
    result.mediaType = 'image'
  } else if (message?.type === 'audio' && (message?.audio as Record<string, unknown>)?.id) {
    result.mediaId = String((message.audio as Record<string, unknown>).id)
    result.mediaType = 'audio'
  } else if (message?.type === 'video' && (message?.video as Record<string, unknown>)?.id) {
    result.mediaId = String((message.video as Record<string, unknown>).id)
    result.mediaType = 'video'
  } else if (message?.type === 'document' && (message?.document as Record<string, unknown>)?.id) {
    result.mediaId = String((message.document as Record<string, unknown>).id)
    result.mediaType = 'document'
  }

  return result
}
