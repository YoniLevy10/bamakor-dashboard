# New Client Intake Template (Bamakor)

הדבק את הטופס הזה בכל פתיחת לקוח חדש, מלא את כל השדות, ושלח בחזרה כמו שהוא.

---

## 1) Client Core (חובה)

- company_name:
- plan_tier: starter | pro | business | enterprise
- admin_email:

## 2) Client Contact (מומלץ)

- admin_phone:
- whatsapp_phone_number_id: (אופציונלי)
- whatsapp_business_phone: (אופציונלי, ספרות בלבד למשל 972501234567)

## 3) Projects (חובה: לפחות פרויקט אחד)

מלא שורה לכל פרויקט:

| name | project_code | address |
|------|--------------|---------|
|      |              |         |
|      |              |         |
|      |              |         |

כללי תקינות לפרויקט:
- project_code קצר, יחודי ללקוח, בלי רווחים (מומלץ אותיות/מספרים בלבד)
- דוגמה טובה: TLV_A1, VAAD01, GARDEN3

## 4) Workers (אופציונלי)

מלא שורה לכל עובד:

| full_name | phone | email | role |
|-----------|-------|-------|------|
|           |       |       |      |
|           |       |       |      |
|           |       |       |      |

כללי תקינות לעובד:
- phone בפורמט אחיד (מומלץ ספרות בלבד)
- email אופציונלי, אבל מומלץ לשיוך עתידי

## 5) Notes (אופציונלי)

- האם צריך seed מיוחד להגדרות/תבניות?
- האם צריך להקים רק פרויקטים בלי עובדים כרגע?
- הערות תפעוליות נוספות:

---

## JSON Version (אם יותר נוח להעתיק/להדביק)

```json
{
  "company_name": "",
  "plan_tier": "starter",
  "admin_email": "",
  "admin_phone": "",
  "whatsapp_phone_number_id": "",
  "whatsapp_business_phone": "",
  "projects": [
    { "name": "", "project_code": "", "address": "" }
  ],
  "workers": [
    { "full_name": "", "phone": "", "email": "", "role": "" }
  ]
}
```

---

## Quick Validation Checklist (לפני שליחה)

- [ ] יש company_name
- [ ] יש plan_tier תקין
- [ ] יש admin_email תקין
- [ ] יש לפחות project אחד עם name + project_code
- [ ] אין project_code כפול באותה רשימה
- [ ] מספרי טלפון בפורמט אחיד

---

## מה נוצר אוטומטית אחרי הקמה

- clients row
- organizations row
- organization_users row (admin)
- projects rows + qr_identifier לכל פרויקט
- workers rows (אם סופקו)
- invite למייל מנהל (דרך Supabase Auth invite)
