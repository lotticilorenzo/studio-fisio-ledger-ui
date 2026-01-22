-- 1. Revenue Trend (Last 12 Months)
-- Drop first just in case
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
AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', (CURRENT_DATE - INTERVAL '11 months')),
      date_trunc('month', CURRENT_DATE),
      '1 month'::interval
    ) as month_start
  )
  SELECT
    to_char(m.month_start, 'Mon') as month,
    to_char(m.month_start, 'YYYY-MM') as year_month,
    COALESCE(SUM(a.gross_amount_cents), 0) as revenue_cents,
    COUNT(a.id) as appointment_count
  FROM months m
  LEFT JOIN appointments a ON date_trunc('month', a.starts_at) = m.month_start
    AND a.status IN ('completed', 'scheduled')
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;


-- 2. Service Mix (Popularity & Revenue)
DROP FUNCTION IF EXISTS admin_get_service_mix(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION admin_get_service_mix(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  service_name text,
  count bigint,
  revenue_cents bigint,
  percentage_count numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH total AS (
    SELECT COUNT(*) as total_count FROM appointments
    WHERE starts_at >= p_start_date AND starts_at <= p_end_date
    AND status != 'cancelled'
  )
  SELECT
    s.name as service_name,
    COUNT(a.id) as count,
    COALESCE(SUM(a.gross_amount_cents), 0) as revenue_cents,
    ROUND((COUNT(a.id)::numeric / NULLIF((SELECT total_count FROM total), 0) * 100), 1) as percentage_count
  FROM services s
  LEFT JOIN appointments a ON a.service_id = s.id
  WHERE a.starts_at >= p_start_date AND a.starts_at <= p_end_date
  AND a.status != 'cancelled'
  GROUP BY s.id, s.name
  ORDER BY count DESC
  LIMIT 5;
$$;


-- 3. New vs Returning Patients
-- FIXED: Uses patient_id instead of patient_name
DROP FUNCTION IF EXISTS admin_get_patient_stats(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION admin_get_patient_stats(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  total_patients bigint,
  new_patients bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH unique_patients_in_period AS (
    SELECT DISTINCT patient_id
    FROM appointments
    WHERE starts_at >= p_start_date AND starts_at <= p_end_date
    AND status != 'cancelled'
    AND patient_id IS NOT NULL
  ),
  first_visits AS (
    SELECT patient_id, MIN(starts_at) as first_visit
    FROM appointments
    WHERE status != 'cancelled'
    AND patient_id IS NOT NULL
    GROUP BY patient_id
  )
  SELECT
    (SELECT COUNT(*) FROM unique_patients_in_period) as total_patients,
    (SELECT COUNT(*) FROM first_visits WHERE first_visit >= p_start_date AND first_visit <= p_end_date) as new_patients;
$$;
