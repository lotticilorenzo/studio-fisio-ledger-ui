-- 1) Aggiungi campi GDPR su patients
alter table public.patients
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text,
  add column if not exists marketing_consent_by uuid;

-- 2) Crea RPC “op_create_appointment”
create or replace function public.op_create_appointment(
  p_starts_at timestamptz,
  p_service_id uuid,
  p_patient_name text,
  p_gross_amount_cents integer,
  p_notes text,
  p_marketing_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_operator_id uuid;
  v_patient_id uuid;
  v_appt_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- trova operatore collegato a questo utente
  select id into v_operator_id
  from public.operators
  where user_id = v_uid
  limit 1;

  if v_operator_id is null then
    raise exception 'operator_not_found';
  end if;

  -- crea paziente (MVP: solo nome, niente dedupe)
  insert into public.patients (full_name, marketing_consent, marketing_consent_at, marketing_consent_source, marketing_consent_by)
  values (
    trim(p_patient_name),
    coalesce(p_marketing_consent, false),
    case when coalesce(p_marketing_consent, false) then now() else null end,
    case when coalesce(p_marketing_consent, false) then 'in_app_operator' else null end,
    case when coalesce(p_marketing_consent, false) then v_uid else null end
  )
  returning id into v_patient_id;

  -- crea appuntamento (status deve combaciare con il tuo CHECK)
  insert into public.appointments (
    operator_id, service_id, patient_id,
    starts_at, status, gross_amount_cents, notes, created_by
  )
  values (
    v_operator_id, p_service_id, v_patient_id,
    p_starts_at, 'scheduled', p_gross_amount_cents, nullif(p_notes, ''), v_uid
  )
  returning id into v_appt_id;

  return v_appt_id;
end;
$$;

-- Permessi per chiamarla
grant execute on function public.op_create_appointment(timestamptz, uuid, text, integer, text, boolean) to authenticated;
