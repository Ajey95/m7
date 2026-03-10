"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api-config";

export type WebSocketEventType =
    | "task_created"
    | "task_updated"
    | "task_assigned"
    | "task_completed"
    | "volunteer_online"
    | "volunteer_offline"
    | "volunteer_location"
    | "donation_claimed"
    | "notification"
    | "dispatcher_update";

export interface WebSocketMessage {
    type: WebSocketEventType;
    payload: any;
    timestamp: string;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
    private socket: Socket | null = null;
    private handlers: Map<WebSocketEventType | "all", Set<MessageHandler>> = new Map();

    connect(token?: string) {
        if (this.socket?.connected) {
            return;
        }

        // Backend wraps FastAPI, so socket is available at root /socket.io
        this.socket = io(API_BASE_URL, {
            path: "/socket.io",
            auth: {
                token: token
            },
            transports: ["polling", "websocket"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        this.socket.on("connect", () => {
            console.log("[Socket.IO] Connected:", this.socket?.id);
            // Register as dispatcher if token is present (assuming admin/dispatcher context)
            if (token) {
                this.socket?.emit("dispatcher_register", {}); // Or "admin_register" if distinct
            }
        });

        this.socket.on("disconnect", (reason) => {
            console.log("[Socket.IO] Disconnected:", reason);
        });

        this.socket.on("connect_error", (error) => {
            console.error("[Socket.IO] Connection error:", error);
        });

        // Listen for all event types we care about
        const events: WebSocketEventType[] = [
            "task_created",
            "task_updated",
            "task_assigned",
            "task_completed",
            "volunteer_online",
            "volunteer_offline",
            "volunteer_location",
            "donation_claimed",
            "notification",
            "dispatcher_update"
        ];

        events.forEach(eventType => {
            this.socket?.on(eventType, (data) => {
                // Determine structure compatibility
                // Socket.IO sends data directly, not wrapped in a generic "message" event usually
                // But our existing handlers expect { type, payload }

                // If the event name matches existing types, wrap it
                const message: WebSocketMessage = {
                    type: eventType,
                    payload: data,
                    timestamp: new Date().toISOString()
                };
                this.notifyHandlers(message);
            });
        });

        // Catch-all for "dispatcher_update" which might contain other event types inside
        this.socket.on("dispatcher_update", (data) => {
            if (data.event) {
                const message: WebSocketMessage = {
                    type: data.event as WebSocketEventType,
                    payload: data,
                    timestamp: new Date().toISOString()
                };
                this.notifyHandlers(message);
            }
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    subscribe(type: WebSocketEventType | "all", handler: MessageHandler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.handlers.get(type)?.delete(handler);
        };
    }

    private notifyHandlers(message: WebSocketMessage) {
        // Notify specific type handlers
        this.handlers.get(message.type)?.forEach(handler => handler(message));

        // Notify "all" handlers
        this.handlers.get("all")?.forEach(handler => handler(message));
    }

    send(event: string, payload: any) {
        if (this.socket?.connected) {
            this.socket.emit(event, payload);
        } else {
            console.warn("[Socket.IO] Cannot send - not connected");
        }
    }

    isConnected() {
        return this.socket?.connected || false;
    }
}

// Singleton instance
export const wsService = new WebSocketService();

// React hook for WebSocket
export function useWebSocket(
    eventTypes: (WebSocketEventType | "all")[],
    handler: MessageHandler,
    deps: any[] = []
) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        const token = localStorage.getItem("auth_token");
        // Ensure connection is established
        if (token) {
            wsService.connect(token);
        }

        const unsubscribes = eventTypes.map(type =>
            wsService.subscribe(type, (msg) => handlerRef.current(msg))
        );

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, deps);
}

// Hook for connection status
export function useWebSocketStatus() {
    const checkConnection = useCallback(() => wsService.isConnected(), []);
    return { isConnected: checkConnection };
}
