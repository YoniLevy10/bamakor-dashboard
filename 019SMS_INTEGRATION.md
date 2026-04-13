# 019SMS Integration Guide

## Status
✅ **IMPLEMENTED** - Real 019SMS integration replaces placeholder SMS provider

**Latest Commit:** `24f8a43` - 019SMS API integration complete

---

## Configuration

### Required Environment Variables

Add these to your `.env.local` (development) or production environment:

```env
# 019SMS API Credentials (for SMS notifications to staff)
SMS_019_USERNAME=your_019sms_username
SMS_019_PASSWORD=your_019sms_password
```

### Where to Add

**Development:** Add to `.env.local` in project root
```bash
echo "SMS_019_USERNAME=your_username" >> .env.local
echo "SMS_019_PASSWORD=your_password" >> .env.local
```

**Production (Vercel):** Add via Vercel dashboard
- Navigate to: Settings → Environment Variables
- Add both variables with appropriate scope (Production)

---

## Technical Details

### 019SMS API Endpoint
- **URL:** `https://api.019sms.co.il/Send`
- **Method:** `POST`
- **Content-Type:** `application/x-www-form-urlencoded`

### Request Format
```
UserName: [SMS_019_USERNAME]
Password: [SMS_019_PASSWORD]
To: [recipient_phone_normalized]
From: 972559899132
Text: [message_text_utf8]
```

### Phone Number Normalization
The implementation automatically handles:
- `+972...` → `972...` (removes leading +)
- `05/08/09...` → `972-5/972-8/972-9...` (Israeli format conversion)
- Removes spaces and dashes
- Returns normalized format to 019SMS

**Examples:**
- `0503334455` → `97250334455`
- `+972503334455` → `97250334455`
- `05-03-334455` → `97250334455`

### Response Handling
- **Success:** 019SMS returns `OK` (exact string)
- **Failure:** Any other response or HTTP error status logged with details

### Character Encoding
- **Charset:** UTF-8
- **Support:** Full Hebrew character support
- **Length:** Standard SMS length limits apply

---

## Usage in Application

### When SMS is Sent

#### 1. Worker Assignment
**File:** [app/api/assign-ticket/route.ts](app/api/assign-ticket/route.ts)
**Trigger:** Worker assigned to ticket
**Message Flow:**
```
POST /api/assign-ticket
  → sendWorkerSMS(worker.phone, message)
  → 019SMS API
  → SMS delivered to worker phone
```

#### 2. Manager Notifications
**File:** [app/api/webhook/whatsapp/route.ts](app/api/webhook/whatsapp/route.ts)
**Triggers:** 
- New ticket created via WhatsApp resident
- Important status changes

**Message Flow:**
```
WhatsApp webhook (resident)
  → sendManagerSMS(manager.phone, notification)
  → 019SMS API
  → SMS delivered to manager phone
```

### Logging

All SMS operations log with these prefixes for monitoring:

```
SMS_DEVELOPMENT         - Dev mode operation (no credentials)
SMS_SEND_START          - API request initiated
SMS_WORKER_SENT         - ✅ Worker SMS sent successfully
SMS_MANAGER_SENT        - ✅ Manager SMS sent successfully
SMS_SEND_FAILURE        - ❌ Error during SMS sending
```

**Production Log Monitoring:**
```bash
# View SMS logs in Vercel
vercel logs --filter SMS_

# View specific failures
vercel logs --filter SMS_SEND_FAILURE
```

---

## Development Mode Behavior

When running locally without 019SMS credentials:
- SMS functions return `true` (success)
- Messages logged to console instead of sent
- **No real SMS charges** during development
- Useful for testing workflows without external API calls

**Example Console Output:**
```
📱 SMS_DEVELOPMENT: Not sending SMS in development mode (missing credentials)
📱 SMS_WORKER_RECIPIENT: 0503334455
📱 SMS_WORKER_MESSAGE_LENGTH: 87
```

---

## Production Mode Behavior

When running with credentials configured:
- SMS credentials required (both username and password)
- All SMS sent to real 019SMS API
- Return status indicates success/failure
- Detailed error logging for troubleshooting

