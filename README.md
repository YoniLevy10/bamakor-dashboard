# Bamakor Dashboard

מערכת ניהול תקלות ואחזקה (Next.js + Supabase) עם דיווח ציבורי, אינטגרציית WhatsApp, ניהול עובדים/דיירים, PWA, Rate limiting, Billing בסיסי, ייצוא Excel והתראות Push.

## תיעוד / “יומן מפתחים”

התיעוד הטכני המלא, כולל ארכיטקטורה, מפת דפים/נתיבים, RLS, מיגרציות וסטטוס מוכנות — נמצא כאן:

- `DEVELOPER_SUMMARY.md`

`README.md` נשאר קצר כדי לא לשכפל מידע ולהתיישן.

## עדכונים אחרונים (אפריל 2026)

- **תפריט / ניווט אחיד**: `app/components/ui.tsx` — סדר: לוח בקרה, תקלות, פרויקטים, דיירים, דיירים לאישור, קודי QR, יומן שגיאות, תבניות וואטסאפ, סיכום; **הגדרות בתחתית**.
- **תיקון Hydration ב־Dev**: לא רושמים Service Worker ב־development (`RegisterServiceWorker`), וה־Sidebar לא נרנדר ב־SSR (רק אחרי mount) כדי למנוע mismatch כשיש cache/HMR.
- **Supabase migrations**: `025_fix_workers_phone_unique.sql` (ייחודיות טלפון עובד לפי `client_id`), `026_seed_whatsapp_templates_defaults.sql` (seed תבניות ברירת־מחדל אם הטבלה ריקה).

## Quickstart

### דרישות
- Node.js 18+
- פרויקט Supabase (DB + Storage)

### התקנה

```bash
npm install
npm run dev
```

אם מופיעה שגיאת **Hydration failed** בדפדפן: בדקו שאין Service Worker ישן רשום לאתר, ובצעו Unregister + Clear site data (DevTools → Application).

### משתני סביבה (`.env.local`)

הקובץ `.env.local` **מוחרג מ־git** (מופיע ב־`.gitignore` דרך `.env*`).

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Web Push (אופציונלי)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@bamakor.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

### DB / מיגרציות

להריץ את המיגרציות תחת `supabase/migrations/` בפרויקט Supabase.
בפרט (לפי מצב הפרויקט): `022`, `023`, `024`, `025`, `026`, **`027`** (השלמת `client_id` חסר בטבלאות + אינדקסי ביצועים).

## דפים מרכזיים (קיצור)
- **Dashboard**: `/`
- **תקלות**: `/tickets` (כולל **ייצוא Excel** של הרשימה המסוננת)
- **עובדים**: `/workers` (כולל **העתק קישור** למסך עובד שטח)
- **מסך עובד שטח**: `/worker?token=<uuid>` (ללא Google)
- **דיווח ציבורי**: `/report?client=<uuid>` + `GET /api/public/projects`
- **Billing**: `/billing`
- **הגדרות**: `/settings` (כולל **הפעל התראות** ל־Web Push)