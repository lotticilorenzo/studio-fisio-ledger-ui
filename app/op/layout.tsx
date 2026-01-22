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
        { href: '/op/appointments', label: 'Appuntamenti', icon: '📅' },
        { href: '/op/patients', label: 'Pazienti', icon: '👤' },
        { href: '/op/stats', label: 'Statistiche', icon: '📊' },
    ];

    return (
        <nav className="bg-white border-b border-slate-200 sticky top-[65px] z-10 shadow-sm">
            <div className="grid grid-cols-3 p-2 px-4 max-w-md mx-auto w-full gap-2">
                {links.map((link) => {
                    const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`
                                flex flex-col items-center justify-center
                                gap-1 px-1 py-2 rounded-lg transition-all
                                ${isActive
                                    ? 'bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-900 shadow-sm font-semibold'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}
                            `}
                        >
                            <span className="text-xl leading-none mb-1">{link.icon}</span>
                            <span className="text-[10px] leading-none truncate w-full text-center">
                                {link.label}
                            </span>
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <LoadingState />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <AppHeader subtitle="Area Operatore" />
            <OpNav />
            <main className="flex-1 w-full max-w-md mx-auto pb-20 px-0">
                {children}
            </main>
        </div>
    );
}
