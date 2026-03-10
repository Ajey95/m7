"use client";

import { AuthProvider } from "../lib/auth-context";
import { ToastProvider } from "../lib/toast-context";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ToastProvider>
                {children}
            </ToastProvider>
        </AuthProvider>
    );
}
