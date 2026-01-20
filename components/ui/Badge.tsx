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

const statusColors: Record<string, { bg: string; color: string }> = {
    scheduled: { bg: '#dbeafe', color: '#1e40af' },
    completed: { bg: '#d1fae5', color: '#065f46' },
    cancelled: { bg: '#fee2e2', color: '#991b1b' },
    no_show: { bg: '#fef3c7', color: '#92400e' },
};

/**
 * Status badge component
 */
export function Badge({ status, children }: BadgeProps) {
    const label = children || statusLabels[status] || status;
    const colors = statusColors[status] || { bg: '#f1f5f9', color: '#475569' };

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9999px',
            textTransform: 'uppercase',
            letterSpacing: '0.025em',
            background: colors.bg,
            color: colors.color,
        }}>
            {label}
        </span>
    );
}
