-- Fix for Admin Create Appointment (Crash on p.display_name) & Operator Create (Missing Commissions + Overload + Missing EndsAt + Missing TenantId)

-- 1. DROP ALL VARIATIONS to avoid "ambiguous function" errors
DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, integer, text, boolean, text, text);
DROP FUNCTION IF EXISTS op_create_appointment(timestamptz, uuid, text, integer, text, boolean, text, text);
DROP FUNCTION IF EXISTS admin_create_appointment(uuid, uuid, text, timestamptz, text, integer, text, boolean, text, text);
DROP FUNCTION IF EXISTS admin_create_appointment(uuid, uuid, text, timestamptz, text, integer, text, boolean);


-- 2. Re-create ADMIN create appointment
CREATE OR REPLACE FUNCTION admin_create_appointment(
    p_operator_id uuid,
    p_service_id uuid,
    p_patient_name text,
    p_starts_at timestamptz,
    p_status text,
    p_gross_amount_cents integer,
    p_notes text,
    p_marketing_consent boolean DEFAULT false,
    p_email text DEFAULT NULL,
    p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_patient_id uuid;
    v_commission_rate numeric;
    v_commission_amount_cents integer;
    v_new_id uuid;
    v_tenant_id uuid;
BEGIN
    -- Get Tenant ID from admin's profile
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = auth.uid();

    -- Check permissions
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')) THEN
        RAISE EXCEPTION 'access_denied';
    END IF;

    -- Patient logic (with tenant_id)
    IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE full_name = trim(p_patient_name) AND tenant_id = v_tenant_id LIMIT 1;
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (full_name, email, phone, marketing_consent, tenant_id) 
            VALUES (trim(p_patient_name), p_email, p_phone, p_marketing_consent, v_tenant_id) 
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- Commission logic
    SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = p_operator_id;
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    -- Insert appointment WITHOUT ends_at
    INSERT INTO appointments (
        operator_id, service_id, patient_id, starts_at, status,
        gross_amount_cents, commission_rate, commission_amount_cents, notes, created_by
    ) VALUES (
        p_operator_id, p_service_id, v_patient_id, p_starts_at, p_status,
        p_gross_amount_cents, v_commission_rate, v_commission_amount_cents, p_notes, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;


-- 3. Re-create OPERATOR create appointment
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
  v_service_assigned boolean;
  v_tenant_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid is NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Operator, Rate & Tenant ID
  -- We join profiles to get tenant_id
  SELECT o.id, o.commission_rate, p.tenant_id 
  INTO v_operator_id, v_comm_rate, v_tenant_id
  FROM public.operators o
  JOIN public.profiles p ON o.user_id = p.user_id
  WHERE o.user_id = v_uid 
  LIMIT 1;

  IF v_operator_id IS NULL THEN RAISE EXCEPTION 'operator_not_found'; END IF;

  -- Service Assignment
  SELECT EXISTS (
      SELECT 1 FROM operator_services
      WHERE operator_id = v_operator_id AND service_id = p_service_id
  ) INTO v_service_assigned;

  IF NOT v_service_assigned THEN RAISE EXCEPTION 'service_not_assigned'; END IF;

  -- Commissions
  IF v_comm_rate IS NULL THEN v_comm_rate := 0; END IF;
  v_comm_cents := round(p_gross_amount_cents * v_comm_rate);

  -- Patient (with tenant_id)
  SELECT id INTO v_patient_id FROM patients WHERE lower(full_name) = lower(trim(p_patient_name)) AND tenant_id = v_tenant_id LIMIT 1;
  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (
        full_name, email, phone, marketing_consent, tenant_id,
        marketing_consent_at, marketing_consent_source, marketing_consent_by
    ) VALUES (
        trim(p_patient_name), trim(nullif(p_email, '')), trim(nullif(p_phone, '')),
        coalesce(p_marketing_consent, false), v_tenant_id,
        CASE WHEN coalesce(p_marketing_consent, false) THEN now() ELSE NULL END,
        CASE WHEN coalesce(p_marketing_consent, false) THEN 'in_app_operator' ELSE NULL END,
        CASE WHEN coalesce(p_marketing_consent, false) THEN v_uid ELSE NULL END
    ) RETURNING id INTO v_patient_id;
  END IF;

  -- Insert Appointment WITHOUT ends_at
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

GRANT EXECUTE ON FUNCTION admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.op_create_appointment(timestamptz, uuid, text, integer, text, boolean, text, text) TO authenticated;
