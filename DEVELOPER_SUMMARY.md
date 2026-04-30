# תמונת מצב מלאה — branch saas

מסמך זה מתאר את המערכת כפי שהיא בקוד ב־branch **saas** (אפריל 2026). יש לעדכן אותו כשמתווספים מודולים או מדיניות RLS משמעותית.

**עדכון אחרון (אפריל 2026):** בידוד multi-tenant — `client_id` לפי משתמש/ארגון (`lib/tenant-resolution.ts`, `lib/api-auth.ts`, `middleware.ts`); מיגרציה `022_tenant_client_isolation.sql` (RLS + `UNIQUE(client_id, project_code)` על `projects`); דיווח ציבורי עם `?client=`; webhook וואטסאפ לפי `whatsapp_phone_number_id`.

---

## 1. ארכיטקטורה

### זרימה כללית

1. **משתמש** נכנס דרך דפדפן (Next.js App Router, React 19, רכיבי UI עם inline styles ו־`theme`).
2. **אימות (Auth)**  
   - התחברות: **Google OAuth** דרך `supabase.auth.signInWithOAuth` בדף `/login`.  
   - אחרי Google, Supabase מפנה ל־**`/auth/callback`** עם `?code=` — שרת Next מריץ `exchangeCodeForSession` ומגדיר עוגיות סשן (`@supabase/ssr`).  
   - **Middleware** (`middleware.ts`) קורא `getUser()`; אם אין משתמש — הפניה ל־`/login?redirectTo=...`.  
   - משתמש חדש (נרשם ב־30 הימים האחרונים) **ללא פרויקטים פעילים** עבור ה־`client_id` שלו (מזהה דרך `organization_users` → `organizations.client_id`) — הפניה ל־`/onboarding`.
3. **Frontend (דפים Client)**  
   - רוב הדפים משתמשים ב־`lib/supabase` (מקליינט דפדפן עם anon key) לשאילתות ישירות לטבלאות (בהנחת RLS/מדיניות שמאפשרת ל־`authenticated` או anon לפי המיגרציות).  
   - `resolveBamakorClientIdForBrowser()` ב־`lib/bamakor-client.ts`: `getUser()` → `organization_users` → `organizations.client_id`; אם אין שיוך — מעבר ל־`/onboarding`. ב־**development** בלבד fallback ל־`NEXT_PUBLIC_BAMAKOR_CLIENT_ID` כשאין `client_id` לארגון.
4. **API Routes** (`app/api/**/route.ts`)  
   - פעולות רגישות משתמשות ב־**Service Role** (`lib/supabase-admin.ts`) כדי לעקוף RLS כשצריך.  
   - נתיבי דשבורד מאומתים ב־`requireSessionClientId()` (`lib/api-auth.ts`): סשן → `getSingletonClientId(admin, user.id)` שבפועל קורא ל־`requireClientIdForUser` ב־`lib/tenant-resolution.ts` (שרשרת org → client). דיווח ציבורי ב־`/report` שולח `client_id` בגוף הבקשה ל־`/api/create-ticket` (בנוסף ל־`project_code`). Webhook וואטסאפ: `resolveClientIdByWhatsAppPhoneNumberId` לפי `whatsapp_phone_number_id`.
5. **Supabase**  
   - DB + Auth + (אופציונלי) Realtime.  
   - Webhook וואטסאפ: `POST /api/webhook/whatsapp` — ללא סשן משתמש; מזהה לקוח לפי `whatsapp_phone_number_id` בטבלת `clients` (עם fallback dev ל־`BAMAKOR_CLIENT_ID`).

### איך `client_id` עובר בבקשות

| שכבה | מנגנון |
|--------|--------|
| דפדפן | `resolveBamakorClientIdForBrowser()` → מזהה `clients.id` לפי שיוך ארגון; מזריק ל־`.eq('client_id', …)` בשאילתות מהדפים. |
| שרת API (דשבורד) | `requireSessionClientId()` → `client_id` לפי משתמש; כל שאילתת admin מסננת לפי אותו `client_id`. |
| דיווח ציבורי | `POST /api/create-ticket` עם `client_id` בטופס (מקישור `?client=` ב־`/report`). |
| Webhook וואטסאפ | `resolveClientIdByWhatsAppPhoneNumberId` — לא עובר `client_id` מהדפדפן. |
| Cron | לפי `client_id` בשורות (תקלות / `error_logs`) — ללא singleton גלובלי. |

