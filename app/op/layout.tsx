'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function OpHeader() {
    const router = useRouter();

    async function logout() {
        await supabase.auth.signOut();
        router.replace('/login');
    }

    return (
        <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                        <span className="text-lg">👤</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg bg-gradient-to-r from-green-400 to-teal-500 bg-clip-text text-transparent">
                            Studio FISYO
                        </h1>
                        <p className="text-xs text-gray-400">Area Operatore</p>
                    </div>
                </div>
                <button
                    onClick={logout}
                    className="px-4 py-2 rounded-lg border border-neutral-600 text-gray-300 text-sm hover:bg-neutral-800 transition-all"
                >
                    Esci
                </button>
            </div>
        </header>
    );
}

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
    const router = useRouter();
    const pathname = usePathname();
    const [ok, setOk] = useState(false);

    useEffect(() => {
        (async () => {
            const { data: userRes } = await supabase.auth.getUser();
            const user = userRes?.user;

            if (!user) {
                router.replace('/login');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('user_id', user.id)
                .single();

            if (error || !profile?.role) {
                router.replace('/login');
                return;
            }

            // Admin/Owner can also access /op routes
            setOk(true);
        })();
    }, [router, pathname]);

    if (!ok) {
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
            <OpHeader />
            <OpNav />
            <div className="max-w-4xl mx-auto">
                {children}
            </div>
        </div>
    );
}

