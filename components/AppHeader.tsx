"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AppHeaderProps = {
    subtitle?: string;
    variant?: "admin" | "operator";
    maxWidth?: string;
    showLogout?: boolean;
};

export function AppHeader({
    subtitle = "Gestionale Appuntamenti",
    maxWidth = "container-lg",
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

    return (
        <header className="app-header">
            <div className={`${maxWidth} flex items-center justify-between`} style={{ margin: '0 auto' }}>
                <div className="flex items-center gap-3">
                    <Image
                        src="/brand/logo.png"
                        alt="Studio FISYO"
                        width={40}
                        height={40}
                        className="rounded-lg"
                        style={{ boxShadow: 'var(--shadow-sm)' }}
                        priority
                    />
                    <div>
                        <h1 className="text-lg font-bold" style={{
                            background: 'linear-gradient(135deg, var(--brand-yellow) 0%, var(--brand-orange) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            Studio FISYO
                        </h1>
                        <p className="text-xs text-muted">{subtitle}</p>
                    </div>
                </div>
                {showLogout && (
                    <button
                        onClick={logout}
                        className="btn-icon btn-ghost"
                        title="Esci dall'account"
                        aria-label="Esci"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                )}
            </div>
        </header>
    );
}
