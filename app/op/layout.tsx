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

    return (
        <nav className="app-nav">
            <div className="container nav-pills">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`nav-link ${isActive ? 'active' : ''}`}
                        >
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
            <main className="app-shell">
                <LoadingState />
            </main>
        );
    }

    return (
        <div className="app-shell">
            <AppHeader subtitle="Area Operatore" variant="operator" maxWidth="container" />
            <OpNav />
            <main className="app-content">
                <div className="container">
                    {children}
                </div>
            </main>
        </div>
    );
}
