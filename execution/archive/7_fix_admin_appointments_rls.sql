-- ===========================================
-- FIX: Permetti lettura appuntamenti per Admin/Owner
-- Esegui in Supabase SQL Editor
-- ===========================================

-- 1. Assicurati che RLS sia attivo
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 2. Rimuovi policy problematiche esistenti
DROP POLICY IF EXISTS "Admin can read all appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can read all appointments" ON appointments;

-- 3. Crea policy per admin/owner: possono leggere TUTTI gli appuntamenti
CREATE POLICY "Admins can read all appointments" 
ON appointments 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('admin', 'owner')
  )
);

-- 4. Verifica che esista anche la policy per gli operatori (solo i propri)
DROP POLICY IF EXISTS "Operators can read own appointments" ON appointments;

CREATE POLICY "Operators can read own appointments" 
ON appointments 
FOR SELECT 
TO authenticated 
USING (
  operator_id IN (
    SELECT id FROM operators WHERE user_id = auth.uid()
  )
);

-- 5. Verifica le policy esistenti
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'appointments';
