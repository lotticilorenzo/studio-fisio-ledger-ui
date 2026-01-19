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

    // Auth errors
    if (msg.includes('not_authenticated') || msg.includes('jwt expired')) {
        return 'Sessione scaduta. Effettua nuovamente il login.';
    }
    if (msg.includes('invalid login credentials')) {
        return 'Email o password non corretti.';
    }

    // Network errors
    if (msg.includes('failed to fetch') || msg.includes('network')) {
        return 'Errore di connessione. Verifica la tua connessione internet.';
    }

    // Custom RPC errors
    if (msg.includes('operator_not_found')) {
        return 'Operatore non trovato. Contatta l\'amministratore.';
    }
    if (msg.includes('not_found_or_forbidden')) {
        return 'Appuntamento non trovato o non hai i permessi per modificarlo.';
    }

    // Default: return original with sanitization
    return error.length > 200 ? error.substring(0, 200) + '...' : error;
}
