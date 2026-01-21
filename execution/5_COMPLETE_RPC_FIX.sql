-- ============================================================
-- STUDIO FISIO LEDGER - COMPLETE RPC SCRIPT (ALL FUNCTIONS)
-- ============================================================
-- Run this ENTIRE script in Supabase SQL Editor.
-- This includes ALL required functions for the frontend.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. SCHEMA FIXES
-- ------------------------------------------------------------

-- Add duration_minutes column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'services' AND column_name = 'duration_minutes'
    ) THEN
        ALTER TABLE services ADD COLUMN duration_minutes integer NOT NULL DEFAULT 60;
    END IF;
END $$;

-- Add full_name column to patients if missing (alias for display_name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'patients' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE patients ADD COLUMN full_name text GENERATED ALWAYS AS (display_name) STORED;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 2. OPERATOR RPC FUNCTIONS
-- ------------------------------------------------------------

-- get_my_appointments_op: Lista appuntamenti dell'operatore corrente
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
AS $$
DECLARE
    v_operator_id uuid;
BEGIN
    -- Get operator ID for current user
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

-- get_my_services_op: Lista servizi disponibili per l'operatore
CREATE OR REPLACE FUNCTION get_my_services_op()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT id, name FROM services ORDER BY name;
$$;

-- op_create_appointment: Crea appuntamento come operatore
CREATE OR REPLACE FUNCTION op_create_appointment(
    p_service_id uuid,
    p_starts_at timestamptz,
    p_patient_full_name text,
    p_gross_amount_cents int,
    p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operator_id uuid;
    v_patient_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents int;
    v_new_id uuid;
BEGIN
    -- Get operator for current user
    SELECT id, commission_rate INTO v_operator_id, v_commission_rate
    FROM operators WHERE user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    -- Find or create patient
    IF p_patient_full_name IS NOT NULL AND trim(p_patient_full_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE display_name = trim(p_patient_full_name) LIMIT 1;
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (display_name) VALUES (trim(p_patient_full_name)) RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- Calculate commission
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    -- Insert appointment
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

-- get_appointment_by_id_op: Ottieni singolo appuntamento per modifica
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

-- op_update_appointment: Aggiorna appuntamento come operatore
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
AS $$
DECLARE
    v_operator_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents int;
BEGIN
    -- Get operator for current user
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

-- op_cancel_appointment: Disdici appuntamento come operatore
CREATE OR REPLACE FUNCTION op_cancel_appointment(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ------------------------------------------------------------
-- 3. ADMIN RPC FUNCTIONS
-- ------------------------------------------------------------

-- admin_get_appointments: Ottieni lista appuntamenti (con LIMIT protezione)
CREATE OR REPLACE FUNCTION admin_get_appointments(
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  status text,
  gross_amount_cents integer,
  commission_rate numeric,
  commission_amount_cents integer,
  operator_name text,
  service_name text,
  patient_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  -- Verifica che l'utente sia admin o owner
  SELECT role INTO v_role 
  FROM profiles 
  WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.starts_at,
    a.status,
    a.gross_amount_cents,
    a.commission_rate,
    a.commission_amount_cents,
    o.display_name as operator_name,
    s.name as service_name,
    p.full_name as patient_name
  FROM appointments a
  LEFT JOIN operators o ON a.operator_id = o.id
  LEFT JOIN services s ON a.service_id = s.id
  LEFT JOIN patients p ON a.patient_id = p.id
  WHERE a.starts_at >= p_start_date
    AND a.starts_at <= p_end_date
  ORDER BY a.starts_at DESC
  LIMIT 2000; -- Protezione performance
END;
$$;

-- admin_create_appointment: Crea appuntamento come admin
CREATE OR REPLACE FUNCTION admin_create_appointment(
    p_operator_id uuid,
    p_service_id uuid,
    p_patient_name text,
    p_starts_at timestamptz,
    p_status text,
    p_gross_amount_cents int,
    p_notes text
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
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE display_name = trim(p_patient_name) LIMIT 1;
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (display_name) VALUES (trim(p_patient_name)) RETURNING id INTO v_patient_id;
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

-- admin_month_summary: Riepilogo mensile per admin
CREATE OR REPLACE FUNCTION admin_month_summary(p_year_month text)
RETURNS TABLE (
    operator_id uuid,
    operator_name text,
    num_appointments bigint,
    total_gross_cents bigint,
    total_commission_cents bigint,
    total_net_cents bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start timestamptz;
    v_end timestamptz;
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    v_start := to_timestamp(p_year_month || '-01', 'YYYY-MM-DD');
    v_end := v_start + interval '1 month' - interval '1 millisecond';

    RETURN QUERY
    SELECT
        op.id,
        op.display_name,
        count(a.id),
        coalesce(sum(a.gross_amount_cents), 0)::bigint,
        coalesce(sum(a.commission_amount_cents), 0)::bigint,
        (coalesce(sum(a.gross_amount_cents), 0) - coalesce(sum(a.commission_amount_cents), 0))::bigint
    FROM operators op
    LEFT JOIN appointments a ON op.id = a.operator_id
        AND a.starts_at >= v_start AND a.starts_at <= v_end
        AND a.status != 'cancelled'
    GROUP BY op.id, op.display_name
    ORDER BY op.display_name;
END;
$$;

-- admin_link_user_to_operator: Collega utente a operatore
CREATE OR REPLACE FUNCTION admin_link_user_to_operator(
    p_user_email text,
    p_display_name text,
    p_commission_rate numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Check admin/owner permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Find user by email
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_user_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'user_not_found';
    END IF;

    -- Create operator record
    INSERT INTO operators (display_name, commission_rate, user_id)
    VALUES (p_display_name, p_commission_rate, v_user_id);

    -- Ensure profile has operator role
    INSERT INTO profiles (user_id, role)
    VALUES (v_user_id, 'collaborator')
    ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator'
    WHERE profiles.role NOT IN ('admin', 'owner');
END;
$$;

COMMIT;

-- ============================================================
-- DONE! All RPC functions are now available.
-- ============================================================
