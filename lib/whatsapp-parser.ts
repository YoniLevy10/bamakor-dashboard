export type ParsedWhatsAppMessage = {
  from: string
  messageType: string
  textBody: string
  mediaId?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document'
}

export function parseIncomingWhatsAppMessage(body: any): ParsedWhatsAppMessage | null {
  const value = body?.entry?.[0]?.changes?.[0]?.value
  const message = value?.messages?.[0]

  if (!message) return null

  const result: ParsedWhatsAppMessage = {
    from: message?.from || '',
    messageType: message?.type || '',
    textBody: message?.text?.body?.trim() || '',
  }

  // Extract media information if present
  if (message?.type === 'image' && message?.image?.id) {
    result.mediaId = message.image.id
    result.mediaType = 'image'
  } else if (message?.type === 'audio' && message?.audio?.id) {
    result.mediaId = message.audio.id
    result.mediaType = 'audio'
  } else if (message?.type === 'video' && message?.video?.id) {
    result.mediaId = message.video.id
    result.mediaType = 'video'
  } else if (message?.type === 'document' && message?.document?.id) {
    result.mediaId = message.document.id
    result.mediaType = 'document'
  }

  return result
}
