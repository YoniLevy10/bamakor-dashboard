import { toast } from '@/lib/error-handler'

export type ReporterClosedNotifyApiBody = {
  success?: boolean
  reporter_has_phone?: boolean
  whatsapp_sent?: boolean
  sms_sent?: boolean
}

/** Follow-up after close: same idea as worker SMS note on assign. */
export function toastReporterClosedNotifySummary(body: ReporterClosedNotifyApiBody) {
  if (!body.success) return

  const hasPhone = Boolean(body.reporter_has_phone)
  if (!hasPhone) {
    toast.info('לא רשום מספר לפותח התקלה — לא נשלחה הודעה')
    return
  }

  const wa = Boolean(body.whatsapp_sent)
  const sms = Boolean(body.sms_sent)

  if (wa && sms) {
    toast.success('נשלחה הודעה לפותח התקלה (וואטסאפ ו־SMS)')
  } else if (sms) {
    toast.success('נשלח SMS לפותח התקלה')
  } else if (wa) {
    toast.success('נשלחה הודעת וואטסאפ לפותח התקלה')
  } else {
    toast.warning('לא הצלחנו לשלוח הודעה לפותח התקלה')
  }
}

export function toastReporterClosedNotifyNetworkWarning() {
  toast.warning('הפעולה נשמרה, אך לא ניתן היה לשלוח הודעה לפותח התקלה')
}