**Example Success:**
```
✅ SMS_WORKER_SENT: SMS sent successfully to worker via 019SMS
   normalizedPhone: 97250334455
   sender: 972559899132
   messageLength: 87
```

**Example Failure:**
```
❌ SMS_SEND_FAILURE: 019SMS API returned non-200 status
   status: 401
   statusText: Unauthorized
   responseBody: Invalid credentials
   normalizedPhone: 97250334455
```

---

## Notification Channels Architecture

**Current State** (after this implementation):

```
┌─────────────────────────────────────────┐
│     Bamakor Notification System         │
├─────────────────────────────────────────┤
│                                         │
│ Residents → WhatsApp                    │
│  (ongoing conversation flow)            │
│  Meta/Facebook phone number             │
│  All messages on WhatsApp Business App  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ Workers → SMS (019SMS)                  │
│  (ticket assignments, status updates)   │
│  Phone: 972559899132                    │
│  Credentials: SMS_019_USERNAME/PASSWORD │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ Manager → SMS (019SMS)                  │
│  (new tickets, escalations)             │
│  Phone: 972559899132                    │
│  Credentials: SMS_019_USERNAME/PASSWORD │
│                                         │
└─────────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: SMS not sending in production

**Check 1: Credentials configured**
```bash
# Verify environment variables set
echo $SMS_019_USERNAME
echo $SMS_019_PASSWORD
```

**Check 2: 019SMS account active**
- Log into 019SMS dashboard
- Verify account status and credits

**Check 3: Phone number format**
- Ensure phone numbers in database are valid Israeli numbers
- Check logs for `SMS_SEND_FAILURE` with phone normalization issues

**Check 4: 019SMS API availability**
- Test endpoint: `https://api.019sms.co.il/Send`
- Verify HTTPS connectivity

### Issue: SMS working in dev, not in production

**Root Cause:** Missing credentials in production environment

**Solution:** 
1. Add SMS_019_USERNAME and SMS_019_PASSWORD to production environment
2. Redeploy application
3. Monitor logs for successful SMS sends

### Issue: Gibberish characters in SMS

**Root Cause:** Encoding issue

**Solution:**
- Verify message is UTF-8 encoded
- 019SMS supports Hebrew - implementation sends as UTF-8
- Check SMS client app supports UTF-8 display

---

## Reverting to Placeholder

If needed to revert to placeholder (for testing):

1. Restore `lib/sms-send.ts` to previous version
2. Use `SMS_API_URL` and `SMS_API_KEY` environment variables
3. Revert commit `24f8a43`

```bash
git revert 24f8a43
```

---

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `lib/sms-send.ts` | Complete reimplementation | Real 019SMS integration |

## Related Files (Unchanged)

| File | Usage |
|------|-------|
| `app/api/assign-ticket/route.ts` | Calls `sendWorkerSMS()` |
| `app/api/webhook/whatsapp/route.ts` | Calls `sendManagerSMS()` |

---

## Next Steps

1. **Configure Credentials**
   - Add SMS_019_USERNAME and SMS_019_PASSWORD to development `.env.local`
   - Add to production environment in Vercel/host

2. **Test Locally**
   - Start dev server: `npm run dev`
   - Create test ticket, assign to worker
   - Watch logs for `SMS_WORKER_SENT` or `SMS_DEVELOPMENT`

3. **Production Deployment**
   - Ensure credentials configured in production
   - Deploy to production
   - Monitor logs: `SMS_WORKER_SENT` and `SMS_MANAGER_SENT`

4. **WhatsApp Transition** (Future Phase)
   - Once WhatsApp templates approved by Meta
   - Replace SMS for manager notifications with WhatsApp
   - Keep SMS for worker assignments (faster, less intrusive)

---

## References

- 019SMS API Documentation: https://docs.019sms.co.il
- Implementation: [lib/sms-send.ts](lib/sms-send.ts)
- Related Architecture: [NOTIFICATION_CHANNELS.md](NOTIFICATION_CHANNELS.md)
