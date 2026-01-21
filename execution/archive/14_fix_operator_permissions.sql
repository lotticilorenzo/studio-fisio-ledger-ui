-- ============================================================
-- FIX OPERATOR RPC PERMISSIONS (v2)
-- ============================================================
-- Run this script in Supabase SQL Editor.
-- Fixes "permission denied for table appointments" error for operators.
-- ============================================================

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_my_appointments_op(int);
DROP FUNCTION IF EXISTS get_my_services_op();
DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, int, text);
DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, int, text, boolean);
DROP FUNCTION IF EXISTS get_appointment_by_id_op(uuid);
DROP FUNCTION IF EXISTS op_update_appointment(uuid, timestamptz, text, int, text, uuid);
DROP FUNCTION IF EXISTS op_cancel_appointment(uuid);

-- 1. get_my_appointments_op
CREATE OR REPLACE FUNCTION get_my_appointments_op(p_limit int DEFAULT 50)
RETURNS TABLE (
    id uuid,
    starts_at timestamptz,
    status text,
    gross_amount_cents int,
    operator_name text,
    service_name text,
    patient_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator_id uuid;
BEGIN
    SELECT op.id INTO v_operator_id
    FROM operators op
    WHERE op.user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.starts_at,
        a.status,
        a.gross_amount_cents,
        op.display_name AS operator_name,
        s.name AS service_name,
        p.display_name AS patient_name
    FROM appointments a
    LEFT JOIN operators op ON a.operator_id = op.id
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.operator_id = v_operator_id
    ORDER BY a.starts_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_appointments_op(int) TO authenticated;

-- 2. get_my_services_op
CREATE OR REPLACE FUNCTION get_my_services_op()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, name FROM services ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION get_my_services_op() TO authenticated;

-- 3. op_create_appointment
CREATE OR REPLACE FUNCTION op_create_appointment(
    p_service_id uuid,
    p_starts_at timestamptz,
    p_patient_full_name text,
    p_gross_amount_cents int,
    p_notes text DEFAULT NULL,
    p_marketing_consent boolean DEFAULT false
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
BEGIN
    SELECT id, commission_rate INTO v_operator_id, v_commission_rate
    FROM operators WHERE user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    IF p_patient_full_name IS NOT NULL AND trim(p_patient_full_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE display_name = trim(p_patient_full_name) LIMIT 1;
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (display_name) 
            VALUES (trim(p_patient_full_name)) 
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

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

GRANT EXECUTE ON FUNCTION op_create_appointment(uuid, timestamptz, text, int, text, boolean) TO authenticated;

-- 4. get_appointment_by_id_op
CREATE OR REPLACE FUNCTION get_appointment_by_id_op(p_id uuid)
RETURNS TABLE (
    id uuid,
    starts_at timestamptz,
    service_id uuid,
    gross_amount_cents int,
    notes text,
    status text,
    patient_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id, a.starts_at, a.service_id, a.gross_amount_cents, a.notes, a.status,
        p.display_name as patient_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.id = p_id
      AND a.operator_id = (SELECT o.id FROM operators o WHERE o.user_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION get_appointment_by_id_op(uuid) TO authenticated;

-- 5. op_update_appointment
CREATE OR REPLACE FUNCTION op_update_appointment(
    p_appointment_id uuid,
    p_starts_at timestamptz,
    p_status text,
    p_gross_amount_cents int,
    p_notes text,
    p_service_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_operator_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents int;
BEGIN
    SELECT id, commission_rate INTO v_operator_id, v_commission_rate
    FROM operators WHERE user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    UPDATE appointments
    SET
        starts_at = p_starts_at,
        status = p_status,
        gross_amount_cents = p_gross_amount_cents,
        commission_amount_cents = v_commission_amount_cents,
        notes = p_notes,
        service_id = p_service_id,
        updated_at = now()
    WHERE id = p_appointment_id
      AND operator_id = v_operator_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found_or_forbidden';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION op_update_appointment(uuid, timestamptz, text, int, text, uuid) TO authenticated;

-- 6. op_cancel_appointment
CREATE OR REPLACE FUNCTION op_cancel_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE appointments
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_appointment_id
      AND operator_id = (SELECT id FROM operators WHERE user_id = auth.uid());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'not_found_or_forbidden';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION op_cancel_appointment(uuid) TO authenticated;

-- ============================================================
-- DONE! Operator RPC functions now have proper permissions.
-- ============================================================
