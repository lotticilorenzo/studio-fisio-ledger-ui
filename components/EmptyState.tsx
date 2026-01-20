'use client';

import { ReactNode } from 'react';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: ReactNode;
}

/**
 * Componente per empty states coerenti in tutta l'app
 */
export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">{icon}</div>
            <h3 className="empty-state-title">{title}</h3>
            {description && (
                <p className="empty-state-text">{description}</p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
}

/**
 * Empty states predefiniti
 */
export const emptyStates = {
    noAppointments: {
        icon: '📅',
        title: 'Nessun appuntamento',
        description: 'Non ci sono appuntamenti da visualizzare.',
    },
    noAppointmentsToday: {
        icon: '☀️',
        title: 'Nessun appuntamento oggi',
        description: 'La tua giornata è libera! Puoi creare un nuovo appuntamento.',
    },
    noAppointmentsTomorrow: {
        icon: '🌙',
        title: 'Nessun appuntamento domani',
        description: 'Non hai ancora programmato nulla per domani.',
    },
    noServices: {
        icon: '🏷️',
        title: 'Nessun servizio',
        description: 'Crea il tuo primo servizio per iniziare.',
    },
    noOperators: {
        icon: '👥',
        title: 'Nessun operatore',
        description: 'Collega il primo operatore per iniziare.',
    },
    noPatients: {
        icon: '👤',
        title: 'Nessun paziente',
        description: 'I pazienti verranno creati automaticamente con i nuovi appuntamenti.',
    },
    notFound: {
        icon: '🔍',
        title: 'Non trovato',
        description: 'L\'elemento che stai cercando non esiste o non hai i permessi per vederlo.',
    },
    error: {
        icon: '⚠️',
        title: 'Qualcosa è andato storto',
        description: 'Si è verificato un errore. Riprova o contatta l\'assistenza.',
    },
} as const;
