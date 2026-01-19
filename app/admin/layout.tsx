'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/components/AuthProvider';

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
  const { user, role, loading } = useAuth();

  // Redirect operator to /op if they try to access /admin
  useEffect(() => {
    if (!loading && user && role && role !== 'owner' && role !== 'admin') {
      router.replace('/op/appointments');
    }
  }, [loading, user, role, router]);

  // Loading state
  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent rounded-full"></div>
          <p className="text-gray-400">Caricamento...</p>
        </div>
      </main>
    );
  }

  // Role check: operator should not see admin area
  if (role !== 'owner' && role !== 'admin') {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen">
      <AppHeader subtitle="Area Amministrazione" variant="admin" />
      <AdminNav />
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}