### איך Auth מחובר לדפים

- **Middleware** חוסם כל נתיב (מלבד public) בלי משתמש מחובר.  
- דפים לא קוראים ידנית ל־`getSession` בכל כניסה — ההנחה היא שהעוגיות כבר אחרי OAuth.  
- **יציאה:** כפתור **"יציאה מהחשבון"** בסיידבר ובתפריט המובייל (`NavSignOutButton` ב־`app/components/ui.tsx`) — `signOut()` + מעבר ל־`/login`.

---

## 2. מפת דפים

| נתיב | תפקיד | גישה | סטטוס |
|------|--------|--------|--------|
| `/` | לוח בקרה, KPI, תקלות אחרונות, מגירת תקלה | משתמש מחובר | ✅ |
| `/login` | התחברות Google בלבד | ציבורי | ✅ |
| `/auth/callback` | החלפת קוד OAuth לסשן (שרת) | ציבורי (לא חוסם middleware) | ✅ |
| `/onboarding` | יצירת ארגון / פרויקט / עובד ראשוני למשתמש חדש | משתמש מחובר | ✅ |
| `/tickets` | רשימת תקלות, סינון, ייצוא, מגירות | משתמש מחובר | ✅ |
| `/projects` | פרויקטים, עריכה, מגירות | משתמש מחובר | ✅ |
| `/workers` | עובדים | משתמש מחובר | ✅ |
| `/residents` | דיירים, ייבוא, מודלים | משתמש מחובר | ✅ |
| `/qr` | קודי QR לפרויקטים | משתמש מחובר | ✅ |
| `/settings` | התראות, וואטסאפ, קישור לתבניות | משתמש מחובר | ✅ |
| `/settings/whatsapp-templates` | עריכת תבניות הודעות וואטסאפ | משתמש מחובר | ✅ |
| `/error-logs` | יומן שגיאות | משתמש מחובר | ✅ |
| `/worker` | מסך עובד פשוט (ללא AppShell מלא) | משתמש מחובר; רשימות מסוננות לפי `client_id` של הארגון | ✅ |
| `/pending-residents` | דיירים ממתינים | משתמש מחובר | ✅ |
| `/summary` | סיכומים | משתמש מחובר | ✅ |
| `/report` | דיווח דיירים (ציבורי) — בפרודקשן נדרש `?client=` בקישור; `?project=` אופציונלי (גם מקישור QR) | ציבורי (ללא חובת login) | ✅ |

---

## 3. מפת API Routes

