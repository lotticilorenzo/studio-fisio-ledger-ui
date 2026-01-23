-- FIX: Populate missing commission_amount_cents for existing appointments
-- This script updates appointments where commission is 0 or NULL, 
-- using the current operator's commission rate.

BEGIN;

-- 1. Aggiorna gli appuntamenti basandosi sul tasso attuale dell'operatore
-- Solo se commission_amount_cents è 0 o NULL e l'operatore ha un tasso impostato.
UPDATE public.appointments a
SET 
  commission_rate = o.commission_rate,
  commission_amount_cents = round(a.gross_amount_cents * o.commission_rate)
FROM public.operators o
WHERE a.operator_id = o.id
  AND (a.commission_amount_cents IS NULL OR a.commission_amount_cents = 0)
  AND (a.gross_amount_cents > 0)
  AND (o.commission_rate IS NOT NULL AND o.commission_rate > 0);

-- 2. Opzionale: Se vuoi azzerare commissioni per appuntamenti cancellati 
-- (generalmente sono già a zero, ma per sicurezza)
UPDATE public.appointments
SET commission_amount_cents = 0
WHERE status = 'cancelled'
  AND commission_amount_cents != 0;

COMMIT;

-- Verifica post-aggiornamento
SELECT 
  a.id, 
  o.display_name, 
  a.gross_amount_cents, 
  a.commission_rate, 
  a.commission_amount_cents 
FROM appointments a
JOIN operators o ON a.operator_id = o.id
WHERE a.commission_amount_cents > 0
LIMIT 10;
