/**
 * Flow coverage:
 * - Duplicate webhook (same dedupe id / Postgres 23505) exits before side effects — no double tickets / mixed welcome.
 * Additional behaviour is covered in lib/*.test.ts (dedupe ids, address-like heuristics).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const sendWhatsApp = vi.fn()

vi.mock('@/lib/whatsapp-send', () => ({
  sendWhatsAppTextMessage: (...args: unknown[]) => sendWhatsApp(...args),
}))

vi.mock('@/lib/sms-send', () => ({
  sendManagerSMS: vi.fn(),
  sendWorkerSMS: vi.fn(),
  getManagerPhoneFromEnv: vi.fn(),
}))

vi.mock('@/lib/whatsapp-media', () => ({
  downloadWhatsAppMedia: vi.fn(),
  uploadWhatsAppMediaToStorage: vi.fn(),
  createAttachmentRecord: vi.fn(),
}))

vi.mock('@/lib/pending-resident-from-ticket', () => ({
  queuePendingResidentApproval: vi.fn().mockResolvedValue(false),
}))

const processedIds = new Set<string>()

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'processed_webhooks') {
        return {
          insert: (row: { message_id: string }) => {
            if (processedIds.has(row.message_id)) {
              return Promise.resolve({ error: { code: '23505' } })
            }
            processedIds.add(row.message_id)
            return Promise.resolve({ error: null })
          },
        }
      }
      throw new Error(`tests/whatsapp-webhook.post: unexpected table ${table}`)
    },
  }),
}))

function minimalTextPayload(messageId: string | undefined) {
  const msg: Record<string, unknown> = {
    from: '972501234567',
    type: 'text',
    text: { body: 'שלום בדיקת כפילות' },
  }
  if (messageId !== undefined) {
    msg.id = messageId
  }
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'pnid-test-1' },
              messages: [msg],
            },
          },
        ],
      },
    ],
  }
}

describe('POST /api/webhook/whatsapp — duplicate delivery', () => {
  const prev = {
    BAMAKOR_CLIENT_ID: process.env.BAMAKOR_CLIENT_ID,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  }

  beforeEach(() => {
    processedIds.clear()
    sendWhatsApp.mockClear()
    process.env.BAMAKOR_CLIENT_ID = 'test-client-id'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
    process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify'
  })

  afterEach(() => {
    process.env.BAMAKOR_CLIENT_ID = prev.BAMAKOR_CLIENT_ID
    process.env.NEXT_PUBLIC_SUPABASE_URL = prev.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = prev.SUPABASE_SERVICE_ROLE_KEY
    process.env.WHATSAPP_VERIFY_TOKEN = prev.WHATSAPP_VERIFY_TOKEN
  })

  it('POST with message id already in processed_webhooks is ignored and sends no WhatsApp replies', async () => {
    processedIds.add('wamid.ALREADY_IN_DB')
    const { POST } = await import('@/app/api/webhook/whatsapp/route')
    const payload = minimalTextPayload('wamid.ALREADY_IN_DB')

    const res = await POST(
      new NextRequest('http://localhost/api/webhook/whatsapp', { method: 'POST', body: JSON.stringify(payload) })
    )

    expect(res.status).toBe(200)
    expect(sendWhatsApp).not.toHaveBeenCalled()
  })
})
