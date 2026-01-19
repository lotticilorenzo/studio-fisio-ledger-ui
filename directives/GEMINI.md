# Studio Fisio Ledger — Agent Rules (DOE)

## Obiettivo prodotto (MVP)
- Ruoli: owner, admin, collaborator
- Collaborator:
  - vede SOLO i propri appuntamenti
  - può creare/modificare/disdire i propri appuntamenti
  - NON vede commissioni (né campi, né label, né calcoli)
- Admin/Owner:
  - può vedere e gestire tutti gli appuntamenti
  - vede report commissioni e riepiloghi

## Regole NON negoziabili
1) NON toccare Supabase schema / RLS / RPC senza una mia richiesta esplicita.
2) NON stampare, copiare o committare chiavi API (mai).
3) Niente comandi distruttivi (rm -rf, del /s, format, ecc).
4) Ogni cambiamento deve essere testabile:
   - `npm run dev`
   - login operator -> /op/appointments
   - login admin -> /admin/appointments

## Architettura DOE
### Directive (Cosa fare)
- Le direttive stanno in /directives/
- Ogni direttiva ha: obiettivo, scope, vincoli, criteri di accettazione.

### Orchestration (Decisioni)
- Leggi la direttiva, proponi un piano corto, poi modifica i file.
- Se c’è un errore, riproducilo e fai fix minimali.

### Execution (Deterministico)
- SQL: solo in Supabase SQL editor (o script in /execution/).
- Frontend: Next.js App Router + Tailwind.

## Criteri di accettazione UI
- In /op/* non compare mai:
  - commission_rate
  - commission_amount_cents
  - parole tipo "commissione", "netto", "percentuale"
- In /admin/* le commissioni si vedono (solo lì).
