-- ============================================================
-- 10_n8n_setup.sql
-- Obiettivo: Preparare DB per automazioni n8n e FIXARE regressione contatti
-- ============================================================

-- 1. Aggiungi campi contatto ai pazienti (se mancanti)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. Aggiungi flag per gestire stato automazioni su Appuntamenti
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS waha_24h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waha_5h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_request_sent boolean NOT NULL DEFAULT false;

-- 3. Crea VISTE per n8n

-- VISTA: Reminder 24h (Domani)
CREATE OR REPLACE VIEW public.view_n8n_reminders_24h AS
SELECT 
    a.id as appointment_id,
    a.starts_at,
    p.full_name as patient_name,
    p.phone as patient_phone,
    s.name as service_name,
    o.display_name as operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN operators o ON a.operator_id = o.id
JOIN services s ON a.service_id = s.id
WHERE 
    a.status = 'scheduled' 
    AND a.waha_24h_sent = false
    AND a.starts_at > now()
    AND a.starts_at BETWEEN (now() + interval '23 hours') AND (now() + interval '25 hours')
    AND p.phone IS NOT NULL;

-- VISTA: Reminder 5h (Oggi)
CREATE OR REPLACE VIEW public.view_n8n_reminders_5h AS
SELECT 
    a.id as appointment_id,
    a.starts_at,
    p.full_name as patient_name,
    p.phone as patient_phone,
    s.name as service_name,
    o.display_name as operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN operators o ON a.operator_id = o.id
JOIN services s ON a.service_id = s.id
WHERE 
    a.status = 'scheduled' 
    AND a.waha_5h_sent = false
    AND a.starts_at > now()
    AND a.starts_at BETWEEN (now() + interval '4 hours 30 minutes') AND (now() + interval '5 hours 30 minutes')
    AND p.phone IS NOT NULL;

-- VISTA: Richiesta Recensioni (1h dopo visita)
CREATE OR REPLACE VIEW public.view_n8n_reviews AS
SELECT 
    a.id as appointment_id,
    p.full_name as patient_name,
    p.phone as patient_phone,
    o.display_name as operator_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN operators o ON a.operator_id = o.id
WHERE 
    (a.status = 'visited' OR a.status = 'completed') 
    AND a.review_request_sent = false
    AND a.starts_at < (now() - interval '1 hour')
    AND a.starts_at > (now() - interval '24 hours')
    AND p.phone IS NOT NULL;

-- VISTA: Sync Contatti (HubSpot/Brevo)
-- Restituisce pazienti con email o telefono validi
CREATE OR REPLACE VIEW public.view_n8n_sync_contacts AS
SELECT 
    p.id as patient_id,
    p.full_name,
    p.email,
    p.phone,
    p.marketing_consent,
    p.created_at,
    MAX(a.starts_at) as last_appointment_at,
    COUNT(a.id) as total_appointments
FROM patients p
LEFT JOIN appointments a ON p.id = a.patient_id
WHERE 
    p.email IS NOT NULL OR p.phone IS NOT NULL
GROUP BY p.id, p.full_name, p.email, p.phone, p.marketing_consent, p.created_at;

-- 4. RIPARA RPC `op_create_appointment`
-- Deve accettare Email/Phone E mantenere validazione Servizi

DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, int, text, boolean); -- Droppa vecchia firma (se esiste)

CREATE OR REPLACE FUNCTION op_create_appointment(
    p_service_id uuid,
    p_starts_at timestamptz,
    p_patient_name text,
    p_gross_amount_cents int,
    p_notes text DEFAULT NULL,
    p_marketing_consent boolean DEFAULT false,
    p_email text DEFAULT NULL,
    p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator_id uuid;
    v_patient_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents int;
    v_new_id uuid;
    v_service_name text;
BEGIN
    -- Trova operatore
    SELECT id, commission_rate INTO v_operator_id, v_commission_rate
    FROM operators WHERE user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    -- Verifica che il servizio sia assegnato all'operatore
    IF NOT EXISTS (
        SELECT 1 FROM operator_services 
        WHERE operator_id = v_operator_id AND service_id = p_service_id
    ) THEN
        RAISE EXCEPTION 'service_not_assigned';
    END IF;

    -- Controlla se "Altro" richiede note
    SELECT name INTO v_service_name FROM services WHERE id = p_service_id;
    IF v_service_name LIKE 'Altro%' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
        RAISE EXCEPTION 'notes_required_for_altro';
    END IF;

    -- Gestisci paziente (Crea o Aggiorna contatti se esiste per nome)
    -- Qui usiamo una logica MVP: se esiste il nome, aggiorniamo i contatti se forniti.
    
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE full_name = trim(p_patient_name) LIMIT 1;
        
        IF v_patient_id IS NOT NULL THEN
            -- Aggiorna contatti se forniti e vuoti nel DB, o sovrascrivi? 
            -- Per sicurezza sovrascriviamo se p_email/p_phone non sono nulli
            UPDATE patients SET
                email = COALESCE(trim(nullif(p_email, '')), email),
                phone = COALESCE(trim(nullif(p_phone, '')), phone),
                marketing_consent = p_marketing_consent, -- Aggiorna consenso con l'ultimo dato
                marketing_consent_at = CASE WHEN p_marketing_consent THEN now() ELSE marketing_consent_at END
            WHERE id = v_patient_id;
        ELSE
            -- Crea nuovo
            INSERT INTO patients (
                full_name, 
                marketing_consent, 
                marketing_consent_at, 
                marketing_consent_source, 
                marketing_consent_by,
                email, 
                phone
            ) 
            VALUES (
                trim(p_patient_name),
                coalesce(p_marketing_consent, false),
                case when coalesce(p_marketing_consent, false) then now() else null end,
                case when coalesce(p_marketing_consent, false) then 'in_app_operator' else null end,
                case when coalesce(p_marketing_consent, false) then auth.uid() else null end,
                trim(nullif(p_email, '')),
                trim(nullif(p_phone, ''))
            ) 
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- Calcola commissione
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    -- Inserisci appuntamento
    INSERT INTO appointments (
        operator_id, service_id, patient_id, starts_at, status,
        gross_amount_cents, commission_rate, commission_amount_cents, notes
    ) VALUES (
        v_operator_id, p_service_id, v_patient_id, p_starts_at, 'scheduled',
        p_gross_amount_cents, v_commission_rate, v_commission_amount_cents, p_notes
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION op_create_appointment(uuid, timestamptz, text, int, text, boolean, text, text) TO authenticated;