| נתיב | Method | תפקיד | Supabase | בידוד `client_id` | שגיאות |
|------|--------|--------|-----------|-------------------|--------|
| `/api/webhook/whatsapp` | POST (וגם GET לאימות) | Webhook Meta — הודעות נכנסות/יוצאות | כן (לרוב admin) | `whatsapp_phone_number_id` → `clients` | לוגים + תגובות HTTP |
| `/api/create-ticket` | POST | יצירת תקלה (+קבצים) | admin | סשן או `client_id` בטופס (דיווח ציבורי) | try/catch + JSON errors |
| `/api/update-ticket` | POST/PATCH | עדכון תקלה | כן | לפי לוגיקת route | כן |
| `/api/close-ticket` | POST | סגירת תקלה | כן | כן | כן |
| `/api/assign-ticket` | POST | שיבוץ | כן | כן | כן |
| `/api/merge-ticket` | POST | מיזוג תקלות | כן | כן | כן |
| `/api/create-project` | POST | יצירת פרויקט | כן | כן | כן |
| `/api/delete-project` | POST/DELETE | מחיקה | כן | כן | כן |
| `/api/create-worker` | POST | יצירת עובד | כן | כן | כן |
| `/api/import-residents` | POST | ייבוא דיירים | כן | כן | כן |
| `/api/pending-residents` | GET/PATCH | דיירים ממתינים | כן | סשן → `client_id` | כן |
| `/api/translate-ticket` | POST | תרגום תיאור | כן | דורש סשן (מניעת שימוש חיצוני) | כן |
| `/api/notify-reporter-ticket-closed` | POST | התראה למדווח | כן | כן | כן |
| `/api/onboarding/organization` | POST | ארגון ראשון | כן | קשור ל־org/client | כן |
| `/api/onboarding/project` | POST | פרויקט באונבורדינג | כן | כן | כן |
| `/api/onboarding/session` | GET | סשן אונבורדינג | כן | — | כן |
| `/api/settings/test-whatsapp` | POST | בדיקת שליחה | כן | סשן → `client_id` | כן |
| `/api/settings/upload-logo` | POST | העלאת לוגו | כן | סשן → `client_id` | כן |
| `/api/cron/sla-check` | GET | בדיקת SLA (Vercel Cron) | admin | לפי `client_id` בשורות תקלות | לוגים |
| `/api/cron/whatsapp-retry` | GET | ניסיון חוזר לשליחות שנכשלו | admin | לפי `error_logs` | לוגים |

*פרטים מדויקים לכל route — ראו את הקובץ המתאים תחת `app/api/`.*

---

## 4. Supabase — טבלאות עיקריות (לפי מיגרציות)

| טבלה | עמודות / מטרה עיקרית | RLS | Policies (דוגמה) |
|------|----------------------|-----|-------------------|
| `clients` | לקוח, הגדרות SMS/WhatsApp | כן (מיגרציות מוקדמות) | מדיניות dashboard / service_role |
| `organizations` | ארגון SaaS | כן | `service_role_bypass` |
| `organization_users` | קישור user↔org | כן | `service_role_bypass` |
| `projects` | פרויקטים, `client_id`, SLA; ייחוד `project_code` בתוך לקוח (022) | כן | RLS + anon לפי 011; 022 משפר ל־authenticated |
| `workers` | עובדים, `client_id` | כן | |
| `tickets` | תקלות, סטטוס, SLA alerted | כן | |
| `residents` | דיירים | כן | |
| `ticket_logs` | היסטוריית פעולות | כן | |
| `ticket_attachments` / אחסון | קבצים | דרך Storage + RLS | |
| `whatsapp_templates` | תבניות הודעות לפי `client_id` + `template_key` | כן | authenticated + service |
| `error_logs` | שגיאות כולל `whatsapp_send` | כן | service + authenticated לפי 020 |
| `ticket_internal_messages` | צ'אט פנימי לתקלה | כן | |
| `processed_webhooks` | מניעת כפילויות webhook | כן | |
| טבלאות session / pending (וואטסאפ) | מיגרציות 013–016 | כן | |

*לפרטי עמודות מלאים — קראו את קבצי ה־SQL ב־`supabase/migrations/`.*

---

## 5. WhatsApp

| נושא | פירוט |
|------|--------|
| **Webhook URL** | `https://<הדומיין שלכם>/api/webhook/whatsapp` (וגם URL שמוגדר אצל Meta). |
| **Triggers** | הודעות נכנסות מדיירים/מפעילים; יצירת/עדכון תקלות; תשובות אינטראקטיביות; זרימות START / אישורים וכו' — הכל מרוכז ב־`app/api/webhook/whatsapp/route.ts`. |
| **תבניות** | לפני שליחה: `resolveWhatsAppTemplateMessage` (`lib/whatsapp-templates.ts`) קורא מ־`whatsapp_templates` לפי `client_id` + מפתח; אם אין שורה — נעשה שימוש ב־fallback מהקוד. משתני `{{project_name}}`, `{{ticket_number}}`, … |
| **Retry** | Cron `vercel.json` → `/api/cron/whatsapp-retry` כל 5 דקות; רשומות `error_logs` עם `context = 'whatsapp_send'` ו־`whatsapp_attempts` &lt; 3. |
| **SLA** | Cron שעתי → `/api/cron/sla-check`; עמודות `sla_hours`, `sla_alerted` על תקלות/פרויקטים (מיגרציה 020). |

