-- ============================================================
-- 99_cleanup_fake_data.sql
-- ELIMINA I DATI FINTI DI TEST (Dicembre)
-- Esegui questo script per pulire il database prima di andare in produzione.
-- ============================================================

DELETE FROM appointments 
WHERE notes LIKE 'Test Report Mensile%';
