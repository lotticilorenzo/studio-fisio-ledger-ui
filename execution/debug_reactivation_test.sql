-- ============================================================
-- debug_reactivation_test.sql
-- Force patient 'lottici.lorenzo04@gmail.com' to likely receive a reactivation email
-- ============================================================

-- 1. Aggiorna l'appuntamento più recente per essere "vecchio" di 7 mesi
UPDATE appointments 
SET 
    starts_at = (now() - interval '7 months'),
    status = 'completed'
WHERE patient_id = (SELECT id FROM patients WHERE email = 'lottici.lorenzo04@gmail.com' LIMIT 1)
  AND starts_at = (
      SELECT MAX(starts_at) 
      FROM appointments 
      WHERE patient_id = (SELECT id FROM patients WHERE email = 'lottici.lorenzo04@gmail.com' LIMIT 1)
  );

-- 2. Assicura che il paziente abbia il consenso e NON sia stato contattato di recente
UPDATE patients 
SET 
    marketing_consent = true,
    last_reactivation_sent = NULL 
WHERE email = 'lottici.lorenzo04@gmail.com';

-- 3. Verifica immediata: Se questa query restituisce una riga, N8N funzionerà.
SELECT * FROM view_n8n_reactivation WHERE email = 'lottici.lorenzo04@gmail.com';
