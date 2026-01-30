-- ============================================================
-- 30_fix_rpc_ambiguity.sql
-- OBIETTIVO: Risolvere errore "Could not choose the best candidate function"
-- Causa: Ci sono multiple versioni di op_create_appointment con parametri diversi (ordine diverso).
-- Soluzione: Droppare TUTTE le versioni e crearne UNA sola canonica.
-- ============================================================

-- 1. DROP di tutte le possibili firme precedenti
-- Firma da script 19 (StartsAt primo)
DROP FUNCTION IF EXISTS public.op_create_appointment(timestamptz, uuid, text, int, text, boolean, text, text);
-- Firma da script 17/10 (ServiceId primo)
DROP FUNCTION IF EXISTS public.op_create_appointment(uuid, timestamptz, text, int, text, boolean, text, text);
-- Firma vecchia (6 params)
DROP FUNCTION IF EXISTS public.op_create_appointment(uuid, timestamptz, text, int, text, boolean);
-- Altre possibili varianti per sicurezza
DROP FUNCTION IF EXISTS public.op_create_appointment(uuid, timestamptz, text, integer, text, boolean, text, text);


-- 2. RICREAZIONE Funzione Canonica (ServiceId primo, come da 10_n8n_setup)
CREATE OR REPLACE FUNCTION public.op_create_appointment(
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
    v_tenant_id uuid;
BEGIN
    -- 1. Trova operatore e Tenant ID
    SELECT o.id, o.commission_rate, p.tenant_id 
    INTO v_operator_id, v_commission_rate, v_tenant_id
    FROM operators o
    JOIN profiles p ON o.user_id = p.user_id
    WHERE o.user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    -- 2. Verifica che il servizio sia assegnato all'operatore
    IF NOT EXISTS (
        SELECT 1 FROM operator_services 
        WHERE operator_id = v_operator_id AND service_id = p_service_id
    ) THEN
        RAISE EXCEPTION 'service_not_assigned';
    END IF;

    -- 3. Controlla se "Altro" richiede note
    SELECT name INTO v_service_name FROM services WHERE id = p_service_id;
    IF v_service_name ILIKE '%Altro%' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
        RAISE EXCEPTION 'notes_required_for_altro';
    END IF;

    -- 4. Gestisci paziente (Logica idempotente su Nome e Tenant)
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        -- Cerca paziente esistente per questo tenant
        SELECT id INTO v_patient_id 
        FROM patients 
        WHERE lower(full_name) = lower(trim(p_patient_name)) 
        AND tenant_id = v_tenant_id 
        LIMIT 1;
        
        IF v_patient_id IS NOT NULL THEN
            -- Aggiorna contatti se forniti (sovrascrive per garantire dati freschi)
            UPDATE patients SET
                email = COALESCE(trim(nullif(p_email, '')), email),
                phone = COALESCE(trim(nullif(p_phone, '')), phone),
                marketing_consent = p_marketing_consent,
                marketing_consent_at = CASE WHEN p_marketing_consent THEN now() ELSE marketing_consent_at END
            WHERE id = v_patient_id;
        ELSE
            -- Crea nuovo paziente
            INSERT INTO patients (
                full_name, 
                marketing_consent, 
                marketing_consent_at, 
                marketing_consent_source, 
                marketing_consent_by,
                email, 
                phone,
                tenant_id
            ) 
            VALUES (
                trim(p_patient_name),
                coalesce(p_marketing_consent, false),
                case when coalesce(p_marketing_consent, false) then now() else null end,
                case when coalesce(p_marketing_consent, false) then 'in_app_operator' else null end,
                case when coalesce(p_marketing_consent, false) then auth.uid() else null end,
                trim(nullif(p_email, '')),
                trim(nullif(p_phone, '')),
                v_tenant_id
            ) 
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- 5. Calcola commissione
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    -- 6. Inserisci appuntamento
    INSERT INTO appointments (
        operator_id, service_id, patient_id, starts_at, status,
        gross_amount_cents, commission_rate, commission_amount_cents, notes, created_by
    ) VALUES (
        v_operator_id, p_service_id, v_patient_id, p_starts_at, 'scheduled',
        p_gross_amount_cents, v_commission_rate, v_commission_amount_cents, p_notes, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- Permessi
GRANT EXECUTE ON FUNCTION public.op_create_appointment(uuid, timestamptz, text, int, text, boolean, text, text) TO authenticated;
