# Notification Channel Architecture

## Current Implementation (Phase: SMS-Only for Staff)

### Channel Assignment

```
┌─────────────────┬────────────────┬─────────────────────┐
│ Recipient Type  │ Channel        │ Use Case            │
├─────────────────┼────────────────┼─────────────────────┤
│ Resident/User   │ WhatsApp       │ Ticket lifecycle    │
│ Worker          │ SMS (primary)  │ Assignment notice   │
│ Manager         │ SMS (primary)  │ New ticket alert    │
└─────────────────┴────────────────┴─────────────────────┘
```

### Implementation Files

#### Active Files (SMS Channel)
- `lib/sms-send.ts` - SMS notification service
  - `sendWorkerSMS()` - Notifications for assigned workers
  - `sendManagerSMS()` - Notifications for project managers

#### Modified Files
- `app/api/assign-ticket/route.ts` - Uses `sendWorkerSMS()` instead of WhatsApp
- `app/api/webhook/whatsapp/route.ts` - Uses `sendManagerSMS()` instead of WhatsApp

#### Preserved Files (Archived)
- `lib/whatsapp-send.ts` - Still contains old staff notification logic (DISABLED)
  - Old worker notifications: In comments/archived sections
  - Old manager notifications: In comments/archived sections

### Notification Flows

#### 1. Worker Assignment
**File:** `app/api/assign-ticket/route.ts`
- Trigger: Worker selected and ticket updated to ASSIGNED
- Recipient: Worker phone number
- Channel: SMS (via `sendWorkerSMS()`)
- Status: ✅ ACTIVE

#### 2. New Ticket Created
**File:** `app/api/webhook/whatsapp/route.ts`
- Trigger: User sends message to WhatsApp webhook (ticket creation)
- Recipients:
  - Manager: SMS (via `sendManagerSMS()`) ✅ ACTIVE
  - User: WhatsApp (resident confirmation) ✅ ACTIVE

#### 3. Ticket Lifecycle (Resident)
**File:** `app/api/webhook/whatsapp/route.ts`
- User receives WhatsApp messages for:
  - Status confirmations
  - Support interactions
  - Image attachments
- Channel: WhatsApp (unchanged)
- Status: ✅ ACTIVE

---

## Future: Reactivating WhatsApp for Staff

When WhatsApp Business API templates are approved by Meta:

1. **Template IDs will be available** in environment variables:
   - `WHATSAPP_TEMPLATE_WORKER_ASSIGNMENT`
   - `WHATSAPP_TEMPLATE_TICKET_ALERT`

2. **Reactivation process**:
   ```
   1. Enable template checking in sms-send.ts
   2. Uncomment archived WhatsApp code in assign-ticket and webhook
   3. Remove SMS calls (or keep both temporarily)
   4. Test with Meta-approved templates
   5. Remove SMS code when WhatsApp fully restored
   ```

3. **Archived code locations**:
   - `app/api/assign-ticket/route.ts` - Lines with "ARCHIVED" comment
   - `app/api/webhook/whatsapp/route.ts` - Lines with "ARCHIVED" comment

---

## Development Notes

### SMS Provider Integration

The SMS service is provider-agnostic. Currently using placeholder API:
- **API URL:** `process.env.SMS_API_URL`
- **API Key:** `process.env.SMS_API_KEY`
- **Supported Providers:** Twilio, Vonage, local gateway, etc.

To integrate a real SMS provider:
1. Update `lib/sms-send.ts` fetch calls
2. Set SMS_API_URL and SMS_API_KEY environment variables
3. Test in development: logs SMS instead of sending
4. Production: sends actual SMS messages

### Logging & Debugging

All notification sends are logged with channel information:
- `worker_sms_sent` - Worker SMS delivered
- `manager_sms_sent` - Manager SMS delivered
- `worker_sms_failed` - Worker SMS failed
- `manager_sms_failed` - Manager SMS failed
- `worker_whatsapp_archived` - Historical marker
- `manager_whatsapp_archived` - Historical marker

Search production logs for these prefixes to track notification delivery.

---

## Migration Timeline

| Phase               | Workers | Managers | Residents |
|-------------------|---------|----------|-----------|
| Current (Phase 1) | SMS ✅  | SMS ✅   | WhatsApp ✅ |
| Phase 2 (Pending) | WhatsApp (when template approved) | WhatsApp | WhatsApp |

**Phase 2 Trigger:** Meta approves WhatsApp Business template IDs for staff notifications
