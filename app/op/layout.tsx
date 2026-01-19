'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/components/AuthProvider';

function OpNav() {
    const pathname = usePathname();

    const links = [
        { href: '/op/appointments', label: 'I Miei Appuntamenti', icon: '📅' },
        { href: '/op/appointments/new', label: 'Nuovo', icon: '➕' },
    ];

    return (
        <nav className="border-b border-neutral-700/50 bg-neutral-800/30 px-4 py-2">
            <div className="max-w-4xl mx-auto flex gap-1">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${isActive
                                ? 'bg-green-500/20 text-green-400 font-medium border border-green-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-neutral-700/50'
                                }`}
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

    // AuthProvider gestisce i redirect, qui solo loading check
    if (loading || !user) {
        return (
            <main className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
                    <p className="text-gray-400">Caricamento...</p>
                </div>
            </main>
        );
    }

    return (
        <div className="min-h-screen">
            <AppHeader subtitle="Area Operatore" variant="operator" maxWidth="max-w-4xl" />
            <OpNav />
            <div className="max-w-4xl mx-auto">
                {children}
            </div>
        </div>
    );
}
