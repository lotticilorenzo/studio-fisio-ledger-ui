-- ============================================================
-- ADD COLUMN: duration_minutes to services
-- Il frontend si aspetta questa colonna per gestire la durata dei servizi.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'services'
        AND column_name = 'duration_minutes'
    ) THEN
        ALTER TABLE services ADD COLUMN duration_minutes integer NOT NULL DEFAULT 60;
    END IF;
END $$;
