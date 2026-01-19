# RLS Security Verification - SQL Scripts

> **IMPORTANTE**: Esegui questi script nel **SQL Editor di Supabase**.
> NON modificano lo schema, creano/aggiornano policies e RPC.

---

## 1. VERIFICA STATO ATTUALE (SAFE - solo SELECT)

```sql
-- Controlla se RLS è attivo
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('appointments', 'operators', 'services', 'patients', 'profiles');

-- Lista policies esistenti
SELECT tablename, policyname, cmd, qual::text
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verifica struttura RPC get_my_appointments_op
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'get_my_appointments_op';
```

---

## 2. RPC SICURA PER OPERATORI (senza commission fields)

Questa RPC restituisce SOLO i campi safe, escludendo `commission_rate` e `commission_amount_cents`.

```sql
-- Drop e ricrea la RPC per operatori
DROP FUNCTION IF EXISTS get_my_appointments_op(int);

CREATE OR REPLACE FUNCTION get_my_appointments_op(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  status text,
  operator_name text,
  service_name text,
  patient_name text,
  gross_amount_cents int,
  notes text,
  service_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator_id uuid;
BEGIN
  -- Trova l'operatore collegato all'utente autenticato
  SELECT op.id INTO v_operator_id
  FROM operators op
  WHERE op.user_id = auth.uid();

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'operator_not_found';
  END IF;

  -- Restituisce SOLO i campi safe (NO commission_rate, NO commission_amount_cents)
  RETURN QUERY
  SELECT 
    a.id,
    a.starts_at,
    a.status,
    op.display_name AS operator_name,
    s.name AS service_name,
    p.display_name AS patient_name,
    a.gross_amount_cents,
    a.notes,
    a.service_id
  FROM appointments a
  LEFT JOIN operators op ON a.operator_id = op.id
  LEFT JOIN services s ON a.service_id = s.id
  LEFT JOIN patients p ON a.patient_id = p.id
  WHERE a.operator_id = v_operator_id
  ORDER BY a.starts_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute per utenti autenticati
GRANT EXECUTE ON FUNCTION get_my_appointments_op(int) TO authenticated;
```

---

## 3. RLS POLICIES RAFFORZATE

```sql
-- ============================================================
-- APPOINTMENTS: operatori vedono solo i propri
-- ============================================================

-- Drop policy esistente se presente
DROP POLICY IF EXISTS "operators_own_appointments" ON appointments;

-- Ricrea con regole strette
CREATE POLICY "operators_own_appointments" ON appointments
FOR ALL
TO authenticated
USING (
  -- Operatore vede solo i propri appuntamenti
  operator_id IN (
    SELECT id FROM operators WHERE user_id = auth.uid()
  )
  OR
  -- Admin/Owner vedono tutto
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('owner', 'admin')
  )
);

-- ============================================================
-- OPERATORS: nascondi commission_rate agli operatori
-- ============================================================

-- Gli operatori possono vedere SOLO il proprio record
DROP POLICY IF EXISTS "operators_own_record" ON operators;

CREATE POLICY "operators_own_record" ON operators
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

-- ============================================================
-- VIEW SICURA per operatori (alternativa alla RPC)
-- ============================================================

DROP VIEW IF EXISTS v_my_appointments_safe;

CREATE VIEW v_my_appointments_safe AS
SELECT 
  a.id,
  a.starts_at,
  a.status,
  a.gross_amount_cents,
  a.notes,
  a.service_id,
  a.operator_id,
  op.display_name AS operator_name,
  s.name AS service_name,
  p.display_name AS patient_name
  -- ESCLUSI: commission_rate, commission_amount_cents
FROM appointments a
LEFT JOIN operators op ON a.operator_id = op.id
LEFT JOIN services s ON a.service_id = s.id
LEFT JOIN patients p ON a.patient_id = p.id;

-- RLS sulla view (se necessario)
ALTER VIEW v_my_appointments_safe SET (security_invoker = true);
```

---

## 4. TEST DI SICUREZZA

### Query che DEVONO FALLIRE (come operatore):

```sql
-- TEST 1: Query diretta su commission fields (deve restituire NULL o errore)
-- Esegui come operatore (non admin)
SELECT commission_rate, commission_amount_cents 
FROM appointments 
LIMIT 1;
-- EXPECTED: errore o campi non accessibili via RLS

-- TEST 2: Accesso a appuntamenti altrui (deve restituire 0 righe)
SELECT * FROM appointments WHERE operator_id != 'MY_OPERATOR_ID';
-- EXPECTED: 0 righe

-- TEST 3: Leggere commission_rate di altri operatori
SELECT id, display_name, commission_rate FROM operators;
-- EXPECTED: solo il proprio record, o errore
```

### Query che DEVONO PASSARE (come operatore):

```sql
-- TEST 4: RPC safe per i propri appuntamenti
SELECT * FROM get_my_appointments_op(10);
-- EXPECTED: lista appuntamenti SENZA commission fields

-- TEST 5: Leggere servizi (pubblici)
SELECT id, name, price_cents FROM services;
-- EXPECTED: tutti i servizi

-- TEST 6: Creare appuntamento proprio
-- (via RPC op_create_appointment - già sicura)
```

### Query che DEVONO PASSARE (come admin):

```sql
-- TEST 7: Admin vede commission fields
SELECT id, commission_rate, commission_amount_cents 
FROM appointments 
LIMIT 10;
-- EXPECTED: tutti i dati incluse commissioni

-- TEST 8: Admin vede tutti gli operatori con commission_rate
SELECT id, display_name, commission_rate FROM operators;
-- EXPECTED: tutti gli operatori
```

---

## 5. VERIFICA FRONTEND

Il frontend `/op/*` usa già `get_my_appointments_op` che restituisce solo campi safe:
- `id`, `starts_at`, `status`, `operator_name`, `service_name`, `patient_name`, `gross_amount_cents`

**NON restituisce**: `commission_rate`, `commission_amount_cents`

Nessuna modifica frontend necessaria se la RPC è già safe.

---

## CHECKLIST FINALE

- [ ] Eseguire script sezione 1 per verificare stato
- [ ] Eseguire script sezione 2 per RPC safe
- [ ] Eseguire script sezione 3 per RLS policies
- [ ] Eseguire test sezione 4 come operatore
- [ ] Eseguire test sezione 4 come admin
- [ ] Verificare frontend op non mostra commissioni
