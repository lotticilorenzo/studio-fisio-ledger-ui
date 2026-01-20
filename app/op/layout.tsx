'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/components/AuthProvider';
import { LoadingState } from '@/components/ui/Loading';

function OpNav() {
    const pathname = usePathname();

    const links = [
        { href: '/op/appointments', label: 'I miei appuntamenti', icon: '📅' },
    ];

    const navStyle: React.CSSProperties = {
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 16px',
    };

    const navInnerStyle: React.CSSProperties = {
        display: 'flex',
        gap: '8px',
        maxWidth: '448px',
        margin: '0 auto',
    };

    const linkStyle = (isActive: boolean): React.CSSProperties => ({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 500,
        color: isActive ? '#0f172a' : '#475569',
        background: isActive ? 'linear-gradient(135deg, #f4f119 0%, #ff9900 100%)' : 'transparent',
        borderRadius: '8px',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
    });

    return (
        <nav style={navStyle}>
            <div style={navInnerStyle}>
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link key={link.href} href={link.href} style={linkStyle(isActive)}>
                            <span>{link.icon}</span>
                            {link.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

export default function OpLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading || !user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <LoadingState />
            </div>
        );
    }

    const shellStyle: React.CSSProperties = {
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
    };

    const mainStyle: React.CSSProperties = {
        flex: 1,
        maxWidth: '448px',
        margin: '0 auto',
        width: '100%',
    };

    return (
        <div style={shellStyle}>
            <AppHeader subtitle="Area Operatore" />
            <OpNav />
            <main style={mainStyle}>
                {children}
            </main>
        </div>
    );
}
