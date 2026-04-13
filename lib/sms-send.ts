/**
 * 019SMS notification service for internal staff
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - SMS_019_USERNAME: 019SMS account username (for API authentication)
 * - SMS_019_PASSWORD: 019SMS account password (for API authentication)
 * 
 * ARCHITECTURE:
 * - Residents: WhatsApp (conversation flow) - UNCHANGED
 * - Workers: SMS via 019SMS (internal notifications)
 * - Manager: SMS via 019SMS (internal notifications)
 * 
 * SMS Sender Number (for internal staff only): 972559899132
 * WhatsApp Number (for residents): Unchanged (WHATSAPP_PHONE_NUMBER env var)
 * 
 * This module handles outbound SMS to internal staff ONLY via 019SMS.
 * Resident communication remains on WhatsApp via Meta/Facebook.
 */

// 019SMS Configuration
const SMS_019_ENDPOINT = 'https://api.019sms.co.il/Send'
const SMS_019_USERNAME = process.env.SMS_019_USERNAME
const SMS_019_PASSWORD = process.env.SMS_019_PASSWORD
const SMS_019_SENDER = '972559899132' // Staff notification sender number

/**
 * Normalize phone number for 019SMS
 * Ensures format compatibility with Israeli phone numbers
 * 
 * Handles:
 * - Leading +972 → 972
 * - Leading 08 → 972-8
 * - Removes spaces and dashes
 */
function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''
  
  let normalized = phoneNumber.replace(/\s|-/g, '') // Remove spaces and dashes
  
  // Convert 05/08/09 format to 972 format
  if (normalized.startsWith('05')) {
    normalized = '972' + normalized.substring(1)
  } else if (normalized.startsWith('08')) {
    normalized = '972' + normalized.substring(1)
  } else if (normalized.startsWith('09')) {
    normalized = '972' + normalized.substring(1)
  }
  
  // Remove leading +
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1)
  }
  
  return normalized
}

/**
 * Send SMS to worker via 019SMS
 * Used when: Worker is assigned to a ticket
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

    // Development mode: log only if no credentials
    if (!isProduction && (!SMS_019_USERNAME || !SMS_019_PASSWORD)) {
      console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode (missing credentials)')
      console.log('📱 SMS_WORKER_RECIPIENT:', phoneNumber)
      console.log('📱 SMS_WORKER_MESSAGE_LENGTH:', message.length)
      return true
    }

    // Production mode: require credentials
    if (!SMS_019_USERNAME || !SMS_019_PASSWORD) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS credentials not configured (SMS_019_USERNAME or SMS_019_PASSWORD missing)')
      return false
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber)
    if (!normalizedPhone) {
      console.error('❌ SMS_SEND_FAILURE: phoneNumber could not be normalized', { originalPhone: phoneNumber })
      return false
    }

    console.log('📱 SMS_SEND_START: Sending SMS to worker via 019SMS', {
      normalizedPhone,
      sender: SMS_019_SENDER,
      messageLength: message.length,
      charset: 'utf-8',
    })

    // 019SMS API request
    const response = await fetch(SMS_019_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        UserName: SMS_019_USERNAME,
        Password: SMS_019_PASSWORD,
        To: normalizedPhone,
        From: SMS_019_SENDER,
        Text: message,
      }).toString(),
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS API returned non-200 status', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 300),
        normalizedPhone,
      })
      return false
    }

    // 019SMS returns "OK" on success
    if (responseText.trim() !== 'OK') {
      console.error('❌ SMS_SEND_FAILURE: 019SMS returned unexpected response', {
        status: response.status,
        responseBody: responseText.substring(0, 300),
        normalizedPhone,
      })
      return false
    }

    console.log('✅ SMS_WORKER_SENT: SMS sent successfully to worker via 019SMS', {
      normalizedPhone,
      sender: SMS_019_SENDER,
      messageLength: message.length,
    })

    return true
  } catch (err) {
    console.error('❌ SMS_SEND_FAILURE: Unexpected error sending worker SMS', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return false
  }
}

/**
 * Send SMS to manager via 019SMS
 * Used when: New ticket created, important status changes
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

    // Development mode: log only if no credentials
    if (!isProduction && (!SMS_019_USERNAME || !SMS_019_PASSWORD)) {
      console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode (missing credentials)')
      console.log('📱 SMS_MANAGER_RECIPIENT:', phoneNumber)
      console.log('📱 SMS_MANAGER_MESSAGE_LENGTH:', message.length)
      return true
    }

    // Production mode: require credentials
    if (!SMS_019_USERNAME || !SMS_019_PASSWORD) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS credentials not configured (SMS_019_USERNAME or SMS_019_PASSWORD missing)')
      return false
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber)
    if (!normalizedPhone) {
      console.error('❌ SMS_SEND_FAILURE: phoneNumber could not be normalized', { originalPhone: phoneNumber })
      return false
    }

    console.log('📱 SMS_SEND_START: Sending SMS to manager via 019SMS', {
      normalizedPhone,
      sender: SMS_019_SENDER,
      messageLength: message.length,
      charset: 'utf-8',
    })

    // 019SMS API request
    const response = await fetch(SMS_019_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        UserName: SMS_019_USERNAME,
        Password: SMS_019_PASSWORD,
        To: normalizedPhone,
        From: SMS_019_SENDER,
        Text: message,
      }).toString(),
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error('❌ SMS_SEND_FAILURE: 019SMS API returned non-200 status', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 300),
        normalizedPhone,
      })
      return false
    }

    // 019SMS returns "OK" on success
    if (responseText.trim() !== 'OK') {
      console.error('❌ SMS_SEND_FAILURE: 019SMS returned unexpected response', {
        status: response.status,
        responseBody: responseText.substring(0, 300),
        normalizedPhone,
      })
      return false
    }

    console.log('✅ SMS_MANAGER_SENT: SMS sent successfully to manager via 019SMS', {
      normalizedPhone,
      sender: SMS_019_SENDER,
      messageLength: message.length,
    })

    return true
  } catch (err) {
    console.error('❌ SMS_SEND_FAILURE: Unexpected error sending manager SMS', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return false
  }
}

/**
 * Legacy WhatsApp notification helper (ARCHIVED)
 * 
 * WARN: Do not use this for new notifications.
 * Once WhatsApp templates are approved by Meta, this can reference the new template system.
 * 
 * Current status: ARCHIVED - SMS via 019SMS is primary channel for staff
 * Future status: Will be restored when WhatsApp templates are available
 */
export const WHATSAPP_STAFF_NOTIFICATIONS_ARCHIVED = {
  reason: 'WhatsApp templates not yet approved by Meta',
  status: 'disabled',
  reactivationPlan: 'Restore when template_ids are available in environment',
  currentChannel: 'SMS_019',
}
