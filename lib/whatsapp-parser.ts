export type ParsedWhatsAppMessage = {
  from: string
  messageType: string
  textBody: string
}

export function parseIncomingWhatsAppMessage(body: any): ParsedWhatsAppMessage | null {
  const value = body?.entry?.[0]?.changes?.[0]?.value
  const message = value?.messages?.[0]

  if (!message) return null

  return {
    from: message?.from || '',
    messageType: message?.type || '',
    textBody: message?.text?.body?.trim() || '',
  }
}
