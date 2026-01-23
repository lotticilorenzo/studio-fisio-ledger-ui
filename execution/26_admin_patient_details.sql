-- ============================================================
-- 26_admin_patient_details.sql
-- ============================================================

-- 1. Get Patient Details (Basic Info + Aggregate Stats)
DROP FUNCTION IF EXISTS admin_get_patient_details(uuid);

CREATE OR REPLACE FUNCTION admin_get_patient_details(p_patient_id uuid)
RETURNS TABLE (
    p_id uuid, 
    p_full_name text, 
    p_email text, 
    p_phone text, 
    p_total_revenue bigint, -- In cents
    p_total_appointments bigint,
    p_last_visit timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Check if user is admin/owner
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        pat.id,
        pat.full_name,
        pat.email,
        pat.phone,
        COALESCE(SUM(app.gross_amount_cents) FILTER (WHERE app.status = 'completed'), 0) as total_revenue,
        COUNT(app.id) as total_appointments,
        MAX(app.starts_at) as last_visit
    FROM patients pat
    LEFT JOIN appointments app ON app.patient_id = pat.id AND app.status != 'cancelled'
    WHERE pat.id = p_patient_id
    GROUP BY pat.id;
END;
$$;

-- 2. Get Patient History (Detailed Appointment List)
DROP FUNCTION IF EXISTS admin_get_patient_history(uuid);

CREATE OR REPLACE FUNCTION admin_get_patient_history(p_patient_id uuid)
RETURNS TABLE (
    h_id uuid,
    h_starts_at timestamptz,
    h_service_name text,
    h_operator_name text,
    h_status text,
    h_gross_amount_cents int,
    h_notes text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Check if user is admin/owner
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        app.id,
        app.starts_at,
        s.name as service_name,
        op.display_name as operator_name,
        app.status,
        app.gross_amount_cents,
        app.notes
    FROM appointments app
    LEFT JOIN services s ON app.service_id = s.id
    LEFT JOIN operators op ON app.operator_id = op.id
    WHERE app.patient_id = p_patient_id
    ORDER BY app.starts_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_get_patient_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_patient_history(uuid) TO authenticated;
