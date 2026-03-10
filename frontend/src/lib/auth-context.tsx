"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiService } from "./api-service";

interface User {
    id: string;
    name?: string;
    full_name?: string;
    email: string;
    role: string;
    verification_status?: string;
    ngo_id?: string;
    rejection_reason?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ["/", "/login", "/register", "/mobile-app"];
const ROLE_ROUTES: Record<string, string[]> = {
    donor: ["/dashboard/donor"],
    volunteer: ["/dashboard/volunteer"],
    ngo: ["/dashboard/ngo", "/dashboard/ngo/pending", "/dashboard/ngo/rejected"],
    dispatcher: ["/dashboard/dispatcher"],
    admin: ["/dashboard/admin", "/dashboard/dispatcher", "/dashboard/ngo"],
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const refreshUser = async () => {
        const token = localStorage.getItem("auth_token");
        if (!token) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        const response = await apiService.getMe();
        if (response.data) {
            setUser(response.data);
        } else {
            localStorage.removeItem("auth_token");
            setUser(null);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        refreshUser();
    }, []);

    // Route protection
    useEffect(() => {
        if (isLoading) return;

        const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
        const isDashboardRoute = pathname.startsWith("/dashboard");

        if (!user && isDashboardRoute) {
            router.push("/login");
            return;
        }

        if (user) {
            const role = user.role.toLowerCase();

            // Redirect Donors and Volunteers to mobile app info page
            // But don't redirect if they're on /login (they might be trying to switch accounts)
            // Donors and Volunteers now have web dashboards

            if (isDashboardRoute) {
                const allowedRoutes = ROLE_ROUTES[role] || [];
                const isAllowed = allowedRoutes.some(route => pathname.startsWith(route));

                if (!isAllowed) {
                    // Redirect to appropriate dashboard
                    const defaultRoute = ROLE_ROUTES[role]?.[0] || "/";
                    router.push(defaultRoute);
                }
            }
        }
    }, [user, isLoading, pathname, router]);

    const login = async (email: string, password: string) => {
        const response = await apiService.login(email, password);

        if (response.error) {
            return { success: false, error: response.error };
        }

        // We can't await refreshUser() easily here to get the role immediately from state update, 
        // so we fetch 'me' directly or rely on the effect.
        // But for better UX, let's fetch to know where to redirect.
        const meRes = await apiService.getMe();
        if (meRes.data) {
            const role = meRes.data.role.toLowerCase();
            if (role === "ngo") {
                const vs = meRes.data.verification_status?.toUpperCase();
                if (vs === "VERIFIED") {
                    router.push("/dashboard/ngo");
                } else if (vs === "REJECTED") {
                    router.push("/dashboard/ngo/rejected");
                } else {
                    router.push("/dashboard/ngo/pending");
                }
            } else {
                const defaultRoute = ROLE_ROUTES[role]?.[0] || "/dashboard";
                router.push(defaultRoute);
            }
            // Update state
            setUser(meRes.data);
        }

        return { success: true };
    };

    const logout = () => {
        apiService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            logout,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
    Component: React.ComponentType<P>,
    allowedRoles?: string[]
) {
    return function ProtectedComponent(props: P) {
        const { user, isLoading, isAuthenticated } = useAuth();
        const router = useRouter();

        useEffect(() => {
            if (!isLoading && !isAuthenticated) {
                router.push("/login");
            }

            if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
                router.push("/");
            }
        }, [isLoading, isAuthenticated, user, router]);

        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-950">
                    <div className="w-8 h-8 border-2 border-[#fb923c]/30 border-t-[#fb923c] rounded-full animate-spin"></div>
                </div>
            );
        }

        if (!isAuthenticated) {
            return null;
        }

        if (allowedRoles && user && !allowedRoles.includes(user.role)) {
            return null;
        }

        return <Component {...props} />;
    };
}
