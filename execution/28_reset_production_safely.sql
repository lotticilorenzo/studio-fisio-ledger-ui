-- =================================================================================
-- SCRIPT DI RESET SICURO PER IL GO-LIVE (PRODUZIONE)
-- =================================================================================
-- Questo script pulisce SOLAMENTE i dati transazionali (Appuntamenti)
-- NON TOCCA:
-- 1. Utenti e Profili (Chi può accedere)
-- 2. Operatori (Le persone che lavorano)
-- 3. Servizi (Il listino prezzi)
-- 4. Pazienti (L'anagrafica clienti - opzionale, vedi sotto)
-- =================================================================================

BEGIN;

    -- 1. CANCELLA TUTTI GLI APPUNTAMENTI
    -- Questo svuota il calendario e azzera le statistiche di incasso/fidelizzazione
    DELETE FROM appointments;

    -- 2. (OPZIONALE) CANCELLA I PAZIENTI DI TEST
    -- Se vuoi mantenere l'anagrafica dei pazienti reali già inseriti, LASCIA COMMENTATO.
    -- Se invece sono tutti pazienti finti (es. "Mario Rossi", "Test"), TOGLI IL COMMENTO alla riga sotto:
    -- DELETE FROM patients;

    -- NOTA: I servizi e gli operatori restano intatti.

COMMIT;

-- VERIFICA FINALE
-- Dovrebbe restituire 0 appuntamenti
SELECT count(*) as "Appuntamenti Rimanenti (Deve essere 0)" FROM appointments;

-- Verifica che gli operatori esistano ancora (non deve essere 0)
SELECT count(*) as "Operatori Attivi (Non deve essere 0)" FROM operators;

-- Verifica che i servizi esistano ancora (non deve essere 0)
SELECT count(*) as "Servizi Attivi (Non deve essere 0)" FROM services;
