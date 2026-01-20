-- ============================================================
-- RPC: admin_create_appointment
-- Permette agli admin di creare appuntamenti calcolando automaticamente
-- le commissioni in base all'operatore selezionato.
-- ============================================================

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
  -- 1. Check permissions (admin/owner only)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  -- 2. Find or create patient
  IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
    SELECT id INTO v_patient_id FROM patients WHERE display_name = trim(p_patient_name) LIMIT 1;
    IF v_patient_id IS NULL THEN
      INSERT INTO patients (display_name) VALUES (trim(p_patient_name)) RETURNING id INTO v_patient_id;
    END IF;
  END IF;

  -- 3. Get operator commission rate
  SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = p_operator_id;
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 0;
  END IF;

  -- 4. Calculate commission amount
  -- gross_amount_cents * commission_rate (rounded)
  v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

  -- 5. Insert appointment
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
    p_operator_id,
    p_service_id,
    v_patient_id,
    p_starts_at,
    p_status,
    p_gross_amount_cents,
    v_commission_rate,
    v_commission_amount_cents,
    p_notes
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
