-- DIAGNOSTIC: Check Operator Commission Rate and Data
SELECT 
    o.display_name, 
    o.commission_rate, 
    count(a.id) as total_appointments, 
    sum(a.gross_amount_cents) as total_gross_cents,
    sum(a.commission_amount_cents) as current_commission_cents
FROM operators o
LEFT JOIN appointments a ON a.operator_id = o.id
GROUP BY o.display_name, o.commission_rate;
