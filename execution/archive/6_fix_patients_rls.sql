-- ===========================================
-- FIX: Permetti lettura tabella patients
-- Esegui in Supabase SQL Editor
-- ===========================================

-- 1. Verifica che RLS sia attivo
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- 2. Rimuovi policy esistenti se ci sono problemi
DROP POLICY IF EXISTS "Authenticated users can read patients" ON patients;

-- 3. Crea policy di lettura per utenti autenticati
CREATE POLICY "Authenticated users can read patients" 
ON patients 
FOR SELECT 
TO authenticated 
USING (true);

-- 4. Verifica la struttura della tabella
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'patients';

-- Se manca display_name, esegui anche:
-- ALTER TABLE patients ADD COLUMN IF NOT EXISTS display_name text;
