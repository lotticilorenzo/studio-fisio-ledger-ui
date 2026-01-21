-- ===========================================
-- DIAGNOSI: Controlla struttura tabella services
-- Esegui in Supabase SQL Editor
-- ===========================================

-- 1. Vedi tutte le colonne della tabella services
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'services'
ORDER BY ordinal_position;

-- 2. Se vedi colonne con is_nullable = 'NO' e senza default,
--    quelle sono obbligatorie e devono essere popolate.

-- Esempio: se c'è una colonna 'tenant_id' o 'created_by' obbligatoria,
-- bisogna aggiungere una RLS policy o popolare quel campo.
