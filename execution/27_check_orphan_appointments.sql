-- check_orphan_appointments.sql
-- Questo script conta gli appuntamenti "senza identità" (patient_id NULL)
-- che vengono ignorati dalle statistiche.

DO $$
DECLARE
    v_total bigint;
    v_nulls bigint;
BEGIN
    -- Conta appuntamenti ultimi 90 giorni
    SELECT count(*) INTO v_total 
    FROM appointments 
    WHERE starts_at > now() - interval '90 days'
      AND status != 'cancelled';

    -- Conta quanti hanno patient_id NULL
    SELECT count(*) INTO v_nulls 
    FROM appointments 
    WHERE starts_at > now() - interval '90 days'
      AND status != 'cancelled'
      AND patient_id IS NULL;
      
    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'DIAGNOSTICA STATISTICHE (ULTIMI 90 GIORNI)';
    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'Totale Appuntamenti: %', v_total;
    RAISE NOTICE 'Senza Paziente (Ignorati): %', v_nulls;
    
    IF v_total > 0 THEN
        RAISE NOTICE 'Percentuale Dati Ignorati: % %%', round((v_nulls::numeric / v_total::numeric) * 100, 1);
    ELSE
        RAISE NOTICE 'Nessun appuntamento trovato nel periodo.';
    END IF;
    
    IF v_nulls > 0 THEN
        RAISE NOTICE '⚠️ SOLUZIONE: Gli appuntamenti senza paziente non contano per la fidelizzazione.';
        RAISE NOTICE 'Modifica questi appuntamenti e reinserisci il nome del paziente per collegarli.';
    ELSE
        RAISE NOTICE '✅ I dati sembrano corretti. Se le stats sono zero, contatta il supporto tecnico.';
    END IF;
    RAISE NOTICE '---------------------------------------------------';
END $$;
