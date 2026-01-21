-- ============================================================
-- FIX DEFINITIVO: RPC per appuntamenti con marketing_consent
-- Esegui in Supabase SQL Editor
-- ============================================================

-- Prima elimina le funzioni esistenti
DROP FUNCTION IF EXISTS admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text);
DROP FUNCTION IF EXISTS admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text, boolean);
DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, int, text);
DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, int, text, boolean);

-- 1. admin_create_appointment con marketing_consent
CREATE OR REPLACE FUNCTION admin_create_appointment(
  p_operator_id uuid,
  p_service_id uuid,
  p_patient_name text,
  p_starts_at timestamptz,
  p_status text,
  p_gross_amount_cents int,
  p_notes text,
  p_marketing_consent boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_commission_rate numeric;
  v_commission_amount_cents int;
  v_new_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Get user's tenant_id
  SELECT tenant_id INTO v_tenant_id 
  FROM profiles 
  WHERE user_id = auth.uid();
  
  -- Check permissions (admin/owner only)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  -- Find or create patient with tenant_id
  IF p_patient_name IS NOT NULL AND trim(p_patient_name) <> '' THEN
    SELECT id INTO v_patient_id 
    FROM patients 
    WHERE full_name = trim(p_patient_name) 
      AND tenant_id = v_tenant_id
    LIMIT 1;
    
    IF v_patient_id IS NULL THEN
      INSERT INTO patients (full_name, tenant_id, marketing_consent) 
      VALUES (trim(p_patient_name), v_tenant_id, COALESCE(p_marketing_consent, false)) 
      RETURNING id INTO v_patient_id;
    ELSE
      -- Aggiorna il consenso se il paziente esiste già
      UPDATE patients SET marketing_consent = COALESCE(p_marketing_consent, marketing_consent)
      WHERE id = v_patient_id;
    END IF;
  END IF;

  -- Get operator commission rate
  SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = p_operator_id;
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 0;
  END IF;

  -- Calculate commission amount
  v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

  -- Insert appointment
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

-- 2. op_create_appointment con marketing_consent
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
  v_tenant_id uuid;
BEGIN
  -- Get operator ID and tenant_id for current user
  SELECT o.id, p.tenant_id INTO v_operator_id, v_tenant_id
  FROM operators o
  JOIN profiles p ON o.user_id = p.user_id
  WHERE o.user_id = auth.uid();

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'operator_not_found';
  END IF;

  -- Find or create patient with tenant_id
  IF p_patient_full_name IS NOT NULL AND trim(p_patient_full_name) <> '' THEN
    SELECT id INTO v_patient_id 
    FROM patients 
    WHERE full_name = trim(p_patient_full_name)
      AND tenant_id = v_tenant_id
    LIMIT 1;
    
    IF v_patient_id IS NULL THEN
      INSERT INTO patients (full_name, tenant_id, marketing_consent) 
      VALUES (trim(p_patient_full_name), v_tenant_id, COALESCE(p_marketing_consent, false)) 
      RETURNING id INTO v_patient_id;
    ELSE
      -- Aggiorna il consenso se il paziente esiste già
      UPDATE patients SET marketing_consent = COALESCE(p_marketing_consent, marketing_consent)
      WHERE id = v_patient_id;
    END IF;
  END IF;

  -- Get commission rate
  SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = v_operator_id;
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 0;
  END IF;

  -- Calculate commission
  v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

  -- Insert appointment
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

-- 3. Concedi permessi
GRANT EXECUTE ON FUNCTION admin_create_appointment(uuid, uuid, text, timestamptz, text, int, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION op_create_appointment(uuid, timestamptz, text, int, text, boolean) TO authenticated;
