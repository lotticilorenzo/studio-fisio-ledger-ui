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
  ];

  return (
    <nav className="app-nav">
      <div className="container-lg nav-pills">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
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
      <main className="app-shell">
        <LoadingState />
      </main>
    );
  }

  if (role !== 'owner' && role !== 'admin') {
    return null;
  }

  return (
    <div className="app-shell">
      <AppHeader subtitle="Area Amministrazione" variant="admin" />
      <AdminNav />
      <main className="app-content">
        <div className="container-lg" style={{ margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
