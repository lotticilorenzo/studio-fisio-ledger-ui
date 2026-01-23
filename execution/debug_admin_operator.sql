
SELECT 
    p.user_id,
    p.role,
    o.id as operator_id,
    o.display_name
FROM profiles p
LEFT JOIN operators o ON p.user_id = o.user_id
WHERE p.role IN ('admin', 'owner');
