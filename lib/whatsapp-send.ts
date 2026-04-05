

export async function sendWhatsAppTextMessage(to: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken) {
    throw new Error('Missing WHATSAPP_ACCESS_TOKEN')
  }

  if (!phoneNumberId) {
    throw new Error('Missing WHATSAPP_PHONE_NUMBER_ID')
  }

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          body,
        },
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`)
  }

  return data
}
