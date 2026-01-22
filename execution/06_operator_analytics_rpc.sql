-- 1. Operator Revenue Trend (Last 12 Months)
-- Explicitly drop to avoid signature issues
DROP FUNCTION IF EXISTS op_get_revenue_trend();
CREATE OR REPLACE FUNCTION op_get_revenue_trend()
RETURNS TABLE (
  month text,
  year_month text,
  earnings_cents bigint,
  appointment_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH op_id AS (
    SELECT id FROM operators WHERE user_id = auth.uid() LIMIT 1
  ),
  months AS (
    SELECT generate_series(
      date_trunc('month', (CURRENT_DATE - INTERVAL '11 months')),
      date_trunc('month', CURRENT_DATE),
      '1 month'::interval
    ) as month_start
  )
  SELECT
    to_char(m.month_start, 'Mon') as month,
    to_char(m.month_start, 'YYYY-MM') as year_month,
    COALESCE(SUM(a.commission_amount_cents), 0) as earnings_cents,
    COUNT(a.id) as appointment_count
  FROM months m
  LEFT JOIN appointments a ON date_trunc('month', a.starts_at) = m.month_start
    AND a.operator_id = (SELECT id FROM op_id)
    AND a.status IN ('completed', 'scheduled')
  GROUP BY m.month_start
  ORDER BY m.month_start;
$$;

-- 2. Operator Service Mix (Popularity & Earnings)
DROP FUNCTION IF EXISTS op_get_service_mix(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION op_get_service_mix(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  service_name text,
  count bigint,
  earnings_cents bigint,
  percentage_count numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH op_id AS (
    SELECT id FROM operators WHERE user_id = auth.uid() LIMIT 1
  ),
  total AS (
    SELECT COUNT(*) as total_count FROM appointments
    WHERE starts_at >= p_start_date AND starts_at <= p_end_date
    AND operator_id = (SELECT id FROM op_id)
    AND status != 'cancelled'
  )
  SELECT
    s.name as service_name,
    COUNT(a.id) as count,
    COALESCE(SUM(a.commission_amount_cents), 0) as earnings_cents,
    ROUND((COUNT(a.id)::numeric / NULLIF((SELECT total_count FROM total), 0) * 100), 1) as percentage_count
  FROM services s
  JOIN appointments a ON a.service_id = s.id
  WHERE a.starts_at >= p_start_date AND a.starts_at <= p_end_date
  AND a.operator_id = (SELECT id FROM op_id)
  AND a.status != 'cancelled'
  GROUP BY s.id, s.name
  ORDER BY count DESC;
$$;

-- 3. Operator Patient Stats (New vs Returning for THIS operator)
DROP FUNCTION IF EXISTS op_get_patient_stats(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION op_get_patient_stats(p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE (
  total_patients bigint,
  new_patients bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH op_id AS (
    SELECT id FROM operators WHERE user_id = auth.uid() LIMIT 1
  ),
  unique_patients_in_period AS (
    SELECT DISTINCT patient_id
    FROM appointments
    WHERE starts_at >= p_start_date AND starts_at <= p_end_date
    AND operator_id = (SELECT id FROM op_id)
    AND status != 'cancelled'
    AND patient_id IS NOT NULL
  ),
  first_visits_to_this_op AS (
    SELECT patient_id, MIN(starts_at) as first_visit
    FROM appointments
    WHERE operator_id = (SELECT id FROM op_id)
    AND status != 'cancelled'
    AND patient_id IS NOT NULL
    GROUP BY patient_id
  )
  SELECT
    (SELECT COUNT(*) FROM unique_patients_in_period) as total_patients,
    (SELECT COUNT(*) FROM first_visits_to_this_op WHERE first_visit >= p_start_date AND first_visit <= p_end_date) as new_patients;
$$;

-- 4. Operator Weekly Summary (Last 7 Days)
DROP FUNCTION IF EXISTS op_get_weekly_summary();
CREATE OR REPLACE FUNCTION op_get_weekly_summary()
RETURNS TABLE (
  total_earnings_cents bigint,
  total_appointments bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH op_id AS (
    SELECT id FROM operators WHERE user_id = auth.uid() LIMIT 1
  )
  SELECT
    COALESCE(SUM(commission_amount_cents), 0) as total_earnings_cents,
    COUNT(*) as total_appointments
  FROM appointments
  WHERE starts_at >= (CURRENT_DATE - INTERVAL '6 days')
  AND operator_id = (SELECT id FROM op_id)
  AND status IN ('completed', 'scheduled');
$$;

GRANT EXECUTE ON FUNCTION op_get_revenue_trend() TO authenticated;
GRANT EXECUTE ON FUNCTION op_get_service_mix(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION op_get_patient_stats(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION op_get_weekly_summary() TO authenticated;
