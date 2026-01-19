'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function AdminHeader() {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <span className="text-lg">🏥</span>
          </div>
          <div>
            <h1 className="font-bold text-lg brand-text">
              Studio FISYO
            </h1>
            <p className="text-xs text-gray-400">Area Amministrazione</p>
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

function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: '/admin/appointments', label: 'Appuntamenti', icon: '📅' },
    { href: '/admin/operators', label: 'Operatori', icon: '👥' },
    { href: '/admin/services', label: 'Servizi', icon: '🏷️' },
  ];

  return (
    <nav className="border-b border-neutral-700/50 bg-neutral-800/30 px-4 py-2">
      <div className="max-w-7xl mx-auto flex gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${isActive
                ? 'bg-yellow-500/20 text-yellow-400 font-medium border border-yellow-500/30'
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

      const role = profile.role as string;

      if (role !== 'owner' && role !== 'admin') {
        router.replace('/op/appointments');
        return;
      }

      setOk(true);
    })();
  }, [router, pathname]);

  if (!ok) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
          <p className="text-gray-400">Caricamento...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AdminHeader />
      <AdminNav />
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}

