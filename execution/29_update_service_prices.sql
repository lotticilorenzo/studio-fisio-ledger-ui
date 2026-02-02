-- =================================================================================
-- AGGIORNAMENTO LISTINO PREZZI (NUTRIZIONISTA & PSICOLOGA)
-- =================================================================================
-- Questo script inserisce o aggiorna i servizi specifici con i prezzi richiesti.
-- I prezzi sono in CENTESIMI (es. 100€ = 10000).

-- 1. NUTRIZIONISTA
-- Prima Visita: 147,68€ -> 14768 centesimi
INSERT INTO services (name, duration_minutes, default_price_cents)
VALUES ('Nutrizione - Prima Visita', 60, 14768)
ON CONFLICT (name) DO UPDATE 
SET default_price_cents = 14768, duration_minutes = 60;

-- Controlli: 52,00€ -> 5200 centesimi
INSERT INTO services (name, duration_minutes, default_price_cents)
VALUES ('Nutrizione - Controllo', 30, 5200)
ON CONFLICT (name) DO UPDATE 
SET default_price_cents = 5200, duration_minutes = 30;


-- 2. PSICOLOGA
-- Primo colloquio conoscitivo: 45,00€ -> 4500 centesimi
INSERT INTO services (name, duration_minutes, default_price_cents)
VALUES ('Psicologia - Colloquio Conoscitivo', 60, 4500)
ON CONFLICT (name) DO UPDATE 
SET default_price_cents = 4500, duration_minutes = 60;

-- Colloquio psicologico individuale: 60,00€ -> 6000 centesimi
INSERT INTO services (name, duration_minutes, default_price_cents)
VALUES ('Psicologia - Colloquio Individuale', 60, 6000)
ON CONFLICT (name) DO UPDATE 
SET default_price_cents = 6000, duration_minutes = 60;

-- Colloquio psicologico familiare o di coppia: 100,00€ -> 10000 centesimi
INSERT INTO services (name, duration_minutes, default_price_cents)
VALUES ('Psicologia - Colloquio Familiare/Coppia', 90, 10000)
ON CONFLICT (name) DO UPDATE 
SET default_price_cents = 10000, duration_minutes = 90;

-- =================================================================================
-- NOTA IMPORTANTE:
-- Se esistevano servizi simili con nomi leggermente diversi (es. "Prima Visita Nutrizionista"),
-- potrebbero rimanere nel database come duplicati. 
-- In tal caso, puoi cancellarli manualmente dalla pagina "Servizi" dell'Admin.
-- =================================================================================
