-- ============================================================
-- 99_RESET_DB_APPOINTMENTS.sql
-- ⚠️ ATTENZIONE: CANCELLA TUTTI GLI APPUNTAMENTI ⚠️
-- Esegui questo script SOLO se vuoi resettare l'app a zero.
-- ============================================================

TRUNCATE TABLE public.appointments RESTART IDENTITY CASCADE;

-- (Opzionale) Se vuoi resettare anche i contatori dei pazienti
UPDATE public.patients SET last_reactivation_sent = NULL;
