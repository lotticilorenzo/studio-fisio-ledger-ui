-- ============================================================
-- debug_fake_december_data.sql
-- Inserisce dati falsi nel mese di Dicembre per testare il Report
-- (FIXED: Aggiunto created_by obbligatorio)
-- ============================================================

INSERT INTO appointments (
    created_at, starts_at, 
    status, 
    patient_id, operator_id, service_id, 
    tenant_id, created_by, -- <--- CAMPO OBBLIGATORIO AGGIUNTO
    gross_amount_cents, commission_amount_cents,
    notes
)
SELECT 
    now(), 
    '2025-12-15 10:00:00+00'::timestamptz, 
    'completed',
    (SELECT id FROM patients LIMIT 1), 
    (SELECT id FROM operators LIMIT 1), 
    (SELECT id FROM services LIMIT 1),  
    (SELECT tenant_id FROM patients LIMIT 1),
    (SELECT created_by FROM appointments LIMIT 1), -- Prendiamo un ID utente valido da un appuntamento esistente
    5000, 
    1000, 
    'Test Report Mensile 1'

UNION ALL

SELECT 
    now(), 
    '2025-12-20 15:00:00+00'::timestamptz, 
    'completed',
    (SELECT id FROM patients LIMIT 1),
    (SELECT id FROM operators LIMIT 1),
    (SELECT id FROM services LIMIT 1),
    (SELECT tenant_id FROM patients LIMIT 1),
    (SELECT created_by FROM appointments LIMIT 1),
    7500, 
    1500, 
    'Test Report Mensile 2';
