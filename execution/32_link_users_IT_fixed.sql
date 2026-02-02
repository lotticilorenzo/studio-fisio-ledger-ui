DO $$
DECLARE
    v_tenant_id uuid;
    v_user_id uuid;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

    -- =================================================================================
    -- PILATES (pilates@test.it)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'pilates@test.it';
    
    IF v_user_id IS NOT NULL THEN
        -- 1. PRIMA CREA IL PROFILO (Necessario per il vincolo FK)
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Pilates Clinico')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator', tenant_id = v_tenant_id;

        -- 2. POI COLLEGA L'OPERATORE
        UPDATE public.operators 
        SET user_id = v_user_id 
        WHERE display_name ILIKE '%Pilates%' 
          AND (user_id IS NULL OR user_id = v_user_id);
            
        RAISE NOTICE '✅ Pilates collegato con successo';
    END IF;

    -- =================================================================================
    -- PSICOLOGA (psicologa@test.it)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'psicologa@test.it';

    IF v_user_id IS NOT NULL THEN
        -- 1. PRIMA CREA IL PROFILO
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Psicologa')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator', tenant_id = v_tenant_id;

        -- 2. POI COLLEGA L'OPERATORE
        UPDATE public.operators 
        SET user_id = v_user_id 
        WHERE display_name ILIKE '%Psicologa%'
          AND (user_id IS NULL OR user_id = v_user_id);

        RAISE NOTICE '✅ Psicologa collegata con successo';
    END IF;

END $$;
