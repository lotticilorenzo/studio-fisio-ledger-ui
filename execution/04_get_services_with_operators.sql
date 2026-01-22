-- Drop the function first because the return type signature has changed
DROP FUNCTION IF EXISTS admin_get_services();

CREATE OR REPLACE FUNCTION admin_get_services()
RETURNS TABLE (
  id uuid,
  name text,
  duration_minutes integer,
  default_price_cents integer,
  created_at timestamptz,
  assigned_operators text[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    s.id,
    s.name,
    s.duration_minutes,
    s.default_price_cents,
    s.created_at,
    COALESCE(
      ARRAY(
        SELECT o.display_name
        FROM operator_services os
        JOIN operators o ON o.id = os.operator_id
        WHERE os.service_id = s.id
        ORDER BY o.display_name
      ),
      ARRAY[]::text[]
    ) as assigned_operators
  FROM services s
  ORDER BY s.name;
$$;
