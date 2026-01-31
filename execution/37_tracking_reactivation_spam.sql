-- ============================================================
-- 37_tracking_reactivation_spam.sql
-- PROTEZIONE ANTISPAM PER I PAZIENTI DORMIENTI
-- ============================================================

-- 1. Aggiungiamo la colonna "Ultimo Contatto Reactivation"
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS last_reactivation_sent timestamp with time zone;

-- 2. Aggiorniamo la Vista per escludere chi abbiamo già contattato di recente
DROP VIEW IF EXISTS public.view_n8n_reactivation;

CREATE OR REPLACE VIEW public.view_n8n_reactivation AS
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.phone,
    MAX(a.starts_at) as last_visit_date
FROM patients p
JOIN appointments a ON p.id = a.patient_id
WHERE 
    p.email IS NOT NULL AND p.email != '' 
    AND p.marketing_consent IS TRUE -- Deve aver dato il consenso marketing
    AND a.status = 'completed'
    -- ANTISPAM: Non contattare se abbiamo già mandato mail negli ultimi 90 giorni
    AND (p.last_reactivation_sent IS NULL OR p.last_reactivation_sent < (now() - interval '90 days'))
GROUP BY p.id
HAVING 
    MAX(a.starts_at) < (now() - INTERVAL '6 months') -- Assente da almeno 6 mesi
    AND NOT EXISTS (
        SELECT 1 FROM appointments future_a 
        WHERE future_a.patient_id = p.id 
        AND future_a.starts_at > now() -- Non ha appuntamenti futuri
    );
