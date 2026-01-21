-- 1. Aggiungi campi contatto ai pazienti
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. Aggiungi flag per gestire lo stato dei reminder (fondamentale per n8n)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_request_sent boolean NOT NULL DEFAULT false;

-- 3. Aggiorna la RPC per accettare email e telefono
CREATE OR REPLACE FUNCTION public.op_create_appointment(
  p_starts_at timestamptz,
  p_service_id uuid,
  p_patient_name text,
  p_gross_amount_cents integer,
  p_notes text,
  p_marketing_consent boolean,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_operator_id uuid;
  v_patient_id uuid;
  v_appt_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid is NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- trova operatore
  SELECT id INTO v_operator_id
  FROM public.operators
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'operator_not_found';
  END IF;

  -- crea paziente con CONTATTI
  INSERT INTO public.patients (
    full_name, 
    email,
    phone,
    marketing_consent, 
    marketing_consent_at, 
    marketing_consent_source, 
    marketing_consent_by
  )
  VALUES (
    trim(p_patient_name),
    trim(nullif(p_email, '')),
    trim(nullif(p_phone, '')),
    coalesce(p_marketing_consent, false),
    CASE WHEN coalesce(p_marketing_consent, false) THEN now() ELSE NULL END,
    CASE WHEN coalesce(p_marketing_consent, false) THEN 'in_app_operator' ELSE NULL END,
    CASE WHEN coalesce(p_marketing_consent, false) THEN v_uid ELSE NULL END
  )
  RETURNING id INTO v_patient_id;

  -- crea appuntamento
  INSERT INTO public.appointments (
    operator_id, service_id, patient_id,
    starts_at, status, gross_amount_cents, notes, created_by
  )
  VALUES (
    v_operator_id, p_service_id, v_patient_id,
    p_starts_at, 'scheduled', p_gross_amount_cents, nullif(p_notes, ''), v_uid
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;
END;
$$;

-- Aggiorna permessi (la firma è cambiata, bisogna rieseguire il grant)
GRANT EXECUTE ON FUNCTION public.op_create_appointment(timestamptz, uuid, text, integer, text, boolean, text, text) TO authenticated;
