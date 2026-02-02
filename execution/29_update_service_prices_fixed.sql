-- =================================================================================
-- AGGIORNAMENTO LISTINO PREZZI (NUTRIZIONISTA & PSICOLOGA) - FIX "NOT NULL"
-- =================================================================================
-- Questo script usa una logica sicura per inserire i servizi con il "tenant_id" corretto.

DO $$
DECLARE
    v_tenant_id uuid;
BEGIN
    -- 0. RECUPERA IL TENANT ID (Assuming single tenant for Studio Fisio)
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

    -- Se non trova un tenant, errore di sicurezza per non inserire dati orfani
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Nessun tenant trovato. Impossibile inserire servizi.';
    END IF;

    -- 1. NUTRIZIONISTA - Prima Visita (147,68€)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Nutrizione - Prima Visita') THEN
        UPDATE services SET default_price_cents = 14768, duration_minutes = 60 WHERE name = 'Nutrizione - Prima Visita';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Nutrizione - Prima Visita', 60, 14768, v_tenant_id);
    END IF;

    -- Nutrizione - Controllo (52,00€)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Nutrizione - Controllo') THEN
        UPDATE services SET default_price_cents = 5200, duration_minutes = 30 WHERE name = 'Nutrizione - Controllo';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Nutrizione - Controllo', 30, 5200, v_tenant_id);
    END IF;


    -- 2. PSICOLOGA - Colloquio Conoscitivo (45,00€)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Psicologia - Colloquio Conoscitivo') THEN
        UPDATE services SET default_price_cents = 4500, duration_minutes = 60 WHERE name = 'Psicologia - Colloquio Conoscitivo';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Psicologia - Colloquio Conoscitivo', 60, 4500, v_tenant_id);
    END IF;

    -- Psicologia - Colloquio Individuale (60,00€)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Psicologia - Colloquio Individuale') THEN
        UPDATE services SET default_price_cents = 6000, duration_minutes = 60 WHERE name = 'Psicologia - Colloquio Individuale';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Psicologia - Colloquio Individuale', 60, 6000, v_tenant_id);
    END IF;

    -- Psicologia - Colloquio Familiare/Coppia (100,00€)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Psicologia - Colloquio Familiare/Coppia') THEN
        UPDATE services SET default_price_cents = 10000, duration_minutes = 90 WHERE name = 'Psicologia - Colloquio Familiare/Coppia';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Psicologia - Colloquio Familiare/Coppia', 90, 10000, v_tenant_id);
    END IF;

END $$;
