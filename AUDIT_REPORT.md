# AUDIT_REPORT (branch `saas`)

תאריך: 2026-04-30

## סיכום

בוצעה סקירה סטטית (code audit) של טפסים/פעולות, כתיבות ל־Supabase, בידוד `client_id`, error handling, ו־UI feedback (toast). נמצאו ותוקנו מספר נקודות; שאר הסעיפים להלן הם מעקב/המלצות.

## ממצאים ותיקונים שבוצעו

### 1) `fetch` ללא timeout

- נמצא `fetch` ללא timeout ב־`app/onboarding/page.tsx` (`/api/onboarding/project`) ותוקן ל־`fetchWithTimeout()` (10 שניות).
- `lib/logging.ts` שלח לוגים מרחוק עם `fetch` ללא timeout ותוקן ל־`fetchWithTimeout()` (10 שניות).
- `lib/fetch-timeout.ts` עודכן לברירת מחדל של 10 שניות (מ־8).

### 2) Promise.all לקריאות Supabase באותו מסך

- `app/api/pending-residents/route.ts` ביצע שתי קריאות (`projects` + `tickets`) אחת אחרי השנייה; עודכן ל־`Promise.all`.

### 3) Audit logging עם `clientId`

- ב־`app/api/assign-ticket/route.ts` היו קריאות ל־audit logger עם `clientId = 'unknown'` למרות ש־`clientId` כבר היה זמין מה-session.
  עודכן כך שה־audit נכתב עם `clientId` האמיתי.

### 4) מיגרציה 027 (Indexes) נשברה על DBs בלי `client_id`

- כפי שעלה ב־Supabase Studio, בחלק מהפרויקטים חסרות עמודות `client_id` (בעיקר ב־`tickets`, ולעיתים גם ב־`error_logs`).
- `supabase/migrations/027_perf_indexes.sql` עודכן כך שהוא מוסיף `client_id` חסר ומבצע backfill לפני יצירת האינדקסים.
- שמות אינדקסים עודכנו לפי הדרישה העדכנית:
  `idx_tickets_client_id`, `idx_tickets_client_status`, `idx_tickets_client_created`, וכו'.

## ממצאים שדורשים תשומת לב (לא חוסם, אך חשוב)

### A) כתיבות ל־Supabase בלי `client_id` בעמודה ייעודית

- `error_logs`: כיום נשמר `client_id` בתוך `details.client_id` (לצורך WhatsApp retry) ולכן אפשר לבצע backfill לעמודה ייעודית.
  אחרי הרצת 027, מומלץ להעביר בהמשך גם את ה־insert לכתוב `client_id` לעמודה (לא בוצע כאן כדי לא לשבור סביבות שעדיין לא הריצו את המיגרציה).

### B) Toast / feedback

- ברוב ה־CRUD העיקריים יש `toast.success` / `toast.error` בעברית, עם טקסטים מרוכזים ב־`lib/toast-messages.ts` (`TM`).
- קיימות עדיין הודעות ייעודיות נקודתיות שאינן משתמשות ב־`TM` (למשל הודעות “מיזוג נכשל”, “תרגום נכשל”). זה תקין, אך אם רוצים אחידות מלאה אפשר להוסיף להן מפתחות ב־`TM`.

### C) בדיקת “נשמר בפועל”

- ברמת הקוד: בכל נתיבי ה־API שנבדקו (onboarding / assign / merge / pending residents / create ticket) קיימת בדיקת `error` של Supabase ו־`return` עם status מתאים.
- מומלץ לוודא ידנית בפרודקשן (או Preview) את הפלוים הרגישים:
  יצירת טיקט עם קבצים, שיוך עובד + SMS, אישור דייר ממתין, וייצוא Excel.

## Test plan מומלץ (ידני)

1. Dashboard: יצירת טיקט → מופיע toast הצלחה + נוצר row ב־`tickets`.
2. Tickets: שיוך עובד → toast הצלחה + `assigned_worker_id` מתעדכן + `ticket_logs` נכתב.
3. Residents: CSV import → toast הצלחה/חלקי + rows ב־`residents`.
4. Pending residents: approve/reject → toast + סטטוס מתעדכן.
5. Settings: שמירה + WhatsApp test → toast + הערכים נשמרים ב־`clients`.
6. Supabase: הרצת מיגרציה 027 → אין יותר שגיאת `42703 column "client_id" does not exist`.

# דוח ביקורת — branch `saas`

## סטטוס branch

העבודה על **saas** בלבד (אומת שוב לפני עדכון זה).

## ביקורת חוזרת (אימות מול הרשימה)

