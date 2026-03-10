// Firebase Messaging Service Worker
// Served from /firebase-messaging-sw.js (Next.js public/ folder → root path)
// Handles background push notifications via FCM.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

let messagingInitialised = false;

// Receive Firebase config from the main thread after SW registration
self.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "INIT_FIREBASE" || messagingInitialised) return;

    const cfg = event.data.config;
    if (!cfg || !cfg.apiKey || !cfg.projectId) return;

    if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
    }
    messagingInitialised = true;

    const messaging = firebase.messaging();

    // Handle FCM push when the app is in the background or closed
    messaging.onBackgroundMessage(function (payload) {
        const notification = payload.notification || {};
        const data = payload.data || {};

        self.registration.showNotification(notification.title || "Food Rescue Update", {
            body: notification.body || "",
            icon: notification.icon || "/favicon.ico",
            badge: "/favicon.ico",
            tag: data.type || "fcm",
            data: { url: data.url || "/dashboard/dispatcher" },
            requireInteraction: data.priority === "CRITICAL",
            vibrate: [200, 100, 200],
        });
    });
});

// Open / focus the app when notification is clicked
self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "/";
    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then(function (clientList) {
                for (const client of clientList) {
                    if (client.url === targetUrl && "focus" in client) return client.focus();
                }
                if (clients.openWindow) return clients.openWindow(targetUrl);
            })
    );
});
