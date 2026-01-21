-- ============================================================
-- OPERATOR-SERVICES SYSTEM (Complete)
-- ============================================================
-- ESEGUI IN SUPABASE SQL EDITOR
-- ============================================================

-- ============================================================
-- PARTE 1: Crea tabella operator_services
-- ============================================================

CREATE TABLE IF NOT EXISTS operator_services (
  operator_id uuid REFERENCES operators(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (operator_id, service_id)
);

-- RLS
ALTER TABLE operator_services ENABLE ROW LEVEL SECURITY;

-- Policy: operatori vedono solo le proprie associazioni
DROP POLICY IF EXISTS "operators_read_own_services" ON operator_services;
CREATE POLICY "operators_read_own_services" ON operator_services
FOR SELECT TO authenticated
USING (
  operator_id IN (SELECT id FROM operators WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);

-- Policy: admin può gestire tutto
DROP POLICY IF EXISTS "admin_manage_operator_services" ON operator_services;
CREATE POLICY "admin_manage_operator_services" ON operator_services
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);

-- ============================================================
-- PARTE 2: Seed servizi generici
-- ============================================================

-- Prendi il tenant_id dal primo profilo admin (o genera uno nuovo)
DO $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM profiles WHERE role IN ('admin','owner') LIMIT 1;
  IF v_tenant IS NULL THEN v_tenant := gen_random_uuid(); END IF;

  -- CORE (per tutti)
  INSERT INTO services (tenant_id, name, duration_minutes, default_duration_min, default_price_cents)
  VALUES 
    (v_tenant, 'Prima visita (valutazione)', 60, 60, 8000),
    (v_tenant, 'Seduta / Trattamento', 45, 45, 6000),
    (v_tenant, 'Controllo / Follow-up', 30, 30, 5000),
    (v_tenant, 'Percorso / Pacchetto', 60, 60, 25000),
    (v_tenant, 'Altro (specificare nelle note)', 45, 45, 5000)
  ON CONFLICT DO NOTHING;

  -- OSTETRICA
  INSERT INTO services (tenant_id, name, duration_minutes, default_duration_min, default_price_cents)
  VALUES 
    (v_tenant, 'Consulenza allattamento', 60, 60, 7000),
    (v_tenant, 'Gravidanza / Post-parto', 60, 60, 8000)
  ON CONFLICT DO NOTHING;

  -- NUTRIZIONISTA  
  INSERT INTO services (tenant_id, name, duration_minutes, default_duration_min, default_price_cents)
  VALUES 
    (v_tenant, 'Prima visita nutrizione', 60, 60, 9000),
    (v_tenant, 'Controllo nutrizione', 30, 30, 5000)
  ON CONFLICT DO NOTHING;

  -- PILATES
  INSERT INTO services (tenant_id, name, duration_minutes, default_duration_min, default_price_cents)
  VALUES 
    (v_tenant, 'Pilates clinico 1:1', 55, 55, 6000),
    (v_tenant, 'Pilates clinico gruppo', 55, 55, 2500)
  ON CONFLICT DO NOTHING;

  -- PSICOLOGA
  INSERT INTO services (tenant_id, name, duration_minutes, default_duration_min, default_price_cents)
  VALUES 
    (v_tenant, 'Primo colloquio psicologico', 60, 60, 8000),
    (v_tenant, 'Seduta psicologica', 50, 50, 7000)
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- PARTE 3: Assegna servizi CORE a tutti gli operatori
-- ============================================================

INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o
CROSS JOIN services s
WHERE s.name IN (
  'Prima visita (valutazione)',
  'Seduta / Trattamento',
  'Controllo / Follow-up',
  'Percorso / Pacchetto',
  'Altro (specificare nelle note)'
)
ON CONFLICT DO NOTHING;

-- Ostetrica -> servizi ostetrica
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%ostetric%'
  AND s.name IN ('Consulenza allattamento', 'Gravidanza / Post-parto')
ON CONFLICT DO NOTHING;

-- Nutrizionista -> servizi nutrizionista
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%nutri%'
  AND s.name IN ('Prima visita nutrizione', 'Controllo nutrizione')
ON CONFLICT DO NOTHING;

-- Pilates -> servizi pilates
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%pilates%'
  AND s.name IN ('Pilates clinico 1:1', 'Pilates clinico gruppo')
ON CONFLICT DO NOTHING;

-- Psicologa -> servizi psicologa
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%psicolog%'
  AND s.name IN ('Primo colloquio psicologico', 'Seduta psicologica')
ON CONFLICT DO NOTHING;

-- Fisioterapista -> tutti i core (già assegnati sopra)

-- ============================================================
-- PARTE 4: Aggiorna RPC get_my_services_op
-- ============================================================

DROP FUNCTION IF EXISTS get_my_services_op();

CREATE OR REPLACE FUNCTION get_my_services_op()
RETURNS TABLE (id uuid, name text)
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
    SELECT s.id, s.name 
    FROM services s
    INNER JOIN operator_services os ON s.id = os.service_id
    WHERE os.operator_id = v_operator_id
    ORDER BY 
      CASE WHEN s.name LIKE 'Altro%' THEN 1 ELSE 0 END,
      s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_services_op() TO authenticated;

-- ============================================================
-- PARTE 5: Aggiorna op_create_appointment per validare "Altro"
-- ============================================================

DROP FUNCTION IF EXISTS op_create_appointment(uuid, timestamptz, text, int, text, boolean);

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
    v_service_name text;
BEGIN
    -- Trova operatore
    SELECT id, commission_rate INTO v_operator_id, v_commission_rate
    FROM operators WHERE user_id = auth.uid();

    IF v_operator_id IS NULL THEN
        RAISE EXCEPTION 'operator_not_found';
    END IF;

    -- Verifica che il servizio sia assegnato all'operatore
    IF NOT EXISTS (
        SELECT 1 FROM operator_services 
        WHERE operator_id = v_operator_id AND service_id = p_service_id
    ) THEN
        RAISE EXCEPTION 'service_not_assigned';
    END IF;

    -- Controlla se "Altro" richiede note
    SELECT name INTO v_service_name FROM services WHERE id = p_service_id;
    IF v_service_name LIKE 'Altro%' AND (p_notes IS NULL OR trim(p_notes) = '') THEN
        RAISE EXCEPTION 'notes_required_for_altro';
    END IF;

    -- Gestisci paziente
    IF p_patient_full_name IS NOT NULL AND trim(p_patient_full_name) <> '' THEN
        SELECT id INTO v_patient_id FROM patients WHERE full_name = trim(p_patient_full_name) LIMIT 1;
        IF v_patient_id IS NULL THEN
            INSERT INTO patients (full_name) 
            VALUES (trim(p_patient_full_name)) 
            RETURNING id INTO v_patient_id;
        END IF;
    END IF;

    -- Calcola commissione
    IF v_commission_rate IS NULL THEN v_commission_rate := 0; END IF;
    v_commission_amount_cents := round(p_gross_amount_cents * v_commission_rate);

    -- Inserisci appuntamento
    INSERT INTO appointments (
        operator_id, service_id, patient_id, starts_at, status,
        gross_amount_cents, commission_rate, commission_amount_cents, notes
    ) VALUES (
        v_operator_id, p_service_id, v_patient_id, p_starts_at, 'scheduled',
        p_gross_amount_cents, v_commission_rate, v_commission_amount_cents, p_notes
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION op_create_appointment(uuid, timestamptz, text, int, text, boolean) TO authenticated;

-- ============================================================
-- PARTE 6: RPC Admin per gestire operator_services
-- ============================================================

-- Legge servizi assegnati a un operatore
CREATE OR REPLACE FUNCTION admin_get_operator_services(p_operator_id uuid)
RETURNS TABLE (service_id uuid, service_name text, assigned boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT 
    s.id as service_id,
    s.name as service_name,
    EXISTS(SELECT 1 FROM operator_services os WHERE os.operator_id = p_operator_id AND os.service_id = s.id) as assigned
  FROM services s
  ORDER BY s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_operator_services(uuid) TO authenticated;

-- Assegna/rimuove servizio a operatore
CREATE OR REPLACE FUNCTION admin_toggle_operator_service(p_operator_id uuid, p_service_id uuid, p_assign boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE user_id = auth.uid();
  IF v_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_assign THEN
    INSERT INTO operator_services (operator_id, service_id) 
    VALUES (p_operator_id, p_service_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM operator_services 
    WHERE operator_id = p_operator_id AND service_id = p_service_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_operator_service(uuid, uuid, boolean) TO authenticated;

-- ============================================================
-- VERIFICA
-- ============================================================
SELECT 
  o.display_name as operatore,
  COUNT(os.service_id) as num_servizi
FROM operators o
LEFT JOIN operator_services os ON o.id = os.operator_id
GROUP BY o.id, o.display_name
ORDER BY o.display_name;

-- ============================================================
-- DONE! 
-- ============================================================
