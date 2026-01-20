-- Controlla la struttura della tabella patients
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'patients'
ORDER BY ordinal_position;
