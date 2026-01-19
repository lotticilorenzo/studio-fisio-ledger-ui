-- ============================================================
-- STUDIO FISIO LEDGER - SQL Scripts per Supabase
-- Esegui questi script nel SQL Editor di Supabase
-- ============================================================

-- ============================================================
-- 1. VERIFICA RLS (solo lettura, sicuro)
-- ============================================================

-- Controlla se RLS è attivo sulle tabelle
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('appointments', 'operators', 'services', 'patients', 'profiles');

-- Lista tutte le policies esistenti
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';


-- ============================================================
-- 2. RLS POLICY PER ADMIN UPDATE SU OPERATORS
-- (richiesto per inline edit operatori)
-- ============================================================

-- Permetti agli admin/owner di aggiornare gli operatori
CREATE POLICY "admin_update_operators" ON operators
FOR UPDATE
TO authenticated
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
-- 3. AGGIORNA RPC op_update_appointment per service_id
-- (P1.2 - permette all'operatore di cambiare servizio)
-- ============================================================

-- Prima drop della funzione esistente (se esiste)
DROP FUNCTION IF EXISTS op_update_appointment(uuid, timestamptz, text, int, text);

-- Ricrea con parametro service_id
CREATE OR REPLACE FUNCTION op_update_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_status text,
  p_gross_amount_cents int,
  p_notes text DEFAULT NULL,
  p_service_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operator_id uuid;
BEGIN
  -- Trova l'operatore corrente
  SELECT id INTO v_operator_id
  FROM operators
  WHERE user_id = auth.uid();

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'operator_not_found';
  END IF;

  -- Aggiorna solo se l'appuntamento appartiene all'operatore
  UPDATE appointments
  SET 
    starts_at = p_starts_at,
    status = p_status,
    gross_amount_cents = p_gross_amount_cents,
    notes = p_notes,
    service_id = COALESCE(p_service_id, service_id),
    updated_at = now()
  WHERE id = p_appointment_id
    AND operator_id = v_operator_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found_or_forbidden';
  END IF;
END;
$$;


-- ============================================================
-- 4. RLS POLICIES COMPLETE (se mancanti)
-- ============================================================

-- APPOINTMENTS: operatori vedono solo i propri
CREATE POLICY "operators_own_appointments" ON appointments
FOR ALL
TO authenticated
USING (
  operator_id IN (
    SELECT id FROM operators WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);

-- PATIENTS: operatori vedono solo pazienti con cui hanno appuntamenti
CREATE POLICY "operators_own_patients" ON patients
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT patient_id FROM appointments 
    WHERE operator_id IN (
      SELECT id FROM operators WHERE user_id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);

-- PATIENTS: operatori possono inserire pazienti
CREATE POLICY "operators_insert_patients" ON patients
FOR INSERT
TO authenticated
WITH CHECK (true);

-- SERVICES: tutti possono leggere
CREATE POLICY "anyone_read_services" ON services
FOR SELECT
TO authenticated
USING (true);

-- OPERATORS: solo admin possono leggere tutti
CREATE POLICY "admin_read_operators" ON operators
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);
