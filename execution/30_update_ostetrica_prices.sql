-- =================================================================================
-- AGGIORNAMENTO LISTINO PREZZI (OSTETRICA)
-- =================================================================================
-- Questo script usa la logica sicura (CON TENANT_ID) per inserire i servizi dell'Ostetrica.

DO $$
DECLARE
    v_tenant_id uuid;
BEGIN
    -- 0. RECUPERA IL TENANT ID
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

    -- Se non trova un tenant, errore di sicurezza
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Nessun tenant trovato. Impossibile inserire servizi.';
    END IF;

    -- 1. Barra Rimozione Pessario (15 min, 50€ -> 5000 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Rimozione Pessario') THEN
        UPDATE services SET default_price_cents = 5000, duration_minutes = 15 WHERE name = 'Ostetricia - Rimozione Pessario';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Rimozione Pessario', 15, 5000, v_tenant_id);
    END IF;

    -- 2. Prima visita / Valutazione Pavimennto Pelvico (60 min, 110€ -> 11000 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Prima Valutazione Pavimento Pelvico') THEN
        UPDATE services SET default_price_cents = 11000, duration_minutes = 60 WHERE name = 'Ostetricia - Prima Valutazione Pavimento Pelvico';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Prima Valutazione Pavimento Pelvico', 60, 11000, v_tenant_id);
    END IF;

    -- 3. Riabilitazione Elettrostimolazione/Biofeedback (50 min, 77€ -> 7700 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Riabilitazione Elettrostimolazione') THEN
        UPDATE services SET default_price_cents = 7700, duration_minutes = 50 WHERE name = 'Ostetricia - Riabilitazione Elettrostimolazione';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Riabilitazione Elettrostimolazione', 50, 7700, v_tenant_id);
    END IF;

    -- 4. Riabilitazione Tecniche Manuali (45 min, 70€ -> 7000 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Riabilitazione Tecniche Manuali') THEN
        UPDATE services SET default_price_cents = 7000, duration_minutes = 45 WHERE name = 'Ostetricia - Riabilitazione Tecniche Manuali';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Riabilitazione Tecniche Manuali', 45, 7000, v_tenant_id);
    END IF;

    -- 5. Trattamento Cicatrice TC (30 min, 68€ -> 6800 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Trattamento Cicatrice TC') THEN
        UPDATE services SET default_price_cents = 6800, duration_minutes = 30 WHERE name = 'Ostetricia - Trattamento Cicatrice TC';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Trattamento Cicatrice TC', 30, 6800, v_tenant_id);
    END IF;

    -- 6. Visita di Controllo (30 min, 55€ -> 5500 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Visita di Controllo') THEN
        UPDATE services SET default_price_cents = 5500, duration_minutes = 30 WHERE name = 'Ostetricia - Visita di Controllo';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Visita di Controllo', 30, 5500, v_tenant_id);
    END IF;

    -- 7. Visita Pelvica Post Parto (50 min, 80€ -> 8000 cents)
    IF EXISTS (SELECT 1 FROM services WHERE name = 'Ostetricia - Valutazione Pelvica Post-Parto') THEN
        UPDATE services SET default_price_cents = 8000, duration_minutes = 50 WHERE name = 'Ostetricia - Valutazione Pelvica Post-Parto';
    ELSE
        INSERT INTO services (name, duration_minutes, default_price_cents, tenant_id) VALUES ('Ostetricia - Valutazione Pelvica Post-Parto', 50, 8000, v_tenant_id);
    END IF;

END $$;
