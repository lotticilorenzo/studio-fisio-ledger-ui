"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AppHeaderProps = {
    /** Subtitle shown below the brand name */
    subtitle?: string;
    /** Accent color variant */
    variant?: "admin" | "operator";
    /** Max width class for container */
    maxWidth?: string;
    /** Show logout button */
    showLogout?: boolean;
};

export function AppHeader({
    subtitle = "Gestionale Appuntamenti",
    variant = "admin",
    maxWidth = "max-w-7xl",
    showLogout = true,
}: AppHeaderProps) {
    const router = useRouter();

    async function logout() {
        await supabase.auth.signOut();
        router.replace("/login");
    }

    const gradientClass =
        variant === "operator"
            ? "from-green-400 to-teal-500"
            : "from-yellow-400 to-orange-500";

    return (
        <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
            <div className={`${maxWidth} mx-auto px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    <Image
                        src="/brand/logo.png"
                        alt="Studio FISYO"
                        width={48}
                        height={48}
                        className="rounded-xl"
                        priority
                    />
                    <div>
                        <h1 className={`font-bold text-lg bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
                            Studio FISYO
                        </h1>
                        <p className="text-xs text-gray-400">{subtitle}</p>
                    </div>
                </div>
                {showLogout && (
                    <button
                        onClick={logout}
                        className="px-4 py-2 rounded-lg border border-neutral-600 text-gray-300 text-sm hover:bg-neutral-800 transition-all"
                    >
                        Esci
                    </button>
                )}
            </div>
        </header>
    );
}
