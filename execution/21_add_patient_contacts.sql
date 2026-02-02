-- ============================================================
-- FIX: ADD EMAIL/PHONE TO PATIENTS AND UPDATE ADMIN APPOINTMENT RPCs
-- ============================================================

BEGIN;

-- 1. Add columns to patients table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'email') THEN
        ALTER TABLE patients ADD COLUMN email text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'phone') THEN
        ALTER TABLE patients ADD COLUMN phone text;
    END IF;
END $$;

-- 2. UPDATE admin_create_appointment to accept email and phone
CREATE OR REPLACE FUNCTION admin_create_appointment(
    p_operator_id uuid,
    p_service_id uuid,
    p_patient_name text,
    p_starts_at timestamptz,
    p_status text,
    p_gross_amount_cents int,
    p_notes text,
    p_marketing_consent boolean DEFAULT false,
    p_patient_email text DEFAULT null,
    p_patient_phone text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_patient_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents int;
    v_new_id uuid;
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Find or create patient
    -- Logic: If patient exists by name, update their email/phone if provided (and currently empty or strictly updating? Let's just update for now or keep existing if not provided).
    -- Actually, simple logic: Find by name. If found, update contacts. If not, create with contacts.
    
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE display_name = trim(p_patient_name) LIMIT 1;
        
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (display_name, email, phone) 
            VALUES (trim(p_patient_name), p_patient_email, p_patient_phone) 
            RETURNING id INTO v_patient_id;
        ELSE
            -- Update existing patient conacts if provided
            UPDATE patients 
            SET 
                email = COALESCE(p_patient_email, email),
                phone = COALESCE(p_patient_phone, phone)
            WHERE id = v_patient_id;
        END IF;
    END IF;

    -- Get operator commission rate
    SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = p_operator_id;
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;

    -- Calculate commission
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    -- Insert appointment
    INSERT INTO appointments (
        operator_id, service_id, patient_id, starts_at, status,
        gross_amount_cents, commission_rate, commission_amount_cents, notes, marketing_consent
    ) VALUES (
        p_operator_id, p_service_id, v_patient_id, p_starts_at, p_status,
        p_gross_amount_cents, v_commission_rate, v_commission_amount_cents, p_notes, p_marketing_consent
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- 3. UPDATE admin_update_appointment (Need to create/replace it as I didn't see it in the previous full dump, assuming it exists or needs to be matched to the edit page usage)
-- The edit page calls `admin_update_appointment`. Let's define it robustly.

CREATE OR REPLACE FUNCTION admin_update_appointment(
    p_id uuid,
    p_operator_id uuid,
    p_service_id uuid,
    p_patient_name text,
    p_starts_at timestamptz,
    p_status text,
    p_gross_amount_cents int,
    p_notes text,
    p_marketing_consent boolean DEFAULT false,
    p_patient_email text DEFAULT null,
    p_patient_phone text DEFAULT null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_patient_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents int;
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Find or create patient (same logic as create)
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE display_name = trim(p_patient_name) LIMIT 1;
        
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (display_name, email, phone) 
            VALUES (trim(p_patient_name), p_patient_email, p_patient_phone) 
            RETURNING id INTO v_patient_id;
        ELSE
             -- Update existing patient conacts if provided
            UPDATE patients 
            SET 
                email = COALESCE(p_patient_email, email),
                phone = COALESCE(p_patient_phone, phone)
            WHERE id = v_patient_id;
        END IF;
    END IF;

    -- Recalculate commission based on NEW operator (if changed) or existing
    SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = p_operator_id;
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    UPDATE appointments
    SET
        operator_id = p_operator_id,
        service_id = p_service_id,
        patient_id = v_patient_id,
        starts_at = p_starts_at,
        status = p_status,
        gross_amount_cents = p_gross_amount_cents,
        commission_rate = v_commission_rate,
        commission_amount_cents = v_commission_amount_cents,
        notes = p_notes,
        marketing_consent = p_marketing_consent,
        updated_at = now()
    WHERE id = p_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found';
    END IF;
END;
$$;

-- 4. UPDATE admin_get_appointment_by_id to return patient email/phone
CREATE OR REPLACE FUNCTION admin_get_appointment_by_id(p_id uuid)
RETURNS TABLE (
    id uuid,
    operator_id uuid,
    service_id uuid,
    patient_id uuid,
    patient_name text,
    patient_email text,
    patient_phone text,
    starts_at timestamptz,
    status text,
    gross_amount_cents int,
    notes text,
    marketing_consent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.operator_id,
        a.service_id,
        a.patient_id,
        p.display_name as patient_name,
        p.email as patient_email,
        p.phone as patient_phone,
        a.starts_at,
        a.status,
        a.gross_amount_cents,
        a.notes,
        a.marketing_consent
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.id = p_id;
END;
$$;

COMMIT;
