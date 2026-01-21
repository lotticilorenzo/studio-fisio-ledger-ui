-- ============================================================
-- RPC per modifica appuntamenti da Admin
-- Esegui in Supabase SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS admin_get_appointment_by_id(uuid);
DROP FUNCTION IF EXISTS admin_update_appointment(uuid, uuid, uuid, text, timestamptz, text, int, text, boolean);

-- 1. RPC per caricare un singolo appuntamento con tutti i dettagli
CREATE OR REPLACE FUNCTION admin_get_appointment_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  status text,
  gross_amount_cents integer,
  notes text,
  operator_id uuid,
  operator_name text,
  service_id uuid,
  service_name text,
  patient_id uuid,
  patient_name text,
  marketing_consent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Non hai i permessi per visualizzare questo appuntamento.';
  END IF;
  
  RETURN QUERY
  SELECT 
    a.id,
    a.starts_at,
    a.status,
    a.gross_amount_cents,
    a.notes,
    a.operator_id,
    o.display_name as operator_name,
    a.service_id,
    s.name as service_name,
    a.patient_id,
    p.full_name as patient_name,
    p.marketing_consent
  FROM appointments a
  LEFT JOIN operators o ON a.operator_id = o.id
  LEFT JOIN services s ON a.service_id = s.id
  LEFT JOIN patients p ON a.patient_id = p.id
  WHERE a.id = p_id;
END;
$$;

-- 2. RPC per aggiornare un appuntamento
CREATE OR REPLACE FUNCTION admin_update_appointment(
  p_id uuid,
  p_operator_id uuid,
  p_service_id uuid,
  p_patient_name text,
  p_starts_at timestamptz,
  p_status text,
  p_gross_amount_cents int,
  p_notes text,
  p_marketing_consent boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_tenant_id uuid;
  v_patient_id uuid;
  v_commission_rate numeric;
  v_commission_amount_cents int;
BEGIN
  SELECT role, tenant_id INTO v_role, v_tenant_id 
  FROM profiles WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Non hai i permessi per modificare questo appuntamento.';
  END IF;
  
  -- Find or create patient
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
      UPDATE patients SET marketing_consent = COALESCE(p_marketing_consent, marketing_consent)
      WHERE id = v_patient_id;
    END IF;
  END IF;
  
  -- Get commission rate
  SELECT commission_rate INTO v_commission_rate FROM operators WHERE id = p_operator_id;
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 0;
  END IF;
  
  -- Calculate commission
  v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);
  
  -- Update appointment
  UPDATE appointments SET
    operator_id = p_operator_id,
    service_id = p_service_id,
    patient_id = v_patient_id,
    starts_at = p_starts_at,
    status = p_status,
    gross_amount_cents = p_gross_amount_cents,
    commission_rate = v_commission_rate,
    commission_amount_cents = v_commission_amount_cents,
    notes = p_notes
  WHERE id = p_id;
END;
$$;

-- 3. Concedi permessi
GRANT EXECUTE ON FUNCTION admin_get_appointment_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_appointment(uuid, uuid, uuid, text, timestamptz, text, int, text, boolean) TO authenticated;
