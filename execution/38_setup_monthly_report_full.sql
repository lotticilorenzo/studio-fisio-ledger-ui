-- ============================================================
-- 38_setup_monthly_report_full.sql
-- Report Mensile per Admin: Aggregati + Dettagli CSV
-- ============================================================

-- 1. VISTA AGGREGATA (Per il corpo della mail)
DROP VIEW IF EXISTS public.view_n8n_monthly_report CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_monthly_report AS
SELECT 
    to_char(date_trunc('month', now() - INTERVAL '1 month'), 'Month YYYY') AS report_month,
    
    -- Totale Incassato
    COALESCE(SUM(CASE WHEN status = 'completed' THEN gross_amount_cents ELSE 0 END), 0) / 100.0 AS total_revenue_eur,
    
    -- Totale Appuntamenti (Esclusi cancellati)
    COUNT(*) FILTER (WHERE status != 'cancelled') AS total_appointments,
    
    -- Nuovi Pazienti
    (
        SELECT COUNT(DISTINCT patient_id)
        FROM appointments a_first
        WHERE date_trunc('month', a_first.starts_at) = date_trunc('month', now() - INTERVAL '1 month')
        AND a_first.status = 'completed'
        AND a_first.patient_id NOT IN (
            SELECT patient_id FROM appointments a_prev 
            WHERE a_prev.starts_at < date_trunc('month', now() - INTERVAL '1 month')
            AND a_prev.status = 'completed'
        )
    ) AS new_patients_count

FROM appointments
WHERE 
    date_trunc('month', starts_at) = date_trunc('month', now() - INTERVAL '1 month');


-- 2. VISTA DETTAGLI (Per il file CSV allegato)
DROP VIEW IF EXISTS public.view_n8n_monthly_report_details CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_monthly_report_details AS
SELECT 
    to_char(a.starts_at, 'DD/MM/YYYY') as data,
    to_char(a.starts_at, 'HH24:MI') as ora,
    p.full_name as paziente,
    s.name as servizio,
    op.display_name as operatore,
    CASE 
        WHEN a.status = 'completed' THEN 'Completato'
        WHEN a.status = 'confirmed' THEN 'Confermato'
        WHEN a.status = 'scheduled' THEN 'In Programma'
        WHEN a.status = 'cancelled' THEN 'Cancellato'
        WHEN a.status = 'no_show' THEN 'No Show'
        ELSE a.status 
    END as stato,
    (a.gross_amount_cents / 100.0) as prezzo_eur
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN services s ON a.service_id = s.id
JOIN operators op ON a.operator_id = op.id
WHERE 
    date_trunc('month', a.starts_at) = date_trunc('month', now() - INTERVAL '1 month')
ORDER BY a.starts_at ASC;
