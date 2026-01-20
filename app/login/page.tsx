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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

        {/* Login Card */}
        <div className="card card-body">
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
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-muted text-xs mt-6">
          © 2026 Studio FISYO · Tutti i diritti riservati
        </p>
      </div>
    </main>
  );
}
