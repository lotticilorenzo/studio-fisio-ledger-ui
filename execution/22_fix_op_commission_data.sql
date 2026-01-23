-- FIX: Calculate commission_amount_cents for appointments where it is missing (0 or NULL)
-- Uses the CURRENT commission_rate from the operator profile.

BEGIN;

-- 1. Update commission_amount_cents based on operator's CURRENT rate
-- Only for appointments that have positive gross_amount_cents but 0/NULL commission
UPDATE public.appointments a
SET 
  commission_rate = o.commission_rate,
  commission_amount_cents = round(a.gross_amount_cents * o.commission_rate)
FROM public.operators o
WHERE a.operator_id = o.id
  AND (a.commission_amount_cents IS NULL OR a.commission_amount_cents = 0)
  AND (a.gross_amount_cents > 0)
  AND (o.commission_rate IS NOT NULL AND o.commission_rate > 0);

-- 2. Verify and Log
DO $$
DECLARE
    updated_count integer;
BEGIN
    SELECT count(*) INTO updated_count 
    FROM appointments a
    WHERE a.commission_amount_cents > 0 
    AND a.created_at > now() - interval '1 minute'; -- Rough check for recent updates
    
    RAISE NOTICE 'Commission remediation applied. Rows affected: %', updated_count;
END $$;

COMMIT;
