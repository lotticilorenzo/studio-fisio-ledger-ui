'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/components/AuthProvider';
import { LoadingState } from '@/components/ui/Loading';

function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: '/admin/appointments', label: 'Appuntamenti', icon: '📅' },
    { href: '/admin/operators', label: 'Operatori', icon: '👥' },
    { href: '/admin/services', label: 'Servizi', icon: '🏷️' },
    { href: '/admin/stats', label: 'Statistiche', icon: '📊' },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-[65px] z-20 shadow-sm">
      <div className="grid grid-cols-4 md:flex md:items-center md:gap-2 p-2 md:px-4 max-w-5xl md:mx-auto w-full">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`
                flex flex-col md:flex-row items-center justify-center md:justify-start
                gap-1 md:gap-2 px-1 py-2 md:px-4 md:py-2 rounded-lg transition-all
                ${isActive
                  ? 'bg-gradient-to-br from-yellow-300 to-orange-400 text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}
              `}
            >
              <span className="text-xl md:text-lg leading-none mb-1 md:mb-0">{link.icon}</span>
              <span className="text-[10px] md:text-sm leading-none truncate w-full text-center md:w-auto md:text-left">
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && role && role !== 'owner' && role !== 'admin') {
      router.replace('/op/appointments');
    }
  }, [loading, user, role, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingState />
      </div>
    );
  }

  if (role !== 'owner' && role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <AppHeader subtitle="Area Amministrazione" />
      <AdminNav />
      {/* Added responsive padding bottom for mobile ease of use */}
      <main className="flex-1 w-full max-w-5xl mx-auto pb-20 md:pb-8">
        {children}
      </main>
    </div>
  );
}
