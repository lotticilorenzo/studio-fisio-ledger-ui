'use client';

interface BadgeProps {
    status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | string;
    children?: React.ReactNode;
}

const statusLabels: Record<string, string> = {
    scheduled: 'In programma',
    completed: 'Completato',
    cancelled: 'Disdetto',
    no_show: 'Assente',
};

/**
 * Status badge component
 */
export function Badge({ status, children }: BadgeProps) {
    const label = children || statusLabels[status] || status;

    return (
        <span className={`badge badge-${status}`}>
            {label}
        </span>
    );
}
