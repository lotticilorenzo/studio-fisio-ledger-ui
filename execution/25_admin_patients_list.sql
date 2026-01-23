-- FIX: Admin Patient List with Filtering
-- Allows fetching all patients OR only those treated by specific operator
-- UPDATED: Uses 'full_name' instead of 'display_name'

DROP FUNCTION IF EXISTS admin_get_patients(uuid);

CREATE OR REPLACE FUNCTION admin_get_patients(p_operator_id uuid DEFAULT NULL)
RETURNS TABLE (
    p_id uuid,
    p_display_name text,
    p_last_visit timestamptz,
    p_total_appointments bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        p.id as p_id,
        p.full_name as p_display_name,  -- FIXED: Changed from p.display_name to p.full_name
        MAX(a.starts_at) as p_last_visit,
        COUNT(a.id) as p_total_appointments
    FROM patients p
    LEFT JOIN appointments a ON p.id = a.patient_id
    WHERE a.status != 'cancelled'
    AND (p_operator_id IS NULL OR a.operator_id = p_operator_id) -- Filter if provided
    GROUP BY p.id, p.full_name  -- FIXED
    HAVING COUNT(a.id) > 0 -- Only show patients with appointments matching filter
    ORDER BY p_last_visit DESC;
$$;

GRANT EXECUTE ON FUNCTION admin_get_patients(uuid) TO authenticated;
