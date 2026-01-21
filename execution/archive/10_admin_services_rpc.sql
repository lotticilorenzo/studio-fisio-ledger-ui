-- ===========================================
-- FIX: RPC per creare servizi con tenant_id automatico
-- Esegui in Supabase SQL Editor
-- ===========================================

-- 1. Crea la funzione RPC per admin
CREATE OR REPLACE FUNCTION admin_create_service(
  p_name text,
  p_duration_minutes integer,
  p_default_price_cents integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_tenant_id uuid;
  v_service_id uuid;
BEGIN
  -- Verifica che l'utente sia admin o owner
  SELECT role, tenant_id INTO v_role, v_tenant_id
  FROM profiles 
  WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Non hai i permessi per creare servizi.';
  END IF;
  
  IF v_tenant_id IS NULL THEN
    -- Se non c'è tenant_id nel profilo, usa un default o crea uno
    v_tenant_id := gen_random_uuid();
  END IF;
  
  INSERT INTO services (
    tenant_id,
    name,
    duration_minutes,
    default_duration_min,
    default_price_cents
  ) VALUES (
    v_tenant_id,
    trim(p_name),
    p_duration_minutes,
    p_duration_minutes,
    p_default_price_cents
  )
  RETURNING id INTO v_service_id;
  
  RETURN v_service_id;
END;
$$;

-- 2. RPC per aggiornare servizi
CREATE OR REPLACE FUNCTION admin_update_service(
  p_service_id uuid,
  p_name text,
  p_duration_minutes integer,
  p_default_price_cents integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM profiles 
  WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Non hai i permessi per modificare servizi.';
  END IF;
  
  UPDATE services SET
    name = trim(p_name),
    duration_minutes = p_duration_minutes,
    default_duration_min = p_duration_minutes,
    default_price_cents = p_default_price_cents,
    updated_at = now()
  WHERE id = p_service_id;
END;
$$;

-- 3. RPC per eliminare servizi
CREATE OR REPLACE FUNCTION admin_delete_service(p_service_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM profiles 
  WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Non hai i permessi per eliminare servizi.';
  END IF;
  
  DELETE FROM services WHERE id = p_service_id;
END;
$$;

-- 4. RPC per leggere servizi (admin)
CREATE OR REPLACE FUNCTION admin_get_services()
RETURNS TABLE (
  id uuid,
  name text,
  duration_minutes integer,
  default_price_cents integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM profiles 
  WHERE user_id = auth.uid();
  
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Non hai i permessi per visualizzare i servizi.';
  END IF;
  
  RETURN QUERY
  SELECT s.id, s.name, s.duration_minutes, s.default_price_cents, s.created_at
  FROM services s
  ORDER BY s.name;
END;
$$;

-- 5. Concedi permessi
GRANT EXECUTE ON FUNCTION admin_create_service(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_service(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_service(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_services() TO authenticated;
