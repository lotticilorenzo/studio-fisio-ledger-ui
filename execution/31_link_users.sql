-- =================================================================================
-- COLLEGAMENTO UTENTI - FIX RUOLO CORRETTO ('collaborator')
-- =================================================================================
-- Il ruolo per gli operatori nel database si chiama 'collaborator', non 'operator'.
-- Questo script usa il termine corretto per passare il controllo di sicurezza.

DO $$
DECLARE
    v_tenant_id uuid;
    v_user_id uuid;
BEGIN
    -- RECUPERA TENANT (Il "codice condominio" dello studio)
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant non trovato'; END IF;

    -- =================================================================================
    -- 1. LORENZO LOTTICI (OWNER)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'lottici.lorenzo04@gmail.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'owner', v_tenant_id, 'Lorenzo Lottici')
        ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Lorenzo%' OR display_name ILIKE '%Lottici%';
    END IF;

    -- =================================================================================
    -- 2. ELISA CAGGIATI (ADMIN)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'elisacaggiati@admin.it';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'admin', v_tenant_id, 'Elisa Caggiati')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Elisa%';
    END IF;

    -- =================================================================================
    -- 3. BEATRICE GRASSI (Admin)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'grassi.beatrice73@gmail.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'admin', v_tenant_id, 'Beatrice Grassi')
        ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Beatrice%' OR display_name ILIKE '%Grassi%';
    END IF;

    -- =================================================================================
    -- 4. NUTRIZIONISTA (collaborator)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'nutrizionista@test.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Nutrizionista')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Nutrizionista%' OR display_name ILIKE '%Nutrizione%';
    END IF;

    -- =================================================================================
    -- 5. PSICOLOGA (collaborator)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'psicologa@test.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Psicologa')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Psicologa%' OR display_name ILIKE '%Psicologia%';
    END IF;

    -- =================================================================================
    -- 6. OSTETRICA (collaborator)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'ostetrica@test.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Ostetrica')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Ostetrica%';
    END IF;

    -- =================================================================================
    -- 7. PILATES (collaborator)
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'pilates@test.com';
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Pilates')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator';
        
        UPDATE public.operators SET user_id = v_user_id WHERE display_name ILIKE '%Pilates%' OR display_name ILIKE '%Fisioterapista%';
    END IF;

END $$;
