"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HeaderNotificationBell } from "./HeaderNotificationBell";

type AppHeaderProps = {
    subtitle?: string;
    showLogout?: boolean;
};

export function AppHeader({
    subtitle = "Gestionale Appuntamenti",
    showLogout = true,
}: AppHeaderProps) {
    const router = useRouter();

    async function logout() {
        if (!confirm('Sei sicuro di voler uscire dall\'account?')) {
            return;
        }
        await supabase.auth.signOut();
        router.replace("/login");
    }

    const headerStyle: React.CSSProperties = {
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 16px',
    };

    const innerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1024px',
        margin: '0 auto',
    };

    // Titolo scuro per migliore visibilità
    const titleStyle: React.CSSProperties = {
        fontSize: '1.125rem',
        fontWeight: 700,
        color: '#0f172a', // Nero per buona leggibilità
        fontFamily: 'Poppins, sans-serif',
    };

    const subtitleStyle: React.CSSProperties = {
        fontSize: '0.75rem',
        color: '#64748b',
    };

    const logoutBtnStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '8px',
        color: '#94a3b8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    return (
        <header style={headerStyle}>
            <div style={innerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Image
                        src="/brand/logo.png"
                        alt="Studio FISYO"
                        width={40}
                        height={40}
                        style={{ borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        priority
                    />
                    <div>
                        <h1 style={titleStyle}>Studio FISYO</h1>
                        <p style={subtitleStyle}>{subtitle}</p>
                    </div>
                </div>
                {showLogout && (
                    <div className="flex items-center gap-1">
                        <HeaderNotificationBell />
                        <div className="w-px h-6 bg-slate-200 mx-1" /> {/* Divider */}
                        <button
                            onClick={() => router.push('/profile')}
                            style={{ ...logoutBtnStyle, color: '#64748b' }}
                            title="Impostazioni Profilo"
                            aria-label="Impostazioni"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                        <button onClick={logout} style={logoutBtnStyle} title="Esci dall'account" aria-label="Esci">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
