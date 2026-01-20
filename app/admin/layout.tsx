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

  const navStyle: React.CSSProperties = {
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '8px 16px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  };

  const navInnerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    maxWidth: '1024px',
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
    transition: 'all 0.15s ease',
  });

  return (
    <nav style={navStyle}>
      <div style={navInnerStyle}>
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <LoadingState />
      </div>
    );
  }

  if (role !== 'owner' && role !== 'admin') {
    return null;
  }

  const shellStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    maxWidth: '1024px',
    margin: '0 auto',
    width: '100%',
  };

  return (
    <div style={shellStyle}>
      <AppHeader subtitle="Area Amministrazione" />
      <AdminNav />
      <main style={mainStyle}>
        {children}
      </main>
    </div>
  );
}
