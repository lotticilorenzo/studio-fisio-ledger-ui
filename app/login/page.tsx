"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { humanError } from "@/lib/humanError";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui/Loading";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Reset Password State
  const [view, setView] = useState<'login' | 'forgot_password'>('login');
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || user) {
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      return setError(humanError(authError.message));
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single();

    setLoading(false);

    if (profileError || !profile?.role) {
      router.push("/op/appointments");
      return;
    }

    const role = profile.role as string;

    if (role === 'owner' || role === 'admin') {
      router.push("/admin/appointments");
    } else {
      router.push("/op/appointments");
    }
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetSuccess(false);

    // Usa l'URL corrente come base per il redirect
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/update-password` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectUrl,
    });

    setLoading(false);

    if (error) {
      setError(humanError(error.message));
    } else {
      setResetSuccess(true);
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
          <p className="text-muted text-sm mt-1">Gestionale Appuntamenti</p>
        </div>

        {/* Card */}
        <div className="card card-body">

          {view === 'login' ? (
            <>
              <h2 className="text-lg font-semibold text-center mb-6">Accedi al tuo account</h2>
              <form onSubmit={onSubmit}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    placeholder="nome@esempio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    required
                    autoComplete="current-password"
                  />
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
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" />
                      Accesso in corso...
                    </span>
                  ) : (
                    "Accedi"
                  )}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setView('forgot_password');
                      setError(null);
                    }}
                    className="text-sm text-muted hover:text-primary transition-colors"
                    style={{ textDecoration: 'underline' }}
                  >
                    Password dimenticata?
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-center mb-2">Recupero Password</h2>
              <p className="text-sm text-muted text-center mb-6">Ti invieremo un link per resettare la tua password.</p>

              {resetSuccess ? (
                <div className="text-center">
                  <div style={{ background: '#d1fae5', color: '#065f46', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                    ✅ Controlla la tua email!<br />
                    Ti abbiamo inviato il link di ripristino.
                  </div>
                  <button
                    onClick={() => {
                      setView('login');
                      setResetSuccess(false);
                    }}
                    className="btn btn-secondary btn-full"
                  >
                    Torna al Login
                  </button>
                </div>
              ) : (
                <form onSubmit={onResetPassword}>
                  <div className="form-group">
                    <label className="form-label">Email Account</label>
                    <input
                      className="form-input"
                      placeholder="nome@esempio.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      type="email"
                      required
                      autoComplete="email"
                    />
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
                    className="btn btn-primary btn-full btn-lg mb-3"
                  >
                    {loading ? <Spinner size="sm" /> : "Invia Link Reset"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setView('login');
                      setError(null);
                    }}
                    className="btn btn-secondary btn-full"
                  >
                    Annulla
                  </button>
                </form>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <p className="text-center text-muted text-xs mt-6">
          © 2026 Studio FISYO · Tutti i diritti riservati
        </p>
      </div>
    </main>
  );
}
