"use client";
// Firebase Cloud Messaging helpers — browser-only.
// All functions guard against SSR / missing Notification API.

import { getFirebaseApp } from "./firebase";
import { getMessaging, getToken, onMessage, Messaging, MessagePayload } from "firebase/messaging";

let _messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
    if (typeof window === "undefined" || !("Notification" in window)) return null;
    if (!_messaging) {
        const app = getFirebaseApp();
        _messaging = getMessaging(app);
    }
    return _messaging;
}

/** Ask the browser for notification permission. Returns the resulting state. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return Notification.requestPermission();
}

/**
 * Register the firebase-messaging-sw.js service worker, send it the Firebase
 * config (so it can handle background messages), then return the FCM token.
 */
const FCM_TOKEN_CACHE_KEY = "_fcm_token_cached";

export async function getFCMToken(): Promise<string | null> {
    try {
        // Return cached token from this session to avoid repeated slow calls
        const cached = sessionStorage.getItem(FCM_TOKEN_CACHE_KEY);
        if (cached) return cached;

        const m = getMessagingInstance();
        if (!m) return null;

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.warn("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — skipping push setup");
            return null;
        }

        // Register the SW that handles background push messages
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        // Wait for the SW to be active — with a 8s timeout
        const activeSW: ServiceWorker = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("SW activation timeout")), 8000);
            const done = (sw: ServiceWorker) => { clearTimeout(timer); resolve(sw); };
            if (swReg.active) { done(swReg.active); return; }
            const target = swReg.installing ?? swReg.waiting;
            if (!target) { clearTimeout(timer); reject(new Error("No SW target")); return; }
            target.addEventListener("statechange", function handler() {
                if ((this as ServiceWorker).state === "activated") {
                    (this as ServiceWorker).removeEventListener("statechange", handler);
                    done(this as ServiceWorker);
                }
            });
        });

        // Post the Firebase config to the SW so it can initialise Firebase there
        activeSW.postMessage({
            type: "INIT_FIREBASE",
            config: {
                apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            },
        });

        // Wrap getToken with a 10s timeout — Firebase network call can hang
        const token = await Promise.race([
            getToken(m, { vapidKey, serviceWorkerRegistration: swReg }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error("getToken timeout")), 10000)),
        ]);
        if (token) sessionStorage.setItem(FCM_TOKEN_CACHE_KEY, token);
        return token || null;
    } catch (err) {
        console.warn("[FCM] getFCMToken failed (non-critical):", err);
        return null;
    }
}

/**
 * Listen for FCM messages while the browser tab is in the foreground.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(handler: (payload: MessagePayload) => void): () => void {
    const m = getMessagingInstance();
    if (!m) return () => {};
    return onMessage(m, handler);
}
