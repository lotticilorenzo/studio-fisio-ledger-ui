# 🤖 Studio Fisio Automation - Setup Guide (Versione Finale)

Configurazione Ibrida: **Brevo per i Pazienti** (Design) + **Gmail per lo Staff** (Semplicità).

## 1. Database (Supabase)
Assicurati di aver eseguito lo script SQL per creare tutte le viste:
`execution/35_setup_phase2_workflows.sql`

⚠️ **Manuale**: Vai su Supabase (`operators`) e inserisci le **email** degli operatori.

---

## 2. Configurazione Brevo (Per Pazienti)
Vai su Brevo -> Transactional -> Templates e crea questi 3 template.
Segnati l'**ID** di ognuno (es. #1, #2...).

### Template 1: Promemoria Appuntamento 24h (ID: `3`)
- Usa i placeholder nel testo: `{{NAME}}`, `{{TIME}}`, `{{DATE}}`.
- Esempio: "Ciao {{NAME}}, ci vediamo il {{DATE}} alle {{TIME}}."

### Template 2: Promemoria Appuntamento 5h (ID: `4`)
- Usa i placeholder nel testo: `{{NAME}}`, `{{TIME}}`.
- Esempio: "Ciao {{NAME}}, a tra poco alle {{TIME}}!"

### Template 3: Reactivation (ID: `5`)
- Usa placeholder: `{{NAME}}`.
- Esempio: "Ciao {{NAME}}, è da un po' che non vieni..."

### Template 4: Richiesta Recensione (ID: `6`)
- Usa placeholder: `{{NAME}}`.
- Esempio: "Grazie {{NAME}} della visita! Lasciaci una recensione qui..."

---

## 3. Configurazione Gmail (Per Staff)
In n8n, dovrai configurare le credenziali "Gmail OAuth2".
- È il modo più sicuro.
- Ti chiederà di loggarti col tuo account Google dello studio.

---

## 4. Importazione n8n
Aggiorna i file JSON con i tuoi ID Template prima di attivarli.

1.  **`01_reminders.json`**:
    - Apri il nodo Brevo.
    - Già configurato con ID **3** (24h) e **4** (5h).
2.  **`02_reviews.json`**:
    - Già configurato con ID **6**.
3.  **`06_reactivation.json`**:
    - Già configurato con ID **5**.
4.  **`05_monthly_report.json`**:
    - Configura il nodo Gmail (mittente).
5.  **`08_weekly_agenda.json`**:
    - Configura il nodo Gmail.

Buon lavoro! 🚀
