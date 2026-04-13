/**
 * 019SMS notification service for internal staff
 * 
 * ARCHITECTURE:
 * - Residents: WhatsApp (conversation flow) - UNCHANGED
 * - Workers: SMS via 019SMS (internal notifications)
 * - Manager: SMS via 019SMS (internal notifications)
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - SMS_019_API_TOKEN: Bearer token for API authentication
 * - SMS_019_USERNAME: Account username (used in XML payload)
 * - SMS_019_SENDER: Source identifier (max 11 chars, no +, numeric + letters only)
 * 
 * OFFICIAL 019SMS API:
 * - Endpoint: POST https://019sms.co.il/api
 * - Auth: Bearer token in Authorization header
 * - Format: XML request and response
 * - Success: status code 0 in response
 * - Phone format: 5xxxxxxx or 05xxxxxxx (Israeli format)
 * 
 * This module handles outbound SMS to internal staff ONLY via 019SMS.
 * Resident communication remains on WhatsApp via Meta/Facebook.
 */

// 019SMS Configuration
const SMS_019_ENDPOINT = 'https://019sms.co.il/api'
const SMS_019_API_TOKEN = process.env.SMS_019_API_TOKEN
const SMS_019_USERNAME = process.env.SMS_019_USERNAME
const SMS_019_SENDER = process.env.SMS_019_SENDER || '0559899132'

/**
 * Normalize phone number to 019SMS format
 * Required format: 5xxxxxxx or 05xxxxxxx (Israeli phone numbers)
 * 
 * Converts:
 * - +972... → 05... (removes country code, adds leading 0)
 * - 972... → 05... (converts 972 prefix to 05)
 * - 08/09... → 05... (converts to standard format)
 * - Removes spaces and dashes
 * 
 * Result: Always 8 digits with leading 0 (05xxxxxxx format)
 */
function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''
  
  let normalized = phoneNumber.replace(/\s|-/g, '') // Remove spaces and dashes
  
  // Remove leading + if present
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1)
  }
  
  // Convert 972 country code to 0 prefix
  if (normalized.startsWith('972')) {
    normalized = '0' + normalized.substring(3)
  }
  
  // Ensure format is 05xxxxxxx or 05xxxxxxxx (8-9 digits after 0)
  // Handle edge cases like 08 or 09 by converting to 05
  if (normalized.startsWith('08') || normalized.startsWith('09')) {
    normalized = '05' + normalized.substring(2)
  }
  
  // Validate format: must start with 05 and have 8+ digits total
  if (!/^05\d{7,}$/.test(normalized)) {
    return '' // Invalid format
  }
  
  return normalized
}

/**
 * Parse XML response from 019SMS API
 * Response format:
 * <sms>
 *   <status>0</status>
 *   <message>SMS will be sent</message>
 *   <shipment_id>xxxxx</shipment_id>
 * </sms>
 */
function parseXMLResponse(xmlText: string): { status: number; message: string; shipmentId: string } {
  try {
    // Extract status code
    const statusMatch = xmlText.match(/<status>(\d+)<\/status>/)
    const status = statusMatch ? parseInt(statusMatch[1]) : -1

    // Extract message
    const messageMatch = xmlText.match(/<message>(.+?)<\/message>/)
    const message = messageMatch ? messageMatch[1] : ''

    // Extract shipment ID
    const shipmentMatch = xmlText.match(/<shipment_id>(.+?)<\/shipment_id>/)
    const shipmentId = shipmentMatch ? shipmentMatch[1] : ''

    return { status, message, shipmentId }
  } catch {
    return { status: -1, message: 'Failed to parse response', shipmentId: '' }
  }
}

/**
 * Build XML payload for 019SMS API
 * Per docs: https://docs.019sms.co.il/sms/send-sms.html
 * 
 * Required fields:
 * - username: account username
 * - source: sender ID (phone or string, max 11 chars, numeric/letters only, no +)
 * - destinations: contains phone elements
 * - phone: recipient in format 5xxxxxxx or 05xxxxxxx
 * - message: SMS text (max 1005 chars)
 */
