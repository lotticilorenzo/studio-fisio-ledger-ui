"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { humanError } from "@/lib/humanError";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, AuthProvider handles redirect - show nothing
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

    // Leggi il ruolo dal profilo per redirect corretto
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .single();

    setLoading(false);

    if (profileError || !profile?.role) {
      // Default: redirect a /op se non trova profilo
      router.push("/op/appointments");
      return;
    }

    const role = profile.role as string;

    // Redirect basato sul ruolo
    if (role === 'owner' || role === 'admin') {
      router.push("/admin/appointments");
    } else {
      router.push("/op/appointments");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <Image
            src="/brand/logo.png"
            alt="Studio FISYO"
            width={120}
            height={120}
            className="mx-auto mb-4"
            priority
          />
          <p className="text-gray-400 mt-2">Gestionale Appuntamenti</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-yellow-500/10 bg-neutral-900/80 backdrop-blur-xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-6 text-center">Accedi al tuo account</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                className="w-full rounded-xl bg-black/50 border border-neutral-700 px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                placeholder="nome@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                className="w-full rounded-xl bg-black/50 border border-neutral-700 px-4 py-3 text-white placeholder-gray-500 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 flex items-center gap-2">
                <span>⚠️</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold py-3 px-4 hover:from-yellow-300 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Accesso in corso...
                </span>
              ) : (
                "Accedi"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2026 Studio FISYO · Tutti i diritti riservati
        </p>
      </div >
    </main >
  );
}

