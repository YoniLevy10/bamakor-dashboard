import { fetchWithTimeout } from '@/lib/fetch-timeout'

type WhatsAppTemplateComponent = {
  type: string
  parameters?: Array<{
    type: 'text'
    text: string
  }>
}

/** Send using explicit Meta credentials (e.g. from Supabase `clients` row). */
export async function sendRawWhatsAppPayloadWithCredentials(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>
) {
  const response = await fetchWithTimeout(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        ...payload,
      }),
    }
  )
  if (!response) return null

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`)
  }

  return data
}

export async function sendWhatsAppTextMessageWithCredentials(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string
) {
  return sendRawWhatsAppPayloadWithCredentials(phoneNumberId, accessToken, {
    to,
    type: 'text',
    text: {
      body,
    },
  })
}

type WhatsAppCredentials = {
  phoneNumberId?: string
  accessToken?: string
}

async function sendRawWhatsAppPayload(payload: Record<string, unknown>, creds?: WhatsAppCredentials) {
  const accessToken = creds?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = creds?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken) {
    throw new Error('Missing WHATSAPP_ACCESS_TOKEN')
  }

  if (!phoneNumberId) {
    throw new Error('Missing WHATSAPP_PHONE_NUMBER_ID')
  }

  const response = await fetchWithTimeout(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        ...payload,
      }),
    }
  )
  if (!response) return null

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`)
  }

  return data
}

export async function sendWhatsAppTextMessage(
  to: string,
  body: string,
  creds?: WhatsAppCredentials
) {
  console.log('📤 Sending WhatsApp text message to:', to)

  return sendRawWhatsAppPayload({
    to,
    type: 'text',
    text: {
      body,
    },
  }, creds)
}

export async function sendWhatsAppTemplateMessage(
  to: string,
  templateName: string,
  bodyParams: string[] = [],
  languageCode = 'he'
) {
  console.log('📤 Sending WhatsApp template message to:', to, 'template:', templateName)

  const components: WhatsAppTemplateComponent[] = []

  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({
        type: 'text',
        text,
      })),
    })
  }

  return sendRawWhatsAppPayload({
    to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components,
    },
  })
}

export async function sendWhatsAppTextWithTemplateFallback(
  to: string,
  body: string,
  templateName: string,
  templateParams: string[] = [],
  languageCode = 'he'
) {
  try {
    return await sendWhatsAppTextMessage(to, body)
  } catch (error: unknown) {
    const errorText = String((error instanceof Error ? error.message : error) || '')

    const is24HourWindowError =
      errorText.includes('131047') ||
      errorText.toLowerCase().includes('re-engagement message') ||
      errorText.toLowerCase().includes('more than 24 hours have passed')

    if (!is24HourWindowError) {
      throw error
    }

    console.warn('⚠️ 24h window blocked text message, falling back to template:', templateName)

    return sendWhatsAppTemplateMessage(to, templateName, templateParams, languageCode)
  }
}

