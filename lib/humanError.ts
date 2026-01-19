/**
 * Helper per trasformare errori tecnici in messaggi user-friendly in italiano.
 */
export function humanError(error: string | null | undefined): string {
    if (!error) return 'Si è verificato un errore sconosciuto.';

    const msg = error.toLowerCase();

    // RLS / Permission errors
    if (msg.includes('row-level security') || msg.includes('rls') || msg.includes('permission denied')) {
        return 'Non hai i permessi per eseguire questa azione.';
    }
    if (msg.includes('new row violates row-level security')) {
        return 'Non sei autorizzato a creare questo elemento.';
    }

    // Constraint violations
    if (msg.includes('appointments_status_check')) {
        return 'Stato non valido. Aggiorna la pagina e riprova.';
    }
    if (msg.includes('violates check constraint')) {
        return 'I dati inseriti non sono validi. Controlla e riprova.';
    }
    if (msg.includes('violates foreign key')) {
        return 'Riferimento non valido. L\'elemento selezionato potrebbe non esistere più.';
    }
    if (msg.includes('violates unique constraint') || msg.includes('duplicate key')) {
        return 'Questo elemento esiste già.';
    }
    if (msg.includes('violates not-null constraint')) {
        return 'Alcuni campi obbligatori sono vuoti.';
    }

    // Auth errors
    if (msg.includes('not_authenticated') || msg.includes('jwt expired') || msg.includes('jwt')) {
        return 'Sessione scaduta. Effettua nuovamente il login.';
    }
    if (msg.includes('invalid login credentials')) {
        return 'Email o password non corretti.';
    }
    if (msg.includes('email not confirmed')) {
        return 'Email non confermata. Controlla la tua casella di posta.';
    }
    if (msg.includes('user already registered')) {
        return 'Questo indirizzo email è già registrato.';
    }

    // Network/Server errors
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
        return 'Errore di connessione. Verifica la tua connessione internet.';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
        return 'La richiesta ha impiegato troppo tempo. Riprova.';
    }
    if (msg.includes('500') || msg.includes('internal server error')) {
        return 'Errore del server. Riprova tra qualche minuto.';
    }
    if (msg.includes('503') || msg.includes('service unavailable')) {
        return 'Servizio temporaneamente non disponibile. Riprova tra poco.';
    }

    // Custom RPC errors
    if (msg.includes('operator_not_found')) {
        return 'Operatore non trovato. Contatta l\'amministratore.';
    }
    if (msg.includes('not_found_or_forbidden')) {
        return 'Appuntamento non trovato o non hai i permessi per modificarlo.';
    }
    if (msg.includes('user_not_found')) {
        return 'Utente non trovato. Verifica che l\'utente si sia registrato.';
    }
    if (msg.includes('already_cancelled')) {
        return 'Questo appuntamento è già stato disdetto.';
    }

    // Default: return original with sanitization
    return error.length > 200 ? error.substring(0, 200) + '...' : error;
}

/**
 * Messaggi di successo predefiniti
 */
export const successMessages = {
    saved: 'Salvato con successo!',
    created: 'Creato con successo!',
    updated: 'Aggiornato con successo!',
    deleted: 'Eliminato con successo!',
    cancelled: 'Appuntamento disdetto.',
    sent: 'Inviato con successo!',
} as const;