---

## 6. Auth Flow

1. **התחברות:** המשתמש בוחר **"התחבר עם Google"** ב־`/login` → `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback?next=...> } })`.  
   *הערה טכנית:* נדרש נתיב `/auth/callback` להחלפת PKCE בשרת; אחרי הצלחה מבוצע redirect ל־`next` (ברירת מחדל `/`).
2. **Google Console:** Authorized redirect URI חייב לכלול את  
   `https://<project-ref>.supabase.co/auth/v1/callback`  
   (כפי שמופיע ב-Supabase).
3. **Supabase Dashboard:** להפעיל Provider של Google; תחת **URL configuration** להוסיף את כתובת האפליקציה, למשל `https://<app>/auth/callback`.
4. **אחרי התחברות:** redirect ל־`/` (או ל־`redirectTo` המאושר).  
5. **משתמש חדש בלי פרויקטים פעילים** (לוגיקה ב־`middleware.ts` + `resolveClientIdForUserId`): redirect ל־`/onboarding`.  
6. **אונבורדינג:** טפסים בדף → `POST /api/onboarding/*` — יוצרים ארגון/פרויקט/עובד.  
7. **יציאה:** `signOut()` מהכפתור בתפריט.  
8. **לא מורשה / לא מחובר:** middleware מפנה ל־`/login`.

---

## 7. קצוות פתוחים

- **RLS מול Service Role:** API עם service role עוקף RLS — חובה לשמור על סינון `client_id` בכל שינוי בנתיבים.  
- **דיווח ציבורי:** תלוי בפרמטר `client` בקישור; RLS של anon עדיין רחב (מיגרציה 011) — לחזק RLS לפי tenant בעתיד.  
- **מסך `/worker`:** נדרש login; לשטח ללא סשן אפשר בעתיד טוקן חד־פעמי ב־URL (לא מומש).  
- **שם `getSingletonClientId`:** נשאר כעטיפה ל־`requireClientIdForUser` — לשקול שינוי שם לקבלת בהירות (`resolveClientIdForSessionUser`).  
- **מספר WhatsApp בדף QR (`WHATSAPP_NUMBER`):** עדיין קבוע בקוד — לקוחות SaaS עם מספרים שונים יזדקקו להגדרה דינמית.

---

## 8. ציון מוכנות

| תחום | ציון | הסבר קצר |
|------|------|-----------|
| **Frontend** | ✅ | דפים עיקריים; `client_id` בדפדפן לפי ארגון המשתמש (`resolveBamakorClientIdForBrowser`). |
| **API Routes** | ✅ | נתיבי דשבורד: `requireSessionClientId`; webhook: `resolveClientIdByWhatsAppPhoneNumberId`; דיווח ציבורי: `client_id` בטופס. |
| **Supabase** | ⚠️ | מיגרציות + `UNIQUE(client_id, project_code)` על `projects` (022); RLS anon עדיין רחב לדיווח — לחזק בהמשך. |
| **Auth** | ✅ | Google OAuth + callback + middleware + onboarding + יציאה בתפריט. |
| **WhatsApp** | ✅ | Webhook גדול, תבניות DB, retry cron, SLA cron. |
| **Multi-tenant isolation** | ✅ | `client_id` נגזר מ־`organization_users` → `organizations` למשתמש מחובר; webhook לפי `whatsapp_phone_number_id`; `BAMAKOR_CLIENT_ID` / `NEXT_PUBLIC_*` רק fallback ב־development. |

---

## נספח: הגדרות חיצוניות (Checklist)

- [ ] Supabase → Authentication → Providers → **Google** מופעל.  
- [ ] Google Cloud Console → OAuth → Redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.  
- [ ] Supabase → URL configuration → **Redirect URLs** כולל `https://<your-app-domain>/auth/callback`.  
- [ ] Vercel / hosting: משתני סביבה `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, ואופציונלית `BAMAKOR_CLIENT_ID`.