function buildSMSPayload(username: string, source: string, destination: string, smsMessage: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sms>
    <user>
        <username>${username}</username>
    </user>
    <source>${source}</source>
    <destinations>
        <phone>${destination}</phone>
    </destinations>
    <message>${smsMessage}</message>
</sms>`
}

/**
 * Send SMS to worker via 019SMS
 * Used when: Worker is assigned to a ticket
 * 
 * API Spec:
 * - Endpoint: POST https://019sms.co.il/api
 * - Auth: Bearer token in Authorization header
 * - Format: XML
 * - Success: status 0
 */
export async function sendWorkerSMS(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    if (!phoneNumber) {
      console.error('❌ SMS_SEND_FAILURE: phoneNumber is missing')
      return false
    }

    if (!message) {
      console.error('❌ SMS_SEND_FAILURE: message is empty')
      return false
    }

    const isProduction = process.env.NODE_ENV === 'production'

    // Development mode: log only if no token
    if (!isProduction && !SMS_019_API_TOKEN) {
      console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode (missing credentials)')
      console.log('📱 SMS_WORKER_RECIPIENT:', phoneNumber)
      console.log('📱 SMS_WORKER_MESSAGE_LENGTH:', message.length)
      return true
    }

    // Production mode: require token
    if (!SMS_019_API_TOKEN) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS token not configured (SMS_019_API_TOKEN missing)')
      return false
    }

    if (!SMS_019_USERNAME) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS username not configured (SMS_019_USERNAME missing)')
      return false
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber)
    if (!normalizedPhone) {
      console.error('❌ SMS_SEND_FAILURE: phoneNumber could not be normalized to 019SMS format', { 
        originalPhone: phoneNumber,
        hint: 'Expected format: 5xxxxxxx or 05xxxxxxx'
      })
      return false
    }

    console.log('📱 SMS_SEND_START: Sending SMS to worker via 019SMS', {
      normalizedPhone,
      source: SMS_019_SENDER,
      messageLength: message.length,
    })

    const payload = buildSMSPayload(SMS_019_USERNAME, SMS_019_SENDER, normalizedPhone, message)

    const response = await fetch(SMS_019_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${SMS_019_API_TOKEN}`,
      },
      body: payload,
    })

    const responseText = await response.text()
    const { status, message: responseMessage, shipmentId } = parseXMLResponse(responseText)

    if (!response.ok) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS API returned non-200 HTTP status', {
        httpStatus: response.status,
        statusText: response.statusText,
        normalizedPhone,
      })
      return false
    }

    if (status !== 0) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS API returned non-zero status code', {
        status,
        message: responseMessage,
        normalizedPhone,
      })
      return false
    }

    console.log('✅ SMS_WORKER_SENT: SMS sent successfully to worker via 019SMS', {
      normalizedPhone,
      shipmentId,
      source: SMS_019_SENDER,
    })

    return true
  } catch (err) {
    console.error('❌ SMS_SEND_FAILURE: Unexpected error sending worker SMS', {
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

/**
 * Send SMS to manager via 019SMS
 * Used when: New ticket created, important status changes
 * 
 * API Spec:
 * - Endpoint: POST https://019sms.co.il/api
 * - Auth: Bearer token in Authorization header
 * - Format: XML
 * - Success: status 0
 */
export async function sendManagerSMS(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    if (!phoneNumber) {
      console.error('❌ SMS_SEND_FAILURE: phoneNumber is missing')
      return false
    }

    if (!message) {
      console.error('❌ SMS_SEND_FAILURE: message is empty')
      return false
    }

    const isProduction = process.env.NODE_ENV === 'production'

    // Development mode: log only if no token
    if (!isProduction && !SMS_019_API_TOKEN) {
      console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode (missing credentials)')
      console.log('📱 SMS_MANAGER_RECIPIENT:', phoneNumber)
      console.log('📱 SMS_MANAGER_MESSAGE_LENGTH:', message.length)
      return true
    }

    // Production mode: require token
    if (!SMS_019_API_TOKEN) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS token not configured (SMS_019_API_TOKEN missing)')
      return false
    }

    if (!SMS_019_USERNAME) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS username not configured (SMS_019_USERNAME missing)')
      return false
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber)
    if (!normalizedPhone) {
      console.error('❌ SMS_SEND_FAILURE: phoneNumber could not be normalized to 019SMS format', { 
        originalPhone: phoneNumber,
        hint: 'Expected format: 5xxxxxxx or 05xxxxxxx'
      })
      return false
    }

    console.log('📱 SMS_SEND_START: Sending SMS to manager via 019SMS', {
      normalizedPhone,
      source: SMS_019_SENDER,
      messageLength: message.length,
    })

    const payload = buildSMSPayload(SMS_019_USERNAME, SMS_019_SENDER, normalizedPhone, message)

    const response = await fetch(SMS_019_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${SMS_019_API_TOKEN}`,
      },
      body: payload,
    })

    const responseText = await response.text()
    const { status, message: responseMessage, shipmentId } = parseXMLResponse(responseText)

    if (!response.ok) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS API returned non-200 HTTP status', {
        httpStatus: response.status,
        statusText: response.statusText,
        normalizedPhone,
      })
      return false
    }

    if (status !== 0) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS API returned non-zero status code', {
        status,
        message: responseMessage,
        normalizedPhone,
      })
      return false
    }

    console.log('✅ SMS_MANAGER_SENT: SMS sent successfully to manager via 019SMS', {
      normalizedPhone,
      shipmentId,
      source: SMS_019_SENDER,
    })

    return true
  } catch (err) {
    console.error('❌ SMS_SEND_FAILURE: Unexpected error sending manager SMS', {
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

/**
 * Legacy WhatsApp staff notifications (ARCHIVED)
 * 
 * Do not use this for new notifications.
 * SMS is the primary channel for staff (workers + manager).
 * 
 * Resident communication remains on WhatsApp via Meta/Facebook.
 */
export const WHATSAPP_STAFF_NOTIFICATIONS_ARCHIVED = {
  reason: 'WhatsApp templates not yet approved by Meta',
  status: 'disabled',
  currentChannel: 'SMS_019',
}
