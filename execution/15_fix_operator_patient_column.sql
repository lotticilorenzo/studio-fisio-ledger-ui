-- ============================================================
-- FIX: get_my_appointments_op - colonna patient corretta
-- ============================================================
-- Il problema: la tabella patients usa "full_name", non "display_name"
-- Questo fix corregge l'errore "column p.display_name does not exist"
-- ============================================================
-- ESEGUI IN SUPABASE SQL EDITOR
-- ============================================================

DROP FUNCTION IF EXISTS get_my_appointments_op(int);

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
        p.full_name AS patient_name  -- FIX: era p.display_name
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

-- ============================================================
-- Anche get_appointment_by_id_op ha lo stesso problema
-- ============================================================

DROP FUNCTION IF EXISTS get_appointment_by_id_op(uuid);

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
        p.full_name as patient_name  -- FIX: era p.display_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.id = p_id
      AND a.operator_id = (SELECT o.id FROM operators o WHERE o.user_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION get_appointment_by_id_op(uuid) TO authenticated;

-- ============================================================
-- DONE! Ora gli operatori possono vedere i propri appuntamenti.
-- ============================================================
