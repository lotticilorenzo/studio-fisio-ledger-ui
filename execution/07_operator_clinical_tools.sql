-- ============================================================
-- 07_operator_clinical_tools.sql (DEFINITIVE VERSION)
-- ============================================================

-- 1. Pulizia totale
DROP FUNCTION IF EXISTS op_get_my_patients();
DROP FUNCTION IF EXISTS get_appointment_by_id_op(uuid);
DROP FUNCTION IF EXISTS get_my_appointments_op(int);
DROP FUNCTION IF EXISTS op_get_patient_clinical_history(uuid);
DROP FUNCTION IF EXISTS op_create_appointment(timestamptz, uuid, text, int, text, boolean, text, text);

-- 2. Lista pazienti per operatore (Utilizza prefissi p_)
CREATE OR REPLACE FUNCTION op_get_my_patients()
RETURNS TABLE (p_id uuid, p_display_name text, p_last_visit timestamptz, p_total_appointments bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_op_id uuid;
BEGIN
    SELECT id INTO v_op_id FROM operators WHERE user_id = auth.uid();
    RETURN QUERY
    SELECT pat.id, pat.full_name, MAX(app.starts_at), COUNT(app.id)
    FROM patients pat JOIN appointments app ON app.patient_id = pat.id
    WHERE app.operator_id = v_op_id AND app.status != 'cancelled'
    GROUP BY pat.id, pat.full_name ORDER BY 3 DESC;
END; $$;

-- 3. Storico clinico paziente (Utilizza prefissi h_)
CREATE OR REPLACE FUNCTION op_get_patient_clinical_history(p_patient_id uuid)
RETURNS TABLE (h_appointment_id uuid, h_starts_at timestamptz, h_service_name text, h_notes text, h_status text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_op_id uuid;
BEGIN
    SELECT id INTO v_op_id FROM operators WHERE user_id = auth.uid();
    RETURN QUERY
    SELECT a.id, a.starts_at, s.name, a.notes, a.status
    FROM appointments a LEFT JOIN services s ON a.service_id = s.id
    WHERE a.patient_id = p_patient_id AND a.operator_id = v_op_id AND a.status != 'cancelled'
    ORDER BY a.starts_at DESC;
END; $$;

-- 4. Dettaglio appuntamento (Utilizza prefissi appt_)
CREATE OR REPLACE FUNCTION get_appointment_by_id_op(p_id uuid)
RETURNS TABLE (appt_id uuid, appt_starts_at timestamptz, appt_service_id uuid, appt_gross_amount_cents int, appt_notes text, appt_status text, appt_patient_name text, appt_patient_id uuid)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_op_id uuid;
BEGIN
    SELECT id INTO v_op_id FROM operators WHERE user_id = auth.uid();
    RETURN QUERY
    SELECT a.id, a.starts_at, a.service_id, a.gross_amount_cents, a.notes, a.status, p.full_name, a.patient_id
    FROM appointments a LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.id = p_id AND a.operator_id = v_op_id;
END; $$;

-- 5. Creazione appuntamento (Fix RETURNING INTO)
CREATE OR REPLACE FUNCTION op_create_appointment(p_starts_at timestamptz, p_service_id uuid, p_patient_name text, p_gross_amount_cents int, p_notes text DEFAULT NULL, p_marketing_consent boolean DEFAULT false, p_email text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op_id uuid; v_vpat_id uuid; v_rate numeric; v_cents int; v_tent uuid; v_new_id uuid;
BEGIN
    SELECT o.id, o.commission_rate, pr.tenant_id INTO v_op_id, v_rate, v_tent FROM operators o JOIN profiles pr ON o.user_id = pr.user_id WHERE o.user_id = auth.uid();
    IF v_op_id IS NULL THEN RAISE EXCEPTION 'operator_not_found'; END IF;
    IF NOT EXISTS (SELECT 1 FROM operator_services WHERE operator_id = v_op_id AND service_id = p_service_id) THEN RAISE EXCEPTION 'service_not_assigned'; END IF;
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_vpat_id FROM patients WHERE lower(full_name) = lower(trim(p_patient_name)) AND tenant_id = v_tent LIMIT 1;
        IF v_vpat_id IS NULL THEN
            INSERT INTO patients (full_name, email, phone, marketing_consent, tenant_id) VALUES (trim(p_patient_name), p_email, p_phone, coalesce(p_marketing_consent, false), v_tent) RETURNING id INTO v_vpat_id;
        END IF;
    END IF;
    IF v_rate IS NULL THEN v_rate := 0; END IF;
    v_cents := round(p_gross_amount_cents * v_rate);
    INSERT INTO appointments (operator_id, service_id, patient_id, starts_at, status, gross_amount_cents, commission_rate, commission_amount_cents, notes, created_by)
    VALUES (v_op_id, p_service_id, v_vpat_id, p_starts_at, 'scheduled', p_gross_amount_cents, v_rate, v_cents, p_notes, auth.uid()) 
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
END; $$;

-- 6. Lista Dashboard (Utilizza prefissi res_)
CREATE OR REPLACE FUNCTION get_my_appointments_op(p_limit int DEFAULT 50)
RETURNS TABLE (res_id uuid, res_starts_at timestamptz, res_status text, res_gross_amount_cents int, res_operator_name text, res_service_name text, res_patient_name text, res_duration_minutes int)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_op_id uuid;
BEGIN
    SELECT id INTO v_op_id FROM operators WHERE user_id = auth.uid();
    RETURN QUERY
    SELECT app.id, app.starts_at, app.status, app.gross_amount_cents, ope.display_name, ser.name, pat.full_name, COALESCE(ser.duration_minutes, 60)
    FROM appointments app LEFT JOIN operators ope ON app.operator_id = ope.id LEFT JOIN services ser ON app.service_id = ser.id LEFT JOIN patients pat ON app.patient_id = pat.id
    WHERE app.operator_id = v_op_id ORDER BY app.starts_at DESC LIMIT p_limit;
END; $$;

-- 7. Grant finali
GRANT EXECUTE ON FUNCTION op_get_my_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION op_get_patient_clinical_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_appointment_by_id_op(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION op_create_appointment(timestamptz, uuid, text, int, text, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_appointments_op(int) TO authenticated;
