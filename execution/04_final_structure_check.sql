-- CHECK 1: Verifichiamo se le colonne esistono in PATIENTS
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND column_name IN ('email', 'phone', 'marketing_consent');

-- CHECK 2: Verifichiamo se le colonne esistono in APPOINTMENTS
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN ('reminder_24h_sent', 'reminder_2h_sent', 'review_request_sent');

-- CHECK 3: Verifichiamo la firma della funzione RPC (deve avere p_email e p_phone)
SELECT pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
WHERE p.proname = 'op_create_appointment';
