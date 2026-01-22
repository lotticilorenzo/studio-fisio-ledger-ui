'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { humanError } from "@/lib/humanError";
import { Spinner } from "@/components/ui/Loading";

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const onUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.updateUser({ password: password });

        setLoading(false);

        if (error) {
            setError(humanError(error.message));
        } else {
            setSuccess(true);
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        }
    };

    return (
        <main className="app-shell flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
            <div className="w-full container">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Image
                        src="/brand/logo.png"
                        alt="Studio FISYO"
                        width={80}
                        height={80}
                        className="mx-auto mb-4 rounded-2xl"
                        style={{ boxShadow: 'var(--shadow-lg)' }}
                        priority
                    />
                    <h1 className="page-title">Studio FISYO</h1>
                    <p className="text-muted text-sm mt-1">Imposta Nuova Password</p>
                </div>

                {/* Card */}
                <div className="card card-body">
                    {success ? (
                        <div className="text-center">
                            <div style={{ background: '#d1fae5', color: '#065f46', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                                ✅ Password aggiornata con successo!<br />
                                Verrai reindirizzato al login tra poco...
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={onUpdatePassword}>
                            <div className="form-group">
                                <label className="form-label">Nuova Password</label>
                                <input
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    type="password"
                                    required
                                    minLength={6}
                                />
                                <p className="text-xs text-muted mt-1">Minimo 6 caratteri</p>
                            </div>

                            {error && (
                                <div className="error-box mb-4 flex items-center gap-2">
                                    <span>⚠️</span>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary btn-full btn-lg"
                            >
                                {loading ? <Spinner size="sm" /> : "Aggiorna Password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
