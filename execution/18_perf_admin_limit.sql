-- ===========================================
-- FIX: Performance Limit per admin_get_appointments
-- Esegui questo script in Supabase SQL Editor
-- ===========================================

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
SET search_path = public
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
  LIMIT 2000; -- Protezione di sicurezza (evita crash se >2000 righe)
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_appointments(timestamptz, timestamptz) TO authenticated;
