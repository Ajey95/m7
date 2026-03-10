"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiService } from "../../../lib/api-service";
import { useWebSocket, WebSocketMessage } from "../../../lib/websocket-service";
import { useToast } from "../../../lib/toast-context";
import { useAuth } from "../../../lib/auth-context";
import dynamic from "next/dynamic";

const DispatcherMap = dynamic(() => import("../../../components/DispatcherMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex gap-3">
            <div className="w-[220px] shrink-0 flex flex-col gap-2">
                {[1,2,3,4].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
                ))}
            </div>
            <div className="flex-1 rounded-xl bg-slate-800/30 animate-pulse flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                    <span className="material-symbols-outlined text-4xl">map</span>
                    <span className="text-sm">Loading map…</span>
                </div>
            </div>
        </div>
    ),
});

const NotificationBell = dynamic(() => import("../../../components/NotificationBell"), {
    ssr: false,
});

interface Task {
    id: string;
    food_type: string;
    quantity_kg: number;
    status: string;
    pickup_address: string;
    delivery_address?: string;
    volunteer_id?: string;
    created_at: string;
    priority?: number;
    pickup_lat?: number;
    pickup_lng?: number;
    donor_name?: string;
    ngo_id?: string;
    description?: string;
}

interface Volunteer {
    id: string;
    name: string;
    is_available: boolean;
    current_location?: { lat: number; lng: number };
    latitude?: number;
    longitude?: number;
    phone?: string;
    status?: string;
    id_verified?: boolean;
}

