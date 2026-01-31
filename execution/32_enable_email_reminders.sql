-- Assicuriamoci che le viste restituiscano la EMAIL del paziente
-- FIXED: Explicitly DROP view to avoid schema conflict
-- FIXED: Use 'full_name' for patients and 'display_name' for operators

-- 1. View per Reminder 24h (Domani)
DROP VIEW IF EXISTS public.view_n8n_reminders_24h CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_reminders_24h AS
SELECT 
    a.id AS appointment_id,
    a.starts_at,
    p.full_name AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email, -- FONDAMENTALE PER BREVO
    s.name AS service_name,
    op.display_name AS operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
JOIN operators op ON a.operator_id = op.id
WHERE 
    a.status = 'confirmed'
    AND a.starts_at > (now() + INTERVAL '23 hours') 
    AND a.starts_at < (now() + INTERVAL '25 hours')
    AND a.waha_24h_sent = false
    AND p.email IS NOT NULL AND p.email != ''; -- Solo chi ha la mail

-- 2. View per Reminder 5h (Oggi)
DROP VIEW IF EXISTS public.view_n8n_reminders_5h CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_reminders_5h AS
SELECT 
    a.id AS appointment_id,
    a.starts_at,
    p.full_name AS patient_name,
    p.phone AS patient_phone,
    p.email AS patient_email, -- FONDAMENTALE PER BREVO
    s.name AS service_name,
    op.display_name AS operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
JOIN operators op ON a.operator_id = op.id
WHERE 
    a.status = 'confirmed'
    AND a.starts_at > (now() + INTERVAL '4 hours') 
    AND a.starts_at < (now() + INTERVAL '6 hours')
    AND a.waha_5h_sent = false
    AND p.email IS NOT NULL AND p.email != ''; -- Solo chi ha la mail
