-- FIX: Revenue Trend (Last 12 Months)
-- Adding search_path and explicit grants to ensure it works in all contexts
DROP FUNCTION IF EXISTS admin_get_revenue_trend();

CREATE OR REPLACE FUNCTION admin_get_revenue_trend()
RETURNS TABLE (
  month text,
  year_month text,
  revenue_cents bigint,
  appointment_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH months AS (
    -- Generate the last 12 months including the current one
    SELECT generate_series(
      date_trunc('month', (CURRENT_DATE - INTERVAL '11 months')),
      date_trunc('month', CURRENT_DATE),
      '1 month'::interval
    ) as month_start
  )
  SELECT
    to_char(m.month_start, 'Mon') as month,
    to_char(m.month_start, 'YYYY-MM') as year_month,
    COALESCE(SUM(a.gross_amount_cents), 0)::bigint as revenue_cents,
    COUNT(a.id)::bigint as appointment_count
  FROM months m
  LEFT JOIN appointments a ON date_trunc('month', a.starts_at) = m.month_start
    AND a.status IN ('completed', 'scheduled')
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

GRANT EXECUTE ON FUNCTION admin_get_revenue_trend() TO authenticated;
