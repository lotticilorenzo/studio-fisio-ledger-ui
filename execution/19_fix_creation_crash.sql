-- ===========================================
-- FIX: Creation Crash (Admin & Operator)
-- 1. Fixes admin_create using wrong column (display_name -> full_name)
-- 2. Fixes op_create failing on commission constraints
-- ===========================================

-- 1. SYSTEM FIX: admin_create_appointment
CREATE OR REPLACE FUNCTION admin_create_appointment(
    p_operator_id uuid,
    p_service_id uuid,
    p_patient_name text,
    p_starts_at timestamptz,
    p_status text,
    p_gross_amount_cents int,
    p_notes text,
    p_marketing_consent boolean DEFAULT false -- Added to match signature if needed
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

    -- Find or create patient (FIX: uses full_name)
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE full_name = trim(p_patient_name) LIMIT 1;
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (full_name) VALUES (trim(p_patient_name)) RETURNING id INTO v_patient_id;
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


-- 2. SYSTEM FIX: op_create_appointment
CREATE OR REPLACE FUNCTION public.op_create_appointment(
  p_starts_at timestamptz,
  p_service_id uuid,
  p_patient_name text,
  p_gross_amount_cents integer,
  p_notes text,
  p_marketing_consent boolean,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_operator_id uuid;
  v_patient_id uuid;
  v_appt_id uuid;
  v_comm_rate numeric;
  v_comm_cents integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid is NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- trova operatore e rate
  SELECT id, commission_rate INTO v_operator_id, v_comm_rate
  FROM public.operators
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'operator_not_found';
  END IF;

  -- Default commission to 0 if null
  IF v_comm_rate IS NULL THEN v_comm_rate := 0; END IF;
  v_comm_cents := round(p_gross_amount_cents * v_comm_rate);

  -- crea paziente con CONTATTI
  INSERT INTO public.patients (
    full_name, 
    email,
    phone,
    marketing_consent, 
    marketing_consent_at, 
    marketing_consent_source, 
    marketing_consent_by
  )
  VALUES (
    trim(p_patient_name),
    trim(nullif(p_email, '')),
    trim(nullif(p_phone, '')),
    coalesce(p_marketing_consent, false),
    CASE WHEN coalesce(p_marketing_consent, false) THEN now() ELSE NULL END,
    CASE WHEN coalesce(p_marketing_consent, false) THEN 'in_app_operator' ELSE NULL END,
    CASE WHEN coalesce(p_marketing_consent, false) THEN v_uid ELSE NULL END
  )
  RETURNING id INTO v_patient_id;

  -- crea appuntamento (FIX: Includes commission fields to avoid NOT NULL error)
  INSERT INTO public.appointments (
    operator_id, service_id, patient_id,
    starts_at, status, gross_amount_cents, notes, created_by,
    commission_rate, commission_amount_cents
  )
  VALUES (
    v_operator_id, p_service_id, v_patient_id,
    p_starts_at, 'scheduled', p_gross_amount_cents, nullif(p_notes, ''), v_uid,
    v_comm_rate, v_comm_cents
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;
END;
$$;

-- Grant per sicurezza
GRANT EXECUTE ON FUNCTION admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.op_create_appointment(timestamptz, uuid, text, integer, text, boolean, text, text) TO authenticated;
