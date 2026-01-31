-- 1. Aggiungiamo il flag per tracciare se abbiamo mandato la mail di recensione
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS review_email_sent boolean DEFAULT false;

-- 2. Creiamo la vista per n8n che trova i pazienti a cui mandare la richiesta
-- Logica: Appuntamenti 'completed' finiti da più di 24 ore (es. ieri) ma meno di 48 ore.
-- FIXED: Use 'starts_at' because 'ends_at' does not exist. (Assuming visit ended shortly after start).
-- FIXED: Explicitly DROP view to avoid schema conflict
-- FIXED: Uses 'full_name' for patients and 'display_name' for operators

DROP VIEW IF EXISTS public.view_n8n_review_targets CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_review_targets AS
SELECT 
    a.id AS appointment_id,
    a.starts_at,
    p.full_name AS patient_name, 
    p.email AS patient_email,
    s.name AS service_name,
    op.display_name AS operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
JOIN operators op ON a.operator_id = op.id
WHERE 
    a.status = 'completed'
    AND a.starts_at < (now() - INTERVAL '24 hours') -- Iniziati da almeno 24 ore (quindi finiti ieri)
    AND a.starts_at > (now() - INTERVAL '48 hours') -- Finestra di 1 giorno
    AND a.review_email_sent = false -- Non ancora inviato
    AND p.email IS NOT NULL -- Devono avere la mail
    AND p.email != '';
