-- ============================================================
-- 08_push_notifications_schema.sql
-- ============================================================

-- 1. Tabella per le sottoscrizioni Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, endpoint) -- Evita duplicati per lo stesso device
);

-- 2. Sicurezza RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Flag per tracking notifiche inviate negli appuntamenti
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS push_reminder_sent boolean NOT NULL DEFAULT false;

-- 4. Indice per velocizzare il controllo delle notifiche da inviare
CREATE INDEX IF NOT EXISTS idx_appointments_push_reminder 
ON public.appointments (starts_at, status, push_reminder_sent)
WHERE status = 'scheduled' AND push_reminder_sent = false;

-- 5. Grant (per sicurezza, anche se RLS copre)
GRANT ALL ON public.push_subscriptions TO authenticated;
