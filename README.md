# Bamakor Dashboard

**במקור (Bamakor)** היא מערכת SaaS רב-דיירית לניהול תקלות ואחזקה בבניינים.  
דיירים מדווחים דרך **טופס ציבורי** (`/report`) או **WhatsApp** (סרייק QR לפרויקט).  
בעל העסק מנהל תקלות, עובדים, דיירים, ומקבל סיכומים ודוחות.

**סטאק טכני:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + Auth + RLS) · Vercel · Zod · Vitest · Playwright

---

## מפת הדפים — מה כל דף עושה

| נתיב | תפקיד | גישה |
|------|--------|-------|
| `/login` | כניסה עם Google בלבד | ציבורי |
| `/` | לוח בקרה ראשי — KPI, תקלות אחרונות, פתיחת תקלה חדשה | מחובר |
| `/tickets` | כל התקלות — סינון, חיפוש, ייצוא Excel, מגירת פרטים | מחובר |
| `/projects` | בניינים/פרויקטים — יצירה, עריכה, ניהול | מחובר |
| `/workers` | עובדי שטח — הוספה, עריכה, שיוך לתקלות | מחובר |
| `/residents` | דיירים — ייבוא Excel, הוספה ידנית | מחובר |
| `/pending-residents` | דיירים שדיווחו ועדיין לא נרשמו בפנקס | מחובר |
| `/qr` | קודי QR להדפסה לכל פרויקט (WhatsApp + Web) | מחובר |
| `/summary` | דוחות ניהוליים + ייצוא Excel | מחובר |
| `/billing` | תוכנית פעילה, צריכה החודשית, גרף שבועי | מחובר |
| `/settings` | הגדרות WhatsApp, דחיפות, תבניות הודעות | מחובר |
| `/error-logs` | יומן שגיאות פנימי לצוות תמיכה | מחובר |
| `/onboarding` | הגדרה ראשונה למשתמש חדש (ארגון → פרויקט → עובד) | מחובר (חדש) |
| `/report` | טופס דיווח ציבורי לדיירים | ציבורי |
| `/worker` | מסך עובד שטח — צפייה ועדכון תקלות משויכות | ציבורי (`?token=`) / מחובר |

---

## הקמת לקוח חדש — ויזארד מנהל

אפשר להקים לקוח חדש **בפחות מדקה** דרך `/admin/setup`.  
הממשק (מאובטח עם `ADMIN_SETUP_SECRET`) יוצר אוטומטית:
- לקוח (`clients`) + ארגון (`organizations`)
- הזמנה לאימייל המנהל (Supabase Auth invite)
- פרויקטים עם קודי QR מוכנים
- עובדים

---

## הפעלה מקומית

### דרישות

- Node.js 18+
- פרויקט Supabase עם מיגרציות מהריפו (`supabase/migrations/`)

### צעדים

```bash
npm install
cp .env.example .env.local   # והשלמת ערכים (ראו רשימה למטה)
npm run dev
```

השרת על `http://localhost:3000`.

### משתני סביבה נדרשים

| משתנה | תיאור |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL פרויקט Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key ציבורי |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (שרת בלבד!) |
| `NEXT_PUBLIC_APP_URL` | כתובת האפליקציה (למשל `https://app.bamakor.com`) |
| `ADMIN_SETUP_SECRET` | סיסמה לוויזארד הקמת לקוח חדש |
| `WHATSAPP_VERIFY_TOKEN` | טוקן אימות Webhook של Meta |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push (אופציונלי) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | זהה ל-VAPID_PUBLIC_KEY |

---

## סקריפטים שימושיים

| פקודה | תיאור |
|--------|--------|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בניית production |
| `npm run start` | הרצה אחרי build |
| `npm run typecheck` | בדיקת TypeScript ללא פלט |
| `npm test` | Vitest (unit + integration) |
| `npx playwright test` | בדיקות E2E (דורש `npm run build && npm run start` לפני) |
| `npx playwright test tests/e2e/flows.spec.ts` | בדיקות E2E — זרימות משתמש מלאות |

---

## בדיקות

### Unit + Integration (Vitest)
```bash
npm test
```
- `lib/*.test.ts` — בדיקות יחידה
- `tests/integration/` — 122 בדיקות נגד Supabase בפועל (דורש `.env.local` עם service role)

### E2E (Playwright)
```bash
npx playwright test
```
- `tests/e2e/flows.spec.ts` — **70+ בדיקות** המכסות: דפים ציבוריים, הפניות auth, security API, ניווט, ו-health endpoint
- `tests/e2e/dashboard.spec.ts` — בדיקות לוח בקרה
- `tests/e2e/mobile.spec.ts` — תצוגת מובייל

---

## תוכניות מחיר

| תוכנית | מחיר/חודש | בניינים | עובדים | תקלות/חודש |
|---------|-----------|---------|--------|------------|
| Starter | ₪299 | 3 | 5 | 300 |
| Pro | ₪499 | 10 | 20 | 1,000 |
| Business | ₪699 | 30 | 60 | 5,000 |
| Enterprise | ₪899+ | ללא הגבלה | ללא הגבלה | ללא הגבלה |

---

## תיעוד נוסף

- **`DEVELOPER_SUMMARY.md`** — ארכיטקטורה, RLS, מפת דפים מלאה (מקור טכני מפורט)
- **`DEPLOYMENT_CHECKLIST.md`** — פריסת production, משתני סביבה, אינטגרציות ופרטיות
- **`KNOWN_ISSUES.md`** — TODO/FIXME/HACK מתועד מהקוד
- **`PRIVACY_POLICY_TEMPLATE.md`** — תבנית למדיניות פרטיות

במקרה של **Hydration errors** בסביבת dev: ניקוי Service Worker ישן (DevTools → Application) ובדיקת cache.
