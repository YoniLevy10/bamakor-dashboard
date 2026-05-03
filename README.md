# Bamakor Dashboard

**במקור (Bamakor)** היא מערכת SaaS לניהול תקלות ואחזקה בבניינים: דיווח מדיירים (טפס ציבורי + WhatsApp עם QR), שיבוץ עובדי שטח, ניהול דיירים ופרויקטים, PWA והתראות, ייצוא וסיכומים.

סטאק טכני: **Next.js (App Router)**, **Supabase** (PostgreSQL + Auth + Storage לפי ההגדרה בפרויקט שלכם), **Vercel** לפריסה.

---

## הפעלה מקומית

### דרישות

- Node.js 18+
- פרויקט Supabase עם מיגרציות מהריפו (`supabase/migrations/`)

### צעדים

```bash
npm install
cp .env.example .env.local   # והשלמת ערכים
npm run dev
```

השרת על `http://localhost:3000`.

### סקריפטים שימושיים

| פקודה | תיאור |
|--------|--------|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בניית production |
| `npm run start` | הרצה אחרי build |
| `npm run typecheck` | בדיקת TypeScript ללא פלט |
| `npm test` | Vitest |

---

## תיעוד נוסף

- **`DEVELOPER_SUMMARY.md`** — ארכיטקטורה, RLS, מפת דפים (מקור טכני מפורט)
- **`DEPLOYMENT_CHECKLIST.md`** — פריסת production, משתני סביבה, אינטגרציות ופרטיות
- **`KNOWN_ISSUES.md`** — TODO/FIXME/HACK מתועד מהקוד
- **`PRIVACY_POLICY_TEMPLATE.md`** — תבנית למדיניות פרטיות (טלפון, תיאור תקלה, מיקום, שמירה, בקשת מחיקה)

במקרה של **Hydration errors** בסביבת dev: ניקוי Service Worker ישן (DevTools → Application) ובדיקת cache.
