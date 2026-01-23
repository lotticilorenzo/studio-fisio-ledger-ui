-- Debug: Check if the admin/owner has a corresponding operator entry
-- and check the appointments for that operator id

WITH admin_user AS (
  SELECT 
    p.user_id, 
    au.email, 
    p.role
  FROM profiles p
  JOIN auth.users au ON p.user_id = au.id
  WHERE p.role IN ('admin', 'owner')
)
SELECT 
  au.email,
  au.user_id,
  op.id as operator_id,
  op.display_name as operator_name,
  (SELECT COUNT(*) FROM appointments a WHERE a.operator_id = op.id) as appt_count
FROM admin_user au
LEFT JOIN operators op ON au.user_id = op.user_id;
