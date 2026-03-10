"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { wsService } from "../lib/websocket-service";
import { requestNotificationPermission, getFCMToken, onForegroundMessage } from "../lib/fcm";

interface AppNotification {
    id: string;
    title: string;
    body: string;
    type: string;
    timestamp: string;
    read: boolean;
    priority?: string;
    url?: string;
}

const PRIORITY_STYLES: Record<string, string> = {
    CRITICAL: "bg-red-500/20 text-red-300",
    HIGH: "bg-orange-500/20 text-orange-300",
    MEDIUM: "bg-yellow-500/20 text-yellow-300",
};

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [fcmReady, setFcmReady] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const addNotification = useCallback((n: Omit<AppNotification, "id" | "read">) => {
        setNotifications((prev) =>
            [{ ...n, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, read: false }, ...prev].slice(0, 50),
        );
    }, []);

    // ── Initialise FCM on mount ───────────────────────────────────────────── //
    useEffect(() => {
        (async () => {
            const perm = await requestNotificationPermission();
            setPermission(perm);
            if (perm !== "granted") return;

            const token = await getFCMToken();
            if (!token) return;

            try {
                const authToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                const res = await fetch("/api/fcm/register", {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        "Content-Type": "application/json",
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                    body: JSON.stringify({ token, device: "web" }),
                });
                clearTimeout(timeout);
                if (res.ok || res.status === 204) setFcmReady(true);
            } catch {
                // Backend might not be configured — degraded gracefully
            }
        })();
    }, []);

    // ── Foreground FCM messages ───────────────────────────────────────────── //
    useEffect(() => {
        if (permission !== "granted") return;
        return onForegroundMessage((payload) => {
            addNotification({
                title: payload.notification?.title ?? "New Alert",
                body: payload.notification?.body ?? "",
                type: payload.data?.type ?? "fcm",
                timestamp: new Date().toISOString(),
                priority: payload.data?.priority,
                url: payload.data?.url,
            });
        });
    }, [permission, addNotification]);

    // ── Socket.IO notification events ─────────────────────────────────────── //
    useEffect(() => {
        const unsub = wsService.subscribe("notification", (msg) => {
            addNotification({
                title: msg.payload?.title ?? "System Update",
                body: msg.payload?.message ?? msg.payload?.body ?? "",
                type: msg.payload?.type ?? "socket",
                timestamp: msg.timestamp,
                priority: msg.payload?.priority,
                url: msg.payload?.url,
            });
        });
        return () => unsub();
    }, [addNotification]);

    // ── Close panel on outside click ──────────────────────────────────────── //
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
                panelRef.current && !panelRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAllRead = () =>
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    const markRead = (id: string) =>
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

    return (
        <>
        <div className="relative" ref={buttonRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
            >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
                {/* Yellow dot = FCM connected but not yet ready */}
                {!fcmReady && permission === "granted" && (
                    <span className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-yellow-400 rounded-full border border-slate-900" />
                )}
            </button>
        </div>

        {/* Dropdown — rendered via portal to escape header's backdrop-filter/overflow */}
        {open && typeof window !== "undefined" && createPortal(
            <div ref={panelRef} className="fixed right-4 top-[72px] z-[9999] w-[340px] bg-slate-900/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#fb923c] text-base">notifications</span>
                            Notifications
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                                    {unreadCount}
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-3">
                            {permission !== "granted" && (
                                <button
                                    onClick={() => requestNotificationPermission().then(setPermission)}
                                    className="text-[11px] text-yellow-400 hover:text-yellow-300 underline"
                                >
                                    Enable push
                                </button>
                            )}
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-[11px] text-slate-400 hover:text-white transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2">notifications_none</span>
                                <p className="text-sm">No notifications yet</p>
                                <p className="text-xs mt-1 text-slate-600">Task events will appear here in real time</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => markRead(n.id)}
                                    className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors hover:bg-slate-800/50 ${!n.read ? "bg-[#fb923c]/5" : ""}`}
                                >
                                    <div className="flex items-start gap-2">
                                        {!n.read && (
                                            <span className="mt-[5px] w-2 h-2 rounded-full bg-[#fb923c] shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <p className={`text-sm font-medium truncate ${!n.read ? "text-white" : "text-slate-300"}`}>
                                                    {n.title}
                                                </p>
                                                {n.priority && PRIORITY_STYLES[n.priority] && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${PRIORITY_STYLES[n.priority]}`}>
                                                        {n.priority}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-2">{n.body}</p>
                                            <p className="text-[10px] text-slate-600 mt-1">
                                                {new Date(n.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* FCM status footer */}
                    <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${fcmReady ? "bg-green-400" : permission === "denied" ? "bg-red-400" : "bg-slate-500"}`} />
                        <p className={`text-[10px] ${fcmReady ? "text-green-400" : "text-slate-500"}`}>
                            {fcmReady
                                ? "Push notifications active"
                                : permission === "denied"
                                ? "Push notifications blocked by browser"
                                : permission === "granted"
                                ? "Connecting to push service…"
                                : "Push notifications not enabled"}
                        </p>
                    </div>
                </div>,
            document.body
        )}
        </>
    );
}
