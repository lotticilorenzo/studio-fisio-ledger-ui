"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

const ROLE_CACHE_KEY = "fisyo_cached_role";

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

// Cache helpers
function getCachedRole(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(ROLE_CACHE_KEY);
    } catch {
        return null;
    }
}

function setCachedRole(role: string | null) {
    if (typeof window === 'undefined') return;
    try {
        if (role) {
            localStorage.setItem(ROLE_CACHE_KEY, role);
        } else {
            localStorage.removeItem(ROLE_CACHE_KEY);
        }
    } catch {
        // Ignore storage errors
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });

    // Fetch role from profiles with timeout
    async function fetchRole(userId: string): Promise<string | null> {
        const timeout = new Promise<null>((resolve) =>
            setTimeout(() => {
                console.warn('Timeout fetching role - using cached role');
                resolve(null);
            }, 10000)
        );

        const fetchPromise = supabase
            .from("profiles")
            .select("role")
            .eq("user_id", userId)
            .single()
            .then(({ data, error }) => {
                if (error) {
                    console.warn("Supabase profiles query error:", error.message);
                    return null;
                }
                return data?.role ?? null;
            });

        return Promise.race([fetchPromise, timeout]);
    }

    // Determine correct dashboard based on role
    function getDashboard(role: string | null): string {
        if (role === "owner" || role === "admin") return "/admin/appointments";
        return "/op/appointments";
    }

    useEffect(() => {
        let mounted = true;

        async function initAuth() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (!mounted) return;

                if (error || !session?.user) {
                    setCachedRole(null);
                    setState({ user: null, role: null, loading: false });
                    return;
                }

                // Use cached role immediately for instant load
                const cachedRole = getCachedRole();
                if (cachedRole) {
                    setState({ user: session.user, role: cachedRole, loading: false });
                }

                // Fetch fresh role in background
                try {
                    const freshRole = await fetchRole(session.user.id);
                    if (mounted) {
                        setCachedRole(freshRole);
                        // Only update if different (avoid unnecessary re-render)
                        if (freshRole !== cachedRole) {
                            setState({ user: session.user, role: freshRole, loading: false });
                        } else if (!cachedRole) {
                            // No cache existed, set now
                            setState({ user: session.user, role: freshRole, loading: false });
                        }
                    }
                } catch (roleError) {
                    // Log as warning if we have cache, as error if not
                    if (cachedRole) {
                        console.warn("fetchRole warning (using cached role):", roleError);
                    } else {
                        console.error("fetchRole error:", roleError);
                    }
                    if (mounted && !cachedRole) {
                        setState({ user: session.user, role: null, loading: false });
                    }
                }
            } catch (err) {
                console.error("Auth init error:", err);
                if (mounted) {
                    setCachedRole(null);
                    setState({ user: null, role: null, loading: false });
                }
            }
        }

        initAuth();

        // Listen to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (event === 'SIGNED_OUT') {
                    setCachedRole(null);
                    setState({ user: null, role: null, loading: false });
                    return;
                }

                if (session?.user) {
                    try {
                        const role = await fetchRole(session.user.id);
                        setCachedRole(role);
                        setState({ user: session.user, role, loading: false });
                    } catch (roleError) {
                        console.error("fetchRole error on auth change:", roleError);
                        setState({ user: session.user, role: getCachedRole(), loading: false });
                    }
                } else {
                    setCachedRole(null);
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
            if (isProtectedRoute || isRootPage) {
                router.replace("/login");
            }
        } else {
            if (isLoginPage || isRootPage) {
                router.replace(getDashboard(state.role));
            }
        }
    }, [state.loading, state.user, state.role, pathname, router]);

    if (state.loading) {
        return <Loader />;
    }

    return (
        <AuthContext.Provider value={state}>
            {children}
        </AuthContext.Provider>
    );
}

