-- View per Report Mensile Admin (Mese Precedente)
-- Questa vista calcola i totali del mese scorso.
-- Esempio: Se oggi è 1° Febbraio, calcola Gennaio.

DROP VIEW IF EXISTS public.view_n8n_monthly_report CASCADE;

CREATE OR REPLACE VIEW public.view_n8n_monthly_report AS
SELECT 
    to_char(date_trunc('month', now() - INTERVAL '1 month'), 'Month YYYY') AS report_month,
    
    -- Incasso Totale (Solo 'completed')
    COALESCE(SUM(CASE WHEN status = 'completed' THEN gross_amount_cents ELSE 0 END), 0) AS total_revenue_cents,
    
    -- Appuntamenti Totali (Tutti gli status tranne cancelled? O tutti quelli prenotati? Qui metto tutti quelli non cancellati nel mese)
    COUNT(*) FILTER (WHERE status != 'cancelled') AS total_appointments,
    
    -- Nuovi Pazienti (Pazienti che hanno avuto la loro PRIMA visita assoluta in questo mese)
    (
        SELECT COUNT(DISTINCT patient_id)
        FROM appointments a_first
        WHERE date_trunc('month', a_first.starts_at) = date_trunc('month', now() - INTERVAL '1 month')
        AND a_first.status = 'completed' -- Contiamo come "Nuovo Paziente" solo se è venuto davvero
        AND a_first.patient_id NOT IN (
            -- Escludi chi aveva già appuntamenti PRIMA di questo mese
            SELECT patient_id 
            FROM appointments a_prev 
            WHERE a_prev.starts_at < date_trunc('month', now() - INTERVAL '1 month')
            AND a_prev.status = 'completed'
        )
    ) AS new_patients_count

FROM appointments
WHERE 
    date_trunc('month', starts_at) = date_trunc('month', now() - INTERVAL '1 month');
