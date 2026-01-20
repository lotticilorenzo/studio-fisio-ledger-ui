'use client';

import { ReactNode } from 'react';

interface KpiCardProps {
    value: string | number;
    label: string;
    accent?: boolean;
    icon?: string;
}

/**
 * KPI Card per dashboard - mostra un valore con etichetta
 */
export function KpiCard({ value, label, accent = false, icon }: KpiCardProps) {
    return (
        <div className="kpi-card">
            {icon && <div className="text-lg mb-1">{icon}</div>}
            <div className={`kpi-value ${accent ? 'accent' : ''}`}>{value}</div>
            <div className="kpi-label">{label}</div>
        </div>
    );
}

interface KpiGridProps {
    children: ReactNode;
}

/**
 * Grid container per KPI cards
 */
export function KpiGrid({ children }: KpiGridProps) {
    return <div className="kpi-grid">{children}</div>;
}
