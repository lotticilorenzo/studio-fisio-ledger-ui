-- ============================================================
-- FIX: admin_link_user_to_operator
-- ERROR: null value in column "tenant_id" of relation "operators"
-- SOLUTION: Inherit tenant_id from the administrator running the RPC
-- ============================================================

-- 1. DROP previous versions to avoid signature conflicts
DROP FUNCTION IF EXISTS admin_link_user_to_operator(text, text, numeric);

-- 2. CREATE corrected function with tenant_id logic
CREATE OR REPLACE FUNCTION admin_link_user_to_operator(
    p_user_email text,
    p_display_name text,
    p_commission_rate numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_tenant_id uuid;
BEGIN
    -- Check admin/owner permission & Get Tenant ID
    SELECT tenant_id INTO v_tenant_id 
    FROM profiles 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin');

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'access_denied_or_no_tenant';
    END IF;

    -- Find user by email
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_user_email LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'user_not_found';
    END IF;

    -- Create/Update operator record with tenant_id
    INSERT INTO operators (display_name, commission_rate, user_id, tenant_id)
    VALUES (p_display_name, p_commission_rate, v_user_id, v_tenant_id)
    ON CONFLICT (user_id) DO UPDATE
    SET display_name = p_display_name,
        commission_rate = p_commission_rate,
        tenant_id = v_tenant_id;

    -- Ensure profile has operator role, full_name AND tenant_id
    INSERT INTO profiles (user_id, role, full_name, tenant_id)
    VALUES (v_user_id, 'collaborator', p_display_name, v_tenant_id)
    ON CONFLICT (user_id) DO UPDATE SET 
        role = CASE 
                 WHEN profiles.role IN ('admin', 'owner') THEN profiles.role 
                 ELSE 'collaborator' 
               END,
        full_name = EXCLUDED.full_name,
        tenant_id = v_tenant_id;
END;
$$;
