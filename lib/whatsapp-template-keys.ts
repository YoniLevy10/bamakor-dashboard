export const WHATSAPP_TEMPLATE_KEYS = [
  'welcome',
  'ticket_opened',
  'worker_assigned',
  'ticket_closed',
  'error_general',
] as const

export type WhatsAppTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number]

export const WHATSAPP_TEMPLATE_VAR_NAMES = [
  'project_name',
  'ticket_number',
  'description',
  'reporter_name',
  'building_line',
] as const

export type WhatsAppTemplateVarName = (typeof WHATSAPP_TEMPLATE_VAR_NAMES)[number]

/** כותרת קריאה בעברית לכרטיס בעמוד ההגדרות */
export const WHATSAPP_TEMPLATE_LABELS: Record<WhatsAppTemplateKey, string> = {
  welcome: 'הודעת פתיחה והנחיות (עזרה כללית)',
  ticket_opened: 'פתיחת תקלה / אישור קבלה',
  worker_assigned: 'עדכון לעובד (שיוך / תקלה משויכת)',
  ticket_closed: 'סגירת תקלה (עדכון לדייר)',
  error_general: 'שגיאות, חיפוש בניין ומצבי קצה',
}

/** טקסט ברירת מחדל לטעינה ראשונית בעורך (כשאין שורה ב-DB) */
export const WHATSAPP_TEMPLATE_EDITOR_DEFAULTS: Record<WhatsAppTemplateKey, string> = {
  welcome:
    'לדיווח תקלה: כתבו בטקסט את תיאור הבעיה, או סרקו את קוד ה־QR בבניין.\n' +
    'אחרי שנפתחה פנייה – אפשר לשלוח גם תמונה של התקלה.',
  ticket_opened:
    'התקלה התקבלה בהצלחה.{{building_line}}\n' +
    'מספר הפנייה שלך: {{ticket_number}}\n\n' +
    'תיאור: {{description}}\n' +
    'מדווח: {{reporter_name}}\n' +
    'פרויקט: {{project_name}}\n\n' +
    '💡 אפשר גם לשלוח תמונה של התקלה — זה יעזור לנו לטפל בה מהר יותר.\n\n' +
    'נעדכן כשיהיה טיפול.\n' +
    'לפתיחת תקלה נוספת: סרקו שוב את קוד ה־QR בבניין או כתבו רחוב ומספר בניין.',
  worker_assigned:
    'תקלה חדשה ב{{project_name}}\n' +
    'מספר: #{{ticket_number}}\n' +
    '{{description}}\n' +
    'מדווח: {{reporter_name}}',
  ticket_closed:
    '✅ שלום! התקלה שדיווחת בבניין {{project_name}} טופלה וסגורה.\n\n' +
    'אם יש בעיה נוספת, ניתן לפנות אלינו בכל עת 🙏',
  error_general:
    'לא הצלחנו לזהות את הבניין.\n\n' +
    '📍 כדי שנוכל לאתר אותו, כתבו את כתובת הבניין (רחוב ומספר)\n\n' +
    'או:\n' +
    '1. סרקו את קוד ה-QR בבניין\n' +
    '2. פנו למנהלת הבניין לקבלת קוד הגישה',
}
