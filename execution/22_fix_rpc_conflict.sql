-- ============================================================
-- FIX: DROP AND RECREATE ADMIN APPOINTMENT RPCs TO RESOLVE CONFLICTS
-- ============================================================

BEGIN;

-- 1. DROP Existing functions explicitly to allow signature/name changes
-- We drop variations to ensure we clear any existing conflict.

-- Drop the original 7-arg version (from older revisions)
DROP FUNCTION IF EXISTS admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text);

-- Drop the new conflicting version (if it exists with different param names)
-- The error 42P13 hints at a collision here.
DROP FUNCTION IF EXISTS admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text, boolean, text, text);

-- Also drop update function to be safe
DROP FUNCTION IF EXISTS admin_update_appointment(uuid, uuid, uuid, text, timestamptz, text, int, text, boolean, text, text);

-- Drop the simple get_by_id if needed (usually safe to replace, but let's be consistent)
DROP FUNCTION IF EXISTS admin_get_appointment_by_id(uuid);


-- 2. RECREATE admin_create_appointment
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
    v_tenant_id uuid;
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Get Tenant ID from admin's profile
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = auth.uid();
    
    -- Fallback safety (should not happen for valid admin users)
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_not_found';
    END IF;

    -- Find or create patient
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        -- FIX: Use 'full_name' instead of 'display_name' AND filter by tenant_id
        SELECT id INTO v_patient_id FROM patients WHERE full_name = trim(p_patient_name) AND tenant_id = v_tenant_id LIMIT 1;
        
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (full_name, email, phone, tenant_id) 
            VALUES (trim(p_patient_name), p_patient_email, p_patient_phone, v_tenant_id) 
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
        gross_amount_cents, commission_rate, commission_amount_cents, notes
    ) VALUES (
        p_operator_id, p_service_id, v_patient_id, p_starts_at, p_status,
        p_gross_amount_cents, v_commission_rate, v_commission_amount_cents, p_notes
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;


-- 3. RECREATE admin_update_appointment
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
    v_tenant_id uuid;
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Get Tenant ID from admin's profile
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = auth.uid();

    -- Find or create patient
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE full_name = trim(p_patient_name) AND tenant_id = v_tenant_id LIMIT 1;
        
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (full_name, email, phone, tenant_id, marketing_consent) 
            VALUES (trim(p_patient_name), p_patient_email, p_patient_phone, v_tenant_id, p_marketing_consent) 
            RETURNING id INTO v_patient_id;
        ELSE
            -- Update existing patient conacts + CONSENT if provided
            UPDATE patients 
            SET 
                email = COALESCE(p_patient_email, email),
                phone = COALESCE(p_patient_phone, phone),
                marketing_consent = COALESCE(p_marketing_consent, marketing_consent)
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
        updated_at = now()
    WHERE id = p_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found';
    END IF;
END;
$$;


-- 4. RECREATE admin_get_appointment_by_id
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
        p.full_name as patient_name,
        p.email as patient_email,
        p.phone as patient_phone,
        a.starts_at,
        a.status,
        a.gross_amount_cents,
        a.notes,
        p.marketing_consent -- FIX: Fetch from patients table
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.id = p_id;
END;
$$;

COMMIT;
