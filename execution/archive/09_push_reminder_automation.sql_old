-- ============================================================
-- 09_push_reminder_automation.sql
-- ============================================================

-- Questa query deve essere eseguita ogni 5 minuti da n8n o da una Edge Function.
-- Seleziona gli appuntamenti in partenza tra 15 e 20 minuti che non hanno ancora inviato la push.

CREATE OR REPLACE VIEW public.view_upcoming_push_reminders AS
SELECT 
    a.id as appointment_id,
    a.starts_at,
    p.full_name as patient_name,
    s.name as service_name,
    sub.endpoint,
    sub.p256dh,
    sub.auth,
    auth.email as operator_email
FROM appointments a
JOIN operators o ON a.operator_id = o.id
JOIN push_subscriptions sub ON o.user_id = sub.user_id
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
JOIN auth.users auth ON o.user_id = auth.id
WHERE 
    a.status = 'scheduled' 
    AND a.push_reminder_sent = false
    AND a.starts_at <= (now() + interval '20 minutes')
    AND a.starts_at >= (now() + interval '10 minutes');

-- ISTRUZIONI PER N8N / EDGE FUNCTION:
-- 1. Esegui: SELECT * FROM view_upcoming_push_reminders;
-- 2. Per ogni riga, invia la notifica push via Web-Push library.
-- 3. Dopo l'invio, esegui: 
--    UPDATE appointments SET push_reminder_sent = true WHERE id = [appointment_id];
