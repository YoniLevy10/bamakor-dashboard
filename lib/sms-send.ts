/**
 * SMS notification service
 * 
 * NOTIFICATION CHANNEL ARCHITECTURE:
 * - Residents: WhatsApp (conversation flow)
 * - Workers: SMS (internal notifications)
 * - Manager: SMS (internal notifications)
 * 
 * This module handles outbound SMS to internal staff only.
 * Resident communication remains on WhatsApp.
 */

const SMS_API_URL = process.env.SMS_API_URL || 'https://api.sms-provider.com'
const SMS_API_KEY = process.env.SMS_API_KEY

/**
 * Send SMS to worker
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

    // SMS API provider implementation
    // For now: log as if sent (replace with real API when provider integrated)
    const isProduction = process.env.NODE_ENV === 'production'

    if (!isProduction && !SMS_API_KEY) {
      // Development: log only
      console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode')
      console.log('📱 SMS_WORKER_RECIPIENT:', phoneNumber)
      console.log('📱 SMS_WORKER_MESSAGE:', message)
      return true
    }

    if (!SMS_API_KEY) {
      console.error('❌ SMS_SEND_FAILURE: SMS_API_KEY not configured')
      return false
    }

    console.log('📱 SMS_SEND_START: Sending SMS to worker', {
      recipient: phoneNumber,
      messageLength: message.length,
    })

    // Placeholder: Replace with actual SMS provider call
    // Example: Twilio, Vonage, local SMS gateway, etc.
    const response = await fetch(`${SMS_API_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to: phoneNumber,
        message,
        channel: 'worker_notification',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ SMS_SEND_FAILURE: SMS provider returned error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 300),
      })
      return false
    }

    console.log('✅ SMS_WORKER_SENT: SMS sent successfully to worker', {
      recipient: phoneNumber,
      channel: 'worker_notification',
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
 * Send SMS to manager
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

    // SMS API provider implementation
    const isProduction = process.env.NODE_ENV === 'production'

    if (!isProduction && !SMS_API_KEY) {
      // Development: log only
      console.log('📱 SMS_DEVELOPMENT: Not sending SMS in development mode')
      console.log('📱 SMS_MANAGER_RECIPIENT:', phoneNumber)
      console.log('📱 SMS_MANAGER_MESSAGE:', message)
      return true
    }

    if (!SMS_API_KEY) {
      console.error('❌ SMS_SEND_FAILURE: SMS_API_KEY not configured')
      return false
    }

    console.log('📱 SMS_SEND_START: Sending SMS to manager', {
      recipient: phoneNumber,
      messageLength: message.length,
    })

    // Placeholder: Replace with actual SMS provider call
    const response = await fetch(`${SMS_API_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to: phoneNumber,
        message,
        channel: 'manager_notification',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ SMS_SEND_FAILURE: SMS provider returned error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 300),
      })
      return false
    }

    console.log('✅ SMS_MANAGER_SENT: SMS sent successfully to manager', {
      recipient: phoneNumber,
      channel: 'manager_notification',
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
 * Current status: ARCHIVED - SMS is primary channel for staff
 * Future status: Will be restored when WhatsApp templates are available
 */
export const WHATSAPP_STAFF_NOTIFICATIONS_ARCHIVED = {
  reason: 'WhatsApp templates not yet approved by Meta',
  status: 'disabled',
  reactivationPlan: 'Restore when template_ids are available in environment',
  currentChannel: 'SMS',
}
