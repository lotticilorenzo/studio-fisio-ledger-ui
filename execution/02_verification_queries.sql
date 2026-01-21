-- ============================================================
-- SCRIPT DI VERIFICA (Checklist Step 1, 2, 5)
-- Esegui questo script e controlla i risultati in basso
-- ============================================================

-- 1. VERIFICA ESISTENZA RPC E PERMESSI (Step 1 & 5)
-- Controlla se le funzioni esistono
SELECT n.nspname as schema, p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('op_create_appointment', 'get_my_appointments_op')
ORDER BY 1, 2;

-- Controlla i permessi di esecuzione (cerca 'authenticated')
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN ('op_create_appointment', 'get_my_appointments_op');


-- 2. VERIFICA VINCOLO STATUS (Step 2)
-- Controlla quali valori sono ammessi per 'status' nella tabella appointments
SELECT conname as constraint_name, pg_get_constraintdef(c.oid) as definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'appointments'
AND c.conname = 'appointments_status_check';
