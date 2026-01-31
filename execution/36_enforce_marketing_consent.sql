-- ============================================================
-- 36_enforce_marketing_consent.sql
-- GDPR: Filtra Recensioni e Reactivation in base al consenso
-- ============================================================

-- 1. Assicuriamoci che la colonna esista
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS marketing_consent boolean DEFAULT false;

-- ============================================================
-- 2. Aggiorna Vista RECENSIONI (Solo Consenzienti)
-- ============================================================
DROP VIEW IF EXISTS public.view_n8n_reviews CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_reviews AS
SELECT 
    a.id AS appointment_id,
    p.full_name AS patient_name,
    p.email AS patient_email,
    p.phone AS patient_phone,
    a.starts_at,
    s.name AS service_name,
    op.display_name AS operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
JOIN operators op ON a.operator_id = op.id
WHERE 
    a.status = 'completed'
    AND a.starts_at >= (now() - interval '30 hours') -- Ieri (marginato)
    AND a.starts_at <= (now() - interval '18 hours')
    AND (a.review_email_sent IS FALSE OR a.review_email_sent IS NULL)
    AND p.email IS NOT NULL AND p.email != ''
    AND p.marketing_consent IS TRUE; -- <--- FILTRO GDPR

-- ============================================================
-- 3. Aggiorna Vista REACTIVATION (Solo Consenzienti)
-- ============================================================
DROP VIEW IF EXISTS public.view_n8n_reactivation CASCADE;

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
    AND p.marketing_consent IS TRUE -- <--- FILTRO GDPR
    AND a.status = 'completed' 
GROUP BY p.id
HAVING 
    MAX(a.starts_at) < (now() - INTERVAL '6 months') 
    AND NOT EXISTS (
        SELECT 1 FROM appointments future_a 
        WHERE future_a.patient_id = p.id 
        AND future_a.starts_at > now()
    );
