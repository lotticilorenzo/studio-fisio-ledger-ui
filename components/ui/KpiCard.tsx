'use client';

import { ReactNode } from 'react';

interface KpiCardProps {
    value: string | number;
    label: string;
    highlight?: boolean; // Card evidenziata (es. Lordo)
    icon?: string;
}

/**
 * KPI Card per dashboard - mostra un valore con etichetta
 * highlight=true aggiunge un bordo colorato per evidenziare la card principale
 */
export function KpiCard({ value, label, highlight = false, icon }: KpiCardProps) {
    const cardStyle: React.CSSProperties = {
        background: highlight
            ? 'linear-gradient(135deg, rgba(244, 241, 25, 0.1) 0%, rgba(255, 153, 0, 0.1) 100%)'
            : '#ffffff',
        border: highlight
            ? '2px solid #ff9900'
            : '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'center',
        minWidth: '0',
    };

    const valueStyle: React.CSSProperties = {
        fontFamily: 'Poppins, sans-serif',
        fontSize: '1.5rem',
        fontWeight: 700,
        lineHeight: 1.2,
        color: highlight ? '#ff9900' : '#0f172a',
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: '4px',
    };

    return (
        <div style={cardStyle}>
            {icon && <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{icon}</div>}
            <div style={valueStyle}>{value}</div>
            <div style={labelStyle}>{label}</div>
        </div>
    );
}

interface KpiGridProps {
    children: ReactNode;
}

/**
 * Grid container per KPI cards - 2 colonne mobile, 4 desktop
 */
export function KpiGrid({ children }: KpiGridProps) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '24px'
        }}>
            {children}
        </div>
    );
}
