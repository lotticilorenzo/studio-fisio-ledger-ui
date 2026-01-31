-- ============================================================
-- 35_setup_phase2_workflows.sql
-- Setup per Reactivation e Agenda Operatori
-- (Birthday rimosso per mancanza dati)
-- ============================================================

-- 1. Aggiungiamo la email agli operatori (se manca) - Serve per l'agenda settimanale
ALTER TABLE public.operators 
ADD COLUMN IF NOT EXISTS email text;

-- 2. Aggiungiamo birth_date ai pazienti (lo lasciamo predisposto, anche se non usato ora)
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS birth_date date;

-- ============================================================
-- 3. VIEW: REACTIVATION (Recupero Pazienti Dormienti)
-- Pazienti che non vengono da 6 mesi e NON hanno appuntamenti futuri
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
    AND a.status = 'completed' 
GROUP BY p.id
HAVING 
    MAX(a.starts_at) < (now() - INTERVAL '6 months') 
    AND NOT EXISTS (
        SELECT 1 FROM appointments future_a 
        WHERE future_a.patient_id = p.id 
        AND future_a.starts_at > now()
    );

-- ============================================================
-- 4. VIEW: WEEKLY AGENDA (Per Operatori)
-- Raggruppa gli appuntamenti della prossima settimana per ogni operatore
-- Genera già il testo della mail formattato
-- ============================================================
DROP VIEW IF EXISTS public.view_n8n_weekly_agenda CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_weekly_agenda AS
SELECT 
    op.id as operator_id,
    op.display_name as operator_name,
    op.email as operator_email, -- Ora esiste perché l'abbiamo aggiunta sopra
    string_agg(
        to_char(a.starts_at, 'Day DD/MM HH24:MI') || ' - ' || p.full_name || ' (' || s.name || ')', 
        E'\n' ORDER BY a.starts_at ASC
    ) as agenda_text
FROM appointments a
JOIN operators op ON a.operator_id = op.id
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
WHERE 
    a.starts_at >= (CURRENT_DATE + INTERVAL '1 day') -- Da Domani
    AND a.starts_at < (CURRENT_DATE + INTERVAL '8 days') -- Per 7 giorni
    AND a.status = 'confirmed'
    AND op.email IS NOT NULL AND op.email != '' -- Solo operatori con mail
GROUP BY op.id, op.display_name, op.email;