export default function DispatcherDashboard() {
    const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [ngos, setNgos] = useState<any[]>([]);
    const [donors, setDonors] = useState<any[]>([]);
    const [pendingVolunteers, setPendingVolunteers] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<"list" | "map" | "surplus">("list");
    const [activeTab, setActiveTab] = useState<"tasks" | "approvals">("tasks");

    // â”€â”€ Surplus Prediction state (#3) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [surplusPrediction, setSurplusPrediction] = useState<any>(null);
    const [surplusLoading, setSurplusLoading] = useState(false);
    const [surplusCity, setSurplusCity] = useState("Bengaluru");

    const fetchData = useCallback(async () => {
        // Don't fetch if not authenticated
        const token = localStorage.getItem("auth_token");
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const [tasksRes, volunteersRes, ngosRes, donorsRes, pendingRes] = await Promise.all([
                apiService.getDispatcherTasks(),
                apiService.getVolunteers(),
                apiService.getDispatcherNgos(),
                apiService.getDispatcherDonors(),
                apiService.getPendingVolunteers(),
            ]);

            if (tasksRes.data) setTasks(tasksRes.data);
            if (volunteersRes.data) setVolunteers(volunteersRes.data);
            if (ngosRes.data) setNgos(ngosRes.data);
            if (donorsRes.data) setDonors(donorsRes.data);
            if (pendingRes.data) setPendingVolunteers(pendingRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Real-time updates
    useWebSocket(
        ["task_created", "task_updated", "task_assigned", "task_completed", "volunteer_online", "volunteer_offline"],
        (message: WebSocketMessage) => {
            const typeLabels: Record<string, string> = {
                task_created: "New Task",
                task_updated: "Task Updated",
                task_assigned: "Task Assigned",
                task_completed: "Task Completed",
                volunteer_online: "Volunteer Online",
                volunteer_offline: "Volunteer Offline",
            };

            addToast({
                type: message.type.includes("completed") ? "success" : "info",
                title: typeLabels[message.type] || "Update",
                message: message.payload?.name || message.payload?.food_type || "Real-time update received",
            });

            fetchData();
        },
        [fetchData, addToast] // Include fetchData and addToast in dependencies
    );

    useEffect(() => {
        if (!isAuthenticated || authLoading) return;
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData, isAuthenticated, authLoading]);

    const assignVolunteer = async (taskId: string, volunteerId: string) => {
        const res = await apiService.dispatcherAssignTask(taskId, volunteerId);
        if (!res.error) {
            addToast({ type: "success", title: "Volunteer Assigned", message: "Task has been assigned" });
            fetchData();
            setSelectedTask(null);
        } else {
            addToast({ type: "error", title: "Error", message: res.error });
        }
    };

    const handleApproveVolunteer = async (volunteerId: string) => {
        const res = await apiService.approveVolunteer(volunteerId);
        if (!res.error) {
            addToast({ type: "success", title: "Approved", message: "Volunteer has been verified" });
            setPendingVolunteers(prev => prev.filter(v => v.id !== volunteerId));
        } else {
            addToast({ type: "error", title: "Error", message: res.error });
        }
    };

    const handleRejectVolunteer = async (volunteerId: string) => {
        const res = await apiService.rejectVolunteer(volunteerId);
        if (!res.error) {
            addToast({ type: "error", title: "Rejected", message: "Volunteer application has been rejected" });
            setPendingVolunteers(prev => prev.filter(v => v.id !== volunteerId));
        } else {
            addToast({ type: "error", title: "Error", message: res.error });
        }
    };

    const runSurplusPrediction = async () => {
        setSurplusLoading(true);
        try {
            const res = await fetch("/api/ai/surplus-prediction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city: surplusCity }),
            });
            const data = await res.json();
            setSurplusPrediction(data);
        } catch {
            // silent
        } finally {
            setSurplusLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PENDING": return "bg-yellow-500/20 text-yellow-400";
            case "ASSIGNED": return "bg-blue-500/20 text-blue-400";
            case "IN_TRANSIT": return "bg-purple-500/20 text-purple-400";
            case "PICKED_UP": return "bg-[#fb923c]/20 text-[#fb923c]";
            case "COMPLETED": return "bg-green-500/20 text-green-400";
            default: return "bg-slate-500/20 text-slate-400";
        }
    };

    const tasksByStatus = {
        pending: tasks.filter(t => t.status === "PENDING"),
        active: tasks.filter(t => ["ASSIGNED", "IN_TRANSIT", "PICKED_UP"].includes(t.status)),
        completed: tasks.filter(t => t.status === "COMPLETED"),
    };

    return (
        <div className="min-h-screen text-white">
            {/* Background */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
            <div className="bg-nebula-parallax"></div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 glass-card rounded-none border-b border-white/10 px-6 py-4">
                <div className="glass-highlight"></div>
                <div className="max-w-[1800px] mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#fb923c] to-orange-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(251,146,60,0.4)]">
                            <span className="material-symbols-outlined text-white">eco</span>
                        </div>
                        <span className="text-xl font-bold">Dispatcher Console</span>
                    </Link>
                    <div className="flex items-center gap-6">
                        <div className="flex bg-slate-800/50 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setActiveTab("tasks")}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "tasks" ? "bg-[#fb923c] text-slate-900" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Tasks
                            </button>
                            <button
                                onClick={() => setActiveTab("approvals")}
                                className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "approvals" ? "bg-[#fb923c] text-slate-900" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Approvals
                                {pendingVolunteers.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {pendingVolunteers.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setViewMode("surplus")}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "surplus" ? "bg-purple-500 text-white" : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                🔮 Surplus Intel
                            </button>
                        </div>

                        {activeTab === "tasks" && (
                            <div className="flex bg-slate-800/50 rounded-lg p-1 border border-white/10">
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"
                                        }`}
                                >
                                    List
                                </button>
                                <button
                                    onClick={() => setViewMode("map")}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "map" ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"
                                        }`}
                                >
                                    Map
                                </button>
                            </div>
                        )}

                        {user && (
                            <span className="text-sm text-slate-400">Welcome, {user.full_name || user.name}</span>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            <span className="text-slate-400">{volunteers.filter(v => v.is_available).length} volunteers online</span>
                        </div>
                        <NotificationBell />
                        <button onClick={logout} className="text-slate-400 hover:text-red-400 transition-colors">
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 px-6 pb-6 relative z-10 max-w-[1800px] mx-auto">

                {/* ===== TASKS TAB ===== */}
                {activeTab === "tasks" && (
                    <>
                        {/* Stats Row */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-yellow-400">{tasksByStatus.pending.length}</p>
                                        <p className="text-sm text-slate-400">Pending</p>
                                    </div>
                                    <span className="material-symbols-outlined text-yellow-400 text-3xl opacity-50">pending</span>
                                </div>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-blue-400">{tasksByStatus.active.length}</p>
                                        <p className="text-sm text-slate-400">Active</p>
                                    </div>
                                    <span className="material-symbols-outlined text-blue-400 text-3xl opacity-50">local_shipping</span>
                                </div>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-green-400">{tasksByStatus.completed.length}</p>
                                        <p className="text-sm text-slate-400">Completed Today</p>
                                    </div>
                                    <span className="material-symbols-outlined text-green-400 text-3xl opacity-50">check_circle</span>
                                </div>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-[#fb923c]">{volunteers.filter(v => v.is_available).length}</p>
                                        <p className="text-sm text-slate-400">Available Volunteers</p>
                                    </div>
                                    <span className="material-symbols-outlined text-[#fb923c] text-3xl opacity-50">groups</span>
                                </div>
                            </div>
                        </div>

                        {/* Map — ALWAYS in DOM so Google Maps JS never remounts */}
                        <div className={`glass-card p-4 h-[calc(100vh-250px)] relative mb-6 ${viewMode === "map" ? "block" : "hidden"}`}>
                            <div className="glass-highlight"></div>
                            <DispatcherMap
                                tasks={tasks}
                                volunteers={volunteers}
                                ngos={ngos}
                                donors={donors}
                            />
                        </div>

                        {/* Surplus Intelligence panel */}
                        {viewMode === "surplus" && (
                            <div className="glass-card p-6 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                            <span className="text-purple-400">🔮</span>
                                            Surplus Intelligence
                                        </h2>
                                        <p className="text-slate-400 text-sm mt-1">AI-powered event-driven food surplus predictions</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <select
                                            aria-label="Select city for surplus prediction"
                                            value={surplusCity}
                                            onChange={e => setSurplusCity(e.target.value)}
                                            className="bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                                        >
                                            {["Bengaluru","Mumbai","Delhi","Chennai","Hyderabad","Pune","Kolkata"].map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={runSurplusPrediction}
                                            disabled={surplusLoading}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
                                        >
                                            {surplusLoading ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <span className="material-symbols-outlined text-sm">psychology</span>
                                            )}
                                            {surplusLoading ? "Analyzing..." : "Run Prediction"}
                                        </button>
                                    </div>
                                </div>

                                {!surplusPrediction && !surplusLoading && (
                                    <div className="text-center py-16 text-slate-500">
                                        <span className="text-5xl mb-4 block">🔮</span>
                                        <p className="text-lg font-medium">Select a city and run prediction</p>
                                        <p className="text-sm mt-1">AI will analyse upcoming events and forecast food surplus spikes</p>
                                    </div>
                                )}

                                {surplusLoading && (
                                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                                        <div className="w-12 h-12 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin"></div>
                                        <p className="text-slate-400 text-sm">Scanning events &amp; reasoning surplus patterns…</p>
                                    </div>
                                )}

                                {surplusPrediction && !surplusLoading && (
                                    <div className="space-y-6">
                                        {surplusPrediction.top_alert && (
                                            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                                <span className="text-2xl">🚨</span>
                                                <div>
                                                    <p className="font-semibold text-red-300">Top Alert</p>
                                                    <p className="text-slate-300 text-sm mt-0.5">{surplusPrediction.top_alert}</p>
                                                </div>
                                            </div>
                                        )}
                                        {surplusPrediction.summary && (
                                            <p className="text-slate-400 text-sm leading-relaxed">{surplusPrediction.summary}</p>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {(surplusPrediction.predictions || []).map((pred: any, i: number) => {
                                                const priorityStyles: Record<string, string> = {
                                                    CRITICAL: "border-red-500/50 bg-red-500/10",
                                                    HIGH: "border-orange-500/50 bg-orange-500/10",
                                                    MEDIUM: "border-yellow-500/50 bg-yellow-500/10",
                                                    LOW: "border-green-500/50 bg-green-500/10",
                                                };
                                                const badgeStyles: Record<string, string> = {
                                                    CRITICAL: "bg-red-500/20 text-red-300",
                                                    HIGH: "bg-orange-500/20 text-orange-300",
                                                    MEDIUM: "bg-yellow-500/20 text-yellow-300",
                                                    LOW: "bg-green-500/20 text-green-300",
                                                };
                                                const priority = pred.priority || "MEDIUM";
                                                return (
                                                    <div key={i} className={`p-5 rounded-xl border ${priorityStyles[priority] || priorityStyles.MEDIUM}`}>
                                                        <div className="flex items-start justify-between mb-3">
                                                            <p className="font-semibold text-white leading-tight">{pred.event_name}</p>
                                                            <span className={`ml-2 shrink-0 px-2 py-0.5 rounded text-xs font-medium ${badgeStyles[priority] || badgeStyles.MEDIUM}`}>{priority}</span>
                                                        </div>
                                                        <div className="space-y-1.5 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-400">Predicted Surplus</span>
                                                                <span className="font-bold text-purple-300">{pred.predicted_surplus_kg} kg</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-400">Spike</span>
                                                                <span className="font-medium text-white">+{pred.spike_pct ?? pred.spike_percentage}%</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-400">Date</span>
                                                                <span className="text-slate-300">{pred.event_date}</span>
                                                            </div>
                                                        </div>
                                                        {pred.recommended_action && (
                                                            <div className="mt-3 pt-3 border-t border-white/10">
                                                                <p className="text-xs text-slate-400 leading-relaxed">💡 {pred.recommended_action}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {surplusPrediction.events_ingested && surplusPrediction.events_ingested.length > 0 && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Events Analysed</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {surplusPrediction.events_ingested.map((ev: any, i: number) => (
                                                        <span key={i} className="px-3 py-1 bg-slate-800/60 border border-white/10 rounded-full text-xs text-slate-300">{typeof ev === "object" ? ev.name : ev}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* List view — task queue + volunteers */}
                        {viewMode === "list" && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 glass-card p-6 relative max-h-[calc(100vh-250px)] overflow-y-auto">
                                    <div className="glass-highlight"></div>
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#fb923c]">queue</span>
                                        Task Queue
                                    </h2>
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="w-8 h-8 border-2 border-[#fb923c]/30 border-t-[#fb923c] rounded-full animate-spin"></div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {tasks.length === 0 ? (
                                                <p className="text-center text-slate-400 py-8">No tasks in queue</p>
                                            ) : (
                                                tasks.map((task) => (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => setSelectedTask(task)}
                                                        className={`p-4 bg-slate-800/30 rounded-xl border transition-all cursor-pointer ${selectedTask?.id === task.id ? "border-[#fb923c] bg-[#fb923c]/10" : "border-white/5 hover:border-white/10"}`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                                                    {task.status}
                                                                </span>
                                                                <span className="font-medium">{task.food_type}</span>
                                                            </div>
                                                            <span className="text-lg font-bold text-[#fb923c]">{task.quantity_kg || 0} kg</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 text-sm text-slate-400">
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-green-400 text-sm">location_on</span>
                                                                <span className="truncate">{task.pickup_address}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-red-400 text-sm">flag</span>
                                                                <span className="truncate">{task.delivery_address || "Awaiting NGO claim"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="glass-card p-6 relative max-h-[calc(100vh-250px)] overflow-y-auto">
                                    <div className="glass-highlight"></div>
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-green-400">groups</span>
                                        Volunteers
                                    </h2>
                                    <div className="space-y-3">
                                        {volunteers.map((volunteer) => (
                                            <div
                                                key={volunteer.id}
                                                className={`p-4 rounded-xl border transition-all ${volunteer.is_available ? "bg-green-500/10 border-green-500/30" : "bg-slate-800/30 border-white/5"}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${volunteer.is_available ? "bg-green-500/20" : "bg-slate-700"}`}>
                                                            <span className="material-symbols-outlined text-green-400">person</span>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{volunteer.name}</p>
                                                            <p className={`text-xs ${volunteer.is_available ? "text-green-400" : "text-slate-500"}`}>
                                                                {volunteer.is_available ? "Available" : "Busy"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {selectedTask && selectedTask.status === "PENDING" && volunteer.is_available && (
                                                        <button
                                                            onClick={() => assignVolunteer(selectedTask.id, volunteer.id)}
                                                            className="px-3 py-1 bg-[#fb923c] hover:bg-orange-400 text-slate-900 rounded-lg text-sm font-medium transition-all"
                                                        >
                                                            Assign
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ===== APPROVALS TAB ===== */}
                {activeTab === "approvals" && (
                    <>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-yellow-400">{pendingVolunteers.length}</p>
                                        <p className="text-sm text-slate-400">Pending Approvals</p>
                                    </div>
                                    <span className="material-symbols-outlined text-yellow-400 text-3xl opacity-50">how_to_reg</span>
                                </div>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-green-400">{volunteers.filter(v => v.id_verified).length}</p>
                                        <p className="text-sm text-slate-400">Verified Volunteers</p>
                                    </div>
                                    <span className="material-symbols-outlined text-green-400 text-3xl opacity-50">verified_user</span>
                                </div>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight"></div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-bold text-[#fb923c]">{volunteers.length}</p>
                                        <p className="text-sm text-slate-400">Total Volunteers</p>
                                    </div>
                                    <span className="material-symbols-outlined text-[#fb923c] text-3xl opacity-50">groups</span>
                                </div>
                            </div>
                        </div>
                        <div className="glass-card p-6 relative">
                            <div className="glass-highlight"></div>
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-yellow-400">how_to_reg</span>
                                Pending Volunteer Applications
                            </h2>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-[#fb923c]/30 border-t-[#fb923c] rounded-full animate-spin"></div>
                                </div>
                            ) : pendingVolunteers.length === 0 ? (
                                <div className="text-center py-16">
                                    <span className="material-symbols-outlined text-5xl text-slate-600 mb-4 block">check_circle</span>
                                    <p className="text-slate-400 text-lg">No pending applications</p>
                                    <p className="text-slate-500 text-sm mt-1">All volunteer registrations have been reviewed</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {pendingVolunteers.map((vol) => (
                                        <div key={vol.id} className="p-5 bg-slate-800/40 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-all">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-yellow-400 text-2xl">person</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-white truncate">{vol.name}</p>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">PENDING VERIFICATION</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2.5 mb-5">
                                                {vol.email && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                                        <span className="material-symbols-outlined text-slate-500 text-base">mail</span>
                                                        <span className="truncate">{vol.email}</span>
                                                    </div>
                                                )}
                                                {vol.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                                        <span className="material-symbols-outlined text-slate-500 text-base">phone</span>
                                                        <span>{vol.phone}</span>
                                                    </div>
                                                )}
                                                {vol.vehicle_type && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                                        <span className="material-symbols-outlined text-slate-500 text-base">directions_car</span>
                                                        <span>{vol.vehicle_type}</span>
                                                    </div>
                                                )}
                                                {vol.created_at && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                                        <span className="material-symbols-outlined text-slate-500 text-base">calendar_today</span>
                                                        <span>Registered {new Date(vol.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApproveVolunteer(vol.id)}
                                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <span className="material-symbols-outlined text-base">check</span>
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleRejectVolunteer(vol.id)}
                                                    className="flex-1 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <span className="material-symbols-outlined text-base">close</span>
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
