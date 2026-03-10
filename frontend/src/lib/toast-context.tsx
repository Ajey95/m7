"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface Toast {
    id: string;
    type: "success" | "error" | "warning" | "info";
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { ...toast, id };

        setToasts(prev => [...prev, newToast]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, toast.duration || 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    const icons = {
        success: "check_circle",
        error: "error",
        warning: "warning",
        info: "info",
    };

    const colors = {
        success: "border-green-500/50 bg-green-500/10",
        error: "border-red-500/50 bg-red-500/10",
        warning: "border-yellow-500/50 bg-yellow-500/10",
        info: "border-blue-500/50 bg-blue-500/10",
    };

    const iconColors = {
        success: "text-green-400",
        error: "text-red-400",
        warning: "text-yellow-400",
        info: "text-blue-400",
    };

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto glass-card p-4 min-w-[300px] max-w-[400px] border ${colors[toast.type]} animate-slide-in`}
                >
                    <div className="glass-highlight"></div>
                    <div className="flex items-start gap-3">
                        <span className={`material-symbols-outlined ${iconColors[toast.type]}`}>
                            {icons[toast.type]}
                        </span>
                        <div className="flex-1">
                            <p className="font-medium text-white">{toast.title}</p>
                            {toast.message && <p className="text-sm text-slate-400 mt-1">{toast.message}</p>}
                        </div>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
