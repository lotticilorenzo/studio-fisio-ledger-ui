-- ============================================================
-- MISSING RPCs RESTORATION SCRIPT
-- Include tutte le RPC mancanti identificate dal frontend.
-- ============================================================

-- 1. get_my_services_op
CREATE OR REPLACE FUNCTION get_my_services_op()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, name FROM services ORDER BY name;
$$;

-- 2. op_create_appointment
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
  -- Get operator id for current user
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

  -- Insert
  INSERT INTO appointments (
    operator_id,
    service_id,
    patient_id,
    starts_at,
    status,
    gross_amount_cents,
    commission_rate,
    commission_amount_cents,
    notes
  ) VALUES (
    v_operator_id,
    p_service_id,
    v_patient_id,
    p_starts_at,
    'scheduled',
    p_gross_amount_cents,
    v_commission_rate,
    v_commission_amount_cents,
    p_notes
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- 3. get_appointment_by_id_op
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
    a.id,
    a.starts_at,
    a.service_id,
    a.gross_amount_cents,
    a.notes,
    a.status,
    p.display_name as patient_name
  FROM appointments a
  LEFT JOIN patients p ON a.patient_id = p.id
  WHERE a.id = p_id
    AND a.operator_id = (SELECT o.id FROM operators o WHERE o.user_id = auth.uid());
END;
$$;

-- 4. op_cancel_appointment
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

-- 5. admin_month_summary
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
  -- p_year_month format 'YYYY-MM'
  v_start := to_timestamp(p_year_month || '-01', 'YYYY-MM-DD');
  v_end := v_start + interval '1 month' - interval '1 millisecond';

  RETURN QUERY
  SELECT 
    op.id AS operator_id,
    op.display_name AS operator_name,
    count(a.id) AS num_appointments,
    coalesce(sum(a.gross_amount_cents), 0)::bigint AS total_gross_cents,
    coalesce(sum(a.commission_amount_cents), 0)::bigint AS total_commission_cents,
    (coalesce(sum(a.gross_amount_cents), 0) - coalesce(sum(a.commission_amount_cents), 0))::bigint AS total_net_cents
  FROM operators op
  LEFT JOIN appointments a ON op.id = a.operator_id 
    AND a.starts_at >= v_start 
    AND a.starts_at <= v_end
    AND a.status != 'cancelled' -- Escludiamo disdetti? Di solito sì nei report finanziari
  GROUP BY op.id, op.display_name
  ORDER BY op.display_name;
END;
$$;

-- 6. admin_link_user_to_operator
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
  -- Check permissions
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  -- Find user by email (WARNING: requires access to auth schema or assumption)
  -- This works if strict security is not blocking access to auth.users from security definer functions,
  -- OR we can try to find in profiles if emails are synced there. 
  -- Assuming auth.users access for now.
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_user_email LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Insert or Update operator
  INSERT INTO operators (display_name, commission_rate, user_id)
  VALUES (p_display_name, p_commission_rate, v_user_id);
  
  -- Optionally update profile role to operator if not admin?
  -- UPDATE profiles SET role = 'operator' WHERE user_id = v_user_id AND role NOT IN ('admin', 'owner');
END;
$$;
