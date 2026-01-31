-- 1. View per Sync Contatti (Tutti i pazienti con email)
-- Questa vista verrà letta da n8n per sincronizzare Brevo e HubSpot
-- Include il campo 'marketing_consent' (true/false) per le liste dinamiche
-- FIXED: Removed marketing_consent = true filter (Sync EVERYONE)
-- FIXED: Explicitly DROP view to avoid schema conflict
-- FIXED: Splitting full_name into first_name and last_name logic

DROP VIEW IF EXISTS public.view_n8n_contact_sync CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_contact_sync AS
SELECT 
    id,
    split_part(full_name, ' ', 1) AS first_name, 
    CASE 
        WHEN position(' ' in full_name) > 0 
        THEN substring(full_name from position(' ' in full_name) + 1) 
        ELSE '' 
    END AS last_name,
    email,
    phone,
    marketing_consent, 
    created_at
FROM patients
WHERE 
    email IS NOT NULL 
    AND email != '';

-- 2. View per Daily Digest (Statistiche di oggi per Admin)
-- Calcola appuntamenti totali, completati e incasso (stimato su completed)
DROP VIEW IF EXISTS public.view_n8n_daily_digest CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_daily_digest AS
SELECT 
    COUNT(*) AS total_appointments,
    COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_appointments,
    COALESCE(SUM(CASE WHEN status = 'completed' THEN gross_amount_cents ELSE 0 END), 0) AS total_revenue_cents,
    CURRENT_DATE AS report_date
FROM appointments 
WHERE 
    starts_at::date = CURRENT_DATE;
