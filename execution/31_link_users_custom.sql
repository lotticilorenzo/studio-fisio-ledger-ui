DO $$
DECLARE
    -- =================================================================================
    -- 👇 MODIFICA QUI LE EMAIL DEGLI UTENTI CREATI 👇
    -- =================================================================================
    v_email_pilates   text := 'INSERISCI_QUI_LA_MAIL_PILATES';   -- Es: 'pilates@studiofisio.it'
    v_email_psicologa text := 'INSERISCI_QUI_LA_MAIL_PSICOLOGA'; -- Es: 'psicologa@studiofisio.it'
    -- =================================================================================

    v_tenant_id uuid;
    v_user_id uuid;
BEGIN
    -- 1. Recupera Tenant ID dello studio
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant non trovato'; END IF;

    -- =================================================================================
    -- 2. Collega PILATES CLINICO
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email_pilates;
    
    IF v_user_id IS NOT NULL THEN
        -- Linka l'operatore
        UPDATE public.operators 
        SET user_id = v_user_id 
        WHERE display_name ILIKE '%Pilates%' OR display_name ILIKE '%Fisioterapista%';
        
        -- Crea/Aggiorna profilo collaborator
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Pilates Clinico')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator', tenant_id = v_tenant_id;
        
        RAISE NOTICE '✅ Pilates collegato a: %', v_email_pilates;
    ELSE
        RAISE NOTICE '⚠️ Utente Pilates NON trovato con email: %', v_email_pilates;
    END IF;

    -- =================================================================================
    -- 3. Collega PSICOLOGA
    -- =================================================================================
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email_psicologa;

    IF v_user_id IS NOT NULL THEN
        -- Linka l'operatore
        UPDATE public.operators 
        SET user_id = v_user_id 
        WHERE display_name ILIKE '%Psicologa%' OR display_name ILIKE '%Psicologia%';

        -- Crea/Aggiorna profilo collaborator
        INSERT INTO public.profiles (user_id, role, tenant_id, full_name) 
        VALUES (v_user_id, 'collaborator', v_tenant_id, 'Psicologa')
        ON CONFLICT (user_id) DO UPDATE SET role = 'collaborator', tenant_id = v_tenant_id;

        RAISE NOTICE '✅ Psicologa collegata a: %', v_email_psicologa;
    ELSE
        RAISE NOTICE '⚠️ Utente Psicologa NON trovato con email: %', v_email_psicologa;
    END IF;

END $$;
