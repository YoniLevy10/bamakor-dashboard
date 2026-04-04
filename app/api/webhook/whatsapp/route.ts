import { NextRequest, NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'bamakor_verify_123'

type WhatsAppMessage = {
  from?: string
  id?: string
  timestamp?: string
  type?: string
  text?: {
    body?: string
  }
  image?: {
    id?: string
    mime_type?: string
    caption?: string
  }
  audio?: {
    id?: string
    mime_type?: string
    voice?: boolean
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('🔐 Webhook GET verification request received')
  console.log('🔎 Mode:', mode)
  console.log('🔎 Token received:', token)

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verification success')
    return new NextResponse(challenge || 'OK', { status: 200 })
  }

  console.log('❌ Webhook verification failed')
  return new NextResponse('Verification failed', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('✅ WEBHOOK VERSION 2 ACTIVE')
    console.log('📩 WhatsApp webhook payload:', JSON.stringify(body, null, 2))

    const value = body?.entry?.[0]?.changes?.[0]?.value
    const message: WhatsAppMessage | undefined = value?.messages?.[0]

    if (!message) {
      console.log('ℹ️ No incoming user message in payload')
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const from = message.from || ''
    const messageType = message.type || ''
    const phoneNumberId = value?.metadata?.phone_number_id || ''
    const displayPhoneNumber = value?.metadata?.display_phone_number || ''

    console.log('🔍 Entering message type handler')
    console.log('📞 From:', from)
    console.log('📱 Business Number:', displayPhoneNumber)
    console.log('🏢 Phone Number ID:', phoneNumberId)
    console.log('🧩 Message Type:', messageType)

    if (messageType === 'text') {
      const textBody = message.text?.body?.trim() || ''

      console.log('💬 Message body:', textBody)

      if (!textBody) {
        console.log('⚠️ Empty text message received')
        return NextResponse.json({ received: true }, { status: 200 })
      }

      if (textBody.toUpperCase().startsWith('START_')) {
        const projectCode = textBody.replace(/^START_/i, '').trim().toUpperCase()

        console.log('🚀 Start flow detected')
        console.log('🏗️ Project code:', projectCode)
        console.log('📝 Next step: link this sender to project session')

        return NextResponse.json(
          {
            received: true,
            type: 'start_flow',
            from,
            projectCode,
          },
          { status: 200 }
        )
      }

      console.log('🛠️ Treating text as issue description')
      console.log('📝 Next step: create ticket for active session')

      return NextResponse.json(
        {
          received: true,
          type: 'issue_description',
          from,
          textBody,
        },
        { status: 200 }
      )
    }

    if (messageType === 'image') {
      const imageId = message.image?.id || ''
      const mimeType = message.image?.mime_type || ''
      const caption = message.image?.caption || ''

      console.log('🖼️ Image received')
      console.log('🆔 Image ID:', imageId)
      console.log('📎 MIME type:', mimeType)
      console.log('📝 Caption:', caption)
      console.log('⏭️ Next step: optionally download media and attach to ticket')

      return NextResponse.json(
        {
          received: true,
          type: 'image',
          from,
          imageId,
          mimeType,
          caption,
        },
        { status: 200 }
      )
    }

    if (messageType === 'audio') {
      const audioId = message.audio?.id || ''
      const mimeType = message.audio?.mime_type || ''
      const isVoice = Boolean(message.audio?.voice)

      console.log('🎤 Audio received')
      console.log('🆔 Audio ID:', audioId)
      console.log('📎 MIME type:', mimeType)
      console.log('🗣️ Voice note:', isVoice)
      console.log('⏭️ Next step: optionally download media / transcribe / attach to ticket')

      return NextResponse.json(
        {
          received: true,
          type: 'audio',
          from,
          audioId,
          mimeType,
          isVoice,
        },
        { status: 200 }
      )
    }

    console.log('❓ Unsupported message type received:', messageType)

    return NextResponse.json(
      {
        received: true,
        type: 'unsupported',
        from,
        messageType,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 500 })
  }
}

