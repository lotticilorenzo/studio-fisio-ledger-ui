"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type AuthState = {
    user: User | null;
    role: string | null;
    loading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, role: null, loading: true });

export function useAuth() {
    return useContext(AuthContext);
}

/** Minimal spinner shown during auth check */
function Loader() {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });

    // Fetch role from profiles
    async function fetchRole(userId: string): Promise<string | null> {
        const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", userId)
            .single();
        return data?.role ?? null;
    }

    // Determine correct dashboard based on role
    function getDashboard(role: string | null): string {
        if (role === "owner" || role === "admin") return "/admin/appointments";
        return "/op/appointments";
    }

    useEffect(() => {
        let mounted = true;

        // Initial session check with error handling
        async function initAuth() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (!mounted) return;

                if (error) {
                    console.error("Auth getSession error:", error);
                    setState({ user: null, role: null, loading: false });
                    return;
                }

                if (session?.user) {
                    try {
                        const role = await fetchRole(session.user.id);
                        setState({ user: session.user, role, loading: false });
                    } catch (roleError) {
                        console.error("fetchRole error:", roleError);
                        // User exists but couldn't fetch role - proceed anyway
                        setState({ user: session.user, role: null, loading: false });
                    }
                } else {
                    setState({ user: null, role: null, loading: false });
                }
            } catch (err) {
                console.error("Auth init error:", err);
                if (mounted) {
                    setState({ user: null, role: null, loading: false });
                }
            }
        }

        initAuth();

        // Listen to auth changes (login/logout/token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (session?.user) {
                    try {
                        const role = await fetchRole(session.user.id);
                        setState({ user: session.user, role, loading: false });
                    } catch (roleError) {
                        console.error("fetchRole error on auth change:", roleError);
                        setState({ user: session.user, role: null, loading: false });
                    }
                } else {
                    setState({ user: null, role: null, loading: false });
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Handle redirects based on auth state
    useEffect(() => {
        if (state.loading) return;

        const isLoginPage = pathname === "/login";
        const isRootPage = pathname === "/";
        const isProtectedRoute = pathname.startsWith("/admin") || pathname.startsWith("/op");

        if (!state.user) {
            // Not logged in: redirect protected routes to login
            if (isProtectedRoute || isRootPage) {
                router.replace("/login");
            }
        } else {
            // Logged in: redirect away from login/root to dashboard
            if (isLoginPage || isRootPage) {
                router.replace(getDashboard(state.role));
            }
        }
    }, [state.loading, state.user, state.role, pathname, router]);

    // Show loader during initial auth check
    if (state.loading) {
        return <Loader />;
    }

    return (
        <AuthContext.Provider value={state}>
            {children}
        </AuthContext.Provider>
    );
}
