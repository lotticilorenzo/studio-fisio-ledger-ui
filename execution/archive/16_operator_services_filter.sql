-- ============================================================
-- FIX: Operatori vedono solo i propri servizi
-- ============================================================
-- ESEGUI IN SUPABASE SQL EDITOR
-- ============================================================

-- 1. Crea la tabella di associazione operator_services
-- ============================================================
CREATE TABLE IF NOT EXISTS operator_services (
  operator_id uuid REFERENCES operators(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (operator_id, service_id)
);

-- Abilita RLS
ALTER TABLE operator_services ENABLE ROW LEVEL SECURITY;

-- Policy: operatori vedono solo le proprie associazioni
CREATE POLICY "operators_own_services" ON operator_services
FOR SELECT TO authenticated
USING (
  operator_id IN (SELECT id FROM operators WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);

-- Policy: admin possono inserire/eliminare
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

-- 2. Popola i dati iniziali (basato sui nomi)
-- ============================================================

-- Ostetrica -> Ostetricia
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%ostetric%'
  AND LOWER(s.name) LIKE '%ostetric%'
ON CONFLICT DO NOTHING;

-- Psicologa -> Psicologia
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%psicolog%'
  AND LOWER(s.name) LIKE '%psicolog%'
ON CONFLICT DO NOTHING;

-- Pilates -> Pilates clinico
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%pilates%'
  AND LOWER(s.name) LIKE '%pilates%'
ON CONFLICT DO NOTHING;

-- Fisioterapista -> tutti i servizi che contengono "fisio" o "terapia"
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%fisio%'
  AND (LOWER(s.name) LIKE '%fisio%' OR LOWER(s.name) LIKE '%terapia%')
ON CONFLICT DO NOTHING;

-- Nutrizionista -> Nutrizione o servizi correlati
INSERT INTO operator_services (operator_id, service_id)
SELECT o.id, s.id
FROM operators o, services s
WHERE LOWER(o.display_name) LIKE '%nutri%'
  AND (LOWER(s.name) LIKE '%nutri%' OR LOWER(s.name) LIKE '%dieta%' OR LOWER(s.name) LIKE '%alimenta%')
ON CONFLICT DO NOTHING;

-- 3. Aggiorna la RPC get_my_services_op
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
    ORDER BY s.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_services_op() TO authenticated;

-- 4. Verifica i dati inseriti
-- ============================================================
SELECT 
  o.display_name as operatore,
  s.name as servizio
FROM operator_services os
JOIN operators o ON os.operator_id = o.id
JOIN services s ON os.service_id = s.id
ORDER BY o.display_name, s.name;

-- ============================================================
-- DONE! Ora ogni operatore vede solo i propri servizi.
-- Se un operatore non vede servizi, aggiungi manualmente:
--
-- INSERT INTO operator_services (operator_id, service_id)
-- VALUES ('operator-uuid', 'service-uuid');
-- ============================================================