| # | פיצ'ר | מצב בקוד |
|---|--------|----------|
| 1 | `/residents` — רשימה, חיפוש, סינון, טאבים פעילים/ממתינים+badge, הוספה, CSV, עריכה/מחיקה | קיים (`app/residents/page.tsx`) |
| 2 | TicketChat ב־`TicketDetailDrawer`, שם שולח, realtime | קיים (`TicketChat.tsx`, `TicketDetailDrawer.tsx`, `app/page.tsx`) |
| 3 | `/error-logs`, סינון, סמן טופל, מחק טופלו, ניווט | קיים |
| 4 | `/worker` standalone, עובד, טיקטים, בטיפול/הושלם, maxWidth 480px | קיים |
| 5 | `sla_hours`, `manager_phone`, `sla_alerted`, cron שעתי | קיים (מיגרציה `020` + `/api/cron/sla-check`) |
| 6 | `error_logs` + `whatsapp_send` + retry כל 5 דקות עד 3 ניסיונות | קיים |
| 7 | `/onboarding` + redirect | קיים; redirect עודכן (ראו למטה) |

## פיצ'ר 1: דיירים (`/residents`)

**היה:** דף דיירים עם חיפוש, סינון לפי פרויקט, הוספה, ייבוא CSV, עריכה ומחיקה.

**נוסף:** טאבים «פעילים» / «ממתינים לאישור» עם תגית מספר ממתינים; רשימת ממתינים עם אישור/דחייה ושם דייר (אותו API כמו `/pending-residents`).

## פיצ'ר 2: TicketChat

**נוסף:** קומפוננטה `app/components/tickets/TicketChat.tsx` — הודעות מטבלת `ticket_internal_messages`, שדה שם שולח + תוכן, מנוי Realtime (`postgres_changes`). שולב בתחתית `TicketDetailDrawer`. בלוח הבקרה (`app/page.tsx`) נטען גם `client_id` לטיקט לשיוך הודעות.

## פיצ'ר 3: ErrorLogs (`/error-logs`)

**נוסף:** דף `app/error-logs/page.tsx` — רשימה מטבלת `error_logs`, סינון הכל / לא טופלו / טופלו, «סמן כטופל», «מחק כל הטופלו». קישור בניווט (`app/components/ui.tsx`).

## פיצ'ר 4: WorkerView (`/worker`)

**נוסף:** דף standalone ללא `AppShell`, רוחב מקסימלי 480px, בחירת עובד, תקלות פתוחות משויכות, כפתורי «בטיפול» / «הושלם» (עדכון ישיר ב-Supabase).

## פיצ'ר 5: SLA Alerts

**נוסף:** מיגרציה `020_saas_audit_features.sql` — עמודות `projects.sla_hours` (ברירת מחדל 24), `projects.manager_phone`, `tickets.sla_alerted`. Job `GET /api/cron/sla-check` (שעתי ב-`vercel.json`) — טיקטים פתוחים שחרגו מ-SLA, שליחת וואטסאפ למנהל (`manager_phone` בפרויקט או בלקוח), ואז `sla_alerted=true`. נדרש `CRON_SECRET` בבקשה (`Authorization: Bearer …` או `?secret=`).

## פיצ'ר 6: Retry וואטסאפ

**נוסף:** כשל בשליחה נרשם ב-`error_logs` עם `context='whatsapp_send'` (דרך פרמטר אופציונלי ב-`sendWhatsAppTextMessage` + עטיפת `sendWa` ב-webhook ו-`notifyReporterTicketClosed`). Job `GET /api/cron/whatsapp-retry` כל 5 דקות — עד 3 ניסיונות (`whatsapp_attempts`), ללא רישום כפול; אחרי 3 כשלים הרשומה נשארת לא פתורה.

## פיצ'ר 7: Onboarding (`/onboarding`)

**נוסף:** דף רב-שלבי (ארגון → פרויקט → עובד אופציונלי → סיום). API: `POST /api/onboarding/organization`, `POST /api/onboarding/project`, `GET /api/onboarding/session`. ארגון נשמר עם `client_id` (singleton).

**הפניה אוטומטית (עודכן):** ב-`middleware.ts` — אם המשתמש **חדש** (תאריך יצירה ב־Supabase Auth בתוך **30 הימים** האחרונים) **ו**אין אף פרויקט פעיל (`is_active`) עבור ה־`client_id` של ה-singleton — מופנה ל-`/onboarding`. משתמש ותיק ללא פרויקטים לא מופנה (כדי לא לכפות onboarding על חשבונות ישנים).

## מיגרציה ו-RLS

קובץ: `supabase/migrations/020_saas_audit_features.sql` — טבלאות `error_logs`, `ticket_internal_messages`; RLS עם מדיניות `authenticated_only` + `service_role_bypass`; נוספו גם מדיניות `anon_dashboard_*` לשתי הטבלאות כדי לשמור תאימות ללקוח הדפדפן הקיים (מפתח anon כמו בשאר הטבלאות). הופעלה הטבלה ב-`supabase_realtime` לצ'אט.

## משתני סביבה

- `CRON_SECRET` — חובה לקריאות cron מאובטחות.
- `SUPABASE_SERVICE_ROLE_KEY` — בשימוש middleware להפניה ל-onboarding.

## הערות הפעלה

1. להריץ את המיגרציה `020_saas_audit_features.sql` ב-Supabase.
2. להגדיר `CRON_SECRET` ב-Vercel ולוודא ש-cron jobs פעילים (או לקרוא ידנית לנתיבי ה-API עם ה-secret).
