-- Seed default WhatsApp templates for every existing client.
-- Runs only when whatsapp_templates is completely empty (fresh environments).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_templates LIMIT 1) THEN
    INSERT INTO public.whatsapp_templates (client_id, template_key, template_text, updated_at)
    SELECT
      c.id,
      v.template_key,
      v.template_text,
      now()
    FROM public.clients c
    CROSS JOIN (
      VALUES
        ('welcome', 'שלום! ברוכים הבאים למערכת התקלות של {{project_name}}. כדי לפתוח תקלה חדשה, שלחו את תיאור הבעיה.'),
        ('ticket_opened', 'תקלה {{ticket_number}} נפתחה בהצלחה בפרויקט {{project_name}}. תיאור: {{description}}. נחזור אליכם בהקדם.'),
        ('worker_assigned', 'תקלה {{ticket_number}} הוקצתה לטיפול. אנו על זה — נעדכן אתכם בקרוב.'),
        ('ticket_closed', 'תקלה {{ticket_number}} נסגרה. תודה שפניתם! במקור — ניהול תקלות חכם.'),
        ('error_general', 'אירעה שגיאה במערכת. אנא נסו שוב או פנו למנהל.')
    ) AS v(template_key, template_text)
    ON CONFLICT (client_id, template_key) DO NOTHING;
  END IF;
END $$;

