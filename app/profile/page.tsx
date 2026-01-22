'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { humanError } from "@/lib/humanError";
import { Spinner } from "@/components/ui/Loading";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/components/AuthProvider";

export default function ProfilePage() {
    const router = useRouter();
    const { user, role, loading: authLoading } = useAuth();

    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const onUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        const { error } = await supabase.auth.updateUser({ password: password });

        setLoading(false);

        if (error) {
            setError(humanError(error.message));
        } else {
            setSuccess(true);
            setPassword(""); // Clear password field
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <AppHeader subtitle="Impostazioni Profilo" showLogout={true} />

            <div className="max-w-md mx-auto p-4 md:p-6 space-y-6">

                {/* 1. Account Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        👤 Il tuo account
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                                Email
                            </label>
                            <div className="text-slate-700 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 break-all">
                                {user?.email}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1">
                                Ruolo
                            </label>
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                                {role === 'owner' ? '👑 Owner' : role === 'admin' ? '🛡️ Admin' : '👤 Collaboratore'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Security Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        🔒 Sicurezza
                    </h2>

                    {success && (
                        <div className="mb-4 bg-emerald-50 text-emerald-700 p-3 rounded-lg border border-emerald-100 text-sm flex items-center gap-2">
                            ✅ Password aggiornata con successo!
                        </div>
                    )}

                    <form onSubmit={onUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Cambia Password
                            </label>
                            <input
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                                placeholder="Nuova password sicura"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type="password"
                                required
                                minLength={6}
                            />
                            <p className="text-xs text-slate-400 mt-1">Minimo 6 caratteri</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-sm">
                                ⚠️ {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !password}
                            className={`
                                w-full py-2.5 rounded-lg font-semibold text-white shadow-sm transition-all
                                ${loading || !password
                                    ? 'bg-slate-300 cursor-not-allowed'
                                    : 'bg-slate-900 hover:bg-slate-800 active:scale-[0.98]'}
                            `}
                        >
                            {loading ? <Spinner size="sm" /> : "Aggiorna Password"}
                        </button>
                    </form>
                </div>

                {/* 3. App Info (Footer) */}
                <div className="text-center pt-8 pb-4">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm text-sm"
                    >
                        <span>←</span> Torna indietro
                    </button>
                    <p className="text-xs text-slate-400 mt-4">Studio FISYO Ledge v1.0.0</p>
                </div>
            </div>
        </div>
    );
}
