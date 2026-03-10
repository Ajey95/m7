"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/toast-context";
import { apiService } from "../../../lib/api-service";
import { useWebSocket, WebSocketMessage } from "../../../lib/websocket-service";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PerfData {
    volunteer_id: string;
    volunteer_name: string;
    my_stats: {
        total_deliveries: number;
        cancellation_rate_pct: number;
        total_kg_delivered: number;
        avg_completion_minutes: number;
        on_time_percentage: number;
        rating: number;
    };
    city_avg: {
        avg_deliveries: number;
        avg_completion_minutes: number;
        on_time_percentage: number;
    };
    comparison: {
        deliveries_vs_avg: number;
        completion_time_delta: number;
        on_time_delta_pct: number;
    };
}

interface VolunteerProfile {
    id: string;
    status: string;
    vehicle_type: string;
    rating: number;
    total_deliveries: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Delta({ value, unit = "", invert = false }: { value: number; unit?: string; invert?: boolean }) {
    const positive = invert ? value < 0 : value > 0;
    const colour = positive ? "#34d399" : value === 0 ? "#94a3b8" : "#f87171";
    const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "–";
    return (
        <span style={{ color: colour, fontWeight: 700 }}>
            {arrow} {Math.abs(value).toFixed(1)}{unit}
        </span>
    );
}

function GaugeRing({ pct, colour, label }: { pct: number; colour: string; label: string }) {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    return (
        <div className="flex flex-col items-center gap-2">
            <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                <circle
                    cx="45" cy="45" r={r} fill="none"
                    stroke={colour} strokeWidth="8"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    transform="rotate(-90 45 45)"
                    style={{ transition: "stroke-dasharray 0.8s ease" }}
                />
                <text x="45" y="50" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">{Math.round(pct)}%</text>
            </svg>
            <p className="text-xs text-slate-400 text-center">{label}</p>
        </div>
    );
}

function CompareRow({ label, mine, city, delta, unit = "", invert = false }:
    { label: string; mine: number; city: number; delta: number; unit?: string; invert?: boolean }) {
    return (
        <div className="grid grid-cols-4 gap-3 py-3 border-b border-white/5 text-sm items-center">
            <span className="text-slate-400">{label}</span>
            <span className="font-bold text-white text-center">{mine.toFixed(1)}{unit}</span>
            <span className="text-slate-500 text-center">{city.toFixed(1)}{unit}</span>
            <div className="text-center"><Delta value={delta} unit={unit} invert={invert} /></div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VolunteerDashboard() {
    const { user, logout } = useAuth();
    const { addToast } = useToast();
    type TabType = "overview" | "performance" | "tasks" | "food-scanner";
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [profile, setProfile] = useState<VolunteerProfile | null>(null);
    const [perf, setPerf] = useState<PerfData | null>(null);
    const [tasks, setTasks] = useState<any[]>([]);
    const [isOnline, setIsOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [statusChanging, setStatusChanging] = useState(false);

    // ── Food Safety Scanner state (#1) ─────────────────────────
    const [scanPreview, setScanPreview] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<any>(null);
    const [scanLoading, setScanLoading] = useState(false);
    const [scanFile, setScanFile] = useState<File | null>(null);

    // Real-time updates
    useWebSocket(["task_assigned", "task_updated", "volunteer_online"], (msg: WebSocketMessage) => {
        if (msg.type === "task_assigned") {
            addToast({ type: "info", title: "New Task Assigned", message: "You have a new delivery!" });
            loadTasks();
        }
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const profileRes = await apiService.getVolunteerProfile();
        if (!profileRes.data) {
            addToast({ type: "error", title: "Error", message: "Could not load volunteer profile" });
            setIsLoading(false);
            return;
        }
        const vol = profileRes.data;
        setProfile(vol);
        setIsOnline(vol.status === "ONLINE");

        const [perfRes, tasksRes] = await Promise.allSettled([
            apiService.getAnalyticsVolunteerPerf(vol.id),
            apiService.getTasks(),
        ]);

        if (perfRes.status === "fulfilled" && perfRes.value.data) setPerf(perfRes.value.data);
        if (tasksRes.status === "fulfilled" && tasksRes.value.data) setTasks(tasksRes.value.data);

        setIsLoading(false);
    };

    const loadTasks = async () => {
        const res = await apiService.getTasks();
        if (res.data) setTasks(res.data);
    };

    const toggleStatus = async () => {
        setStatusChanging(true);
        const newStatus = !isOnline;
        const res = await apiService.updateVolunteerStatus(newStatus);
        if (!res.error) {
            setIsOnline(newStatus);
            addToast({ type: "success", title: newStatus ? "You're Online" : "You're Offline", message: newStatus ? "You'll now receive task assignments" : "No new assignments while offline" });
        } else {
            addToast({ type: "error", title: "Error", message: res.error });
        }
        setStatusChanging(false);
    };

    const myTasks = tasks.filter((t: any) => t.volunteer_id === profile?.id);
    const availableTasks = tasks.filter((t: any) => t.status === "PENDING" && !t.volunteer_id);

    const handleScanImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setScanFile(file);
        setScanResult(null);
        const reader = new FileReader();
        reader.onload = ev => setScanPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const runFoodScan = async () => {
        if (!scanFile) return;
        setScanLoading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            const base64 = dataUrl.split(",")[1];
            const mime_type = scanFile.type || "image/jpeg";
            try {
                const res = await fetch("/api/ai/scan-food", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image_base64: base64, mime_type }),
                });
                const data = await res.json();
                if (data.error) addToast({ type: "error", title: "Scan Failed", message: data.error });
                else setScanResult(data);
            } catch {
                addToast({ type: "error", title: "Error", message: "AI service unavailable" });
            }
            setScanLoading(false);
        };
        reader.readAsDataURL(scanFile);
    };

    const navItems = [
        { id: "overview", label: "Overview", icon: "dashboard" },
        { id: "food-scanner", label: "Food Safety Scan", icon: "document_scanner" },
        { id: "performance", label: "Performance", icon: "analytics" },
        { id: "tasks", label: "My Tasks", icon: "local_shipping" },
    ];

    return (
        <div className="min-h-screen text-white">
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]" />
            <div className="bg-nebula-parallax" />

            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 glass-card rounded-none border-r border-white/10 z-40 p-6 flex flex-col">
                <div className="glass-highlight" />
                <Link href="/" className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                        <span className="material-symbols-outlined text-white">directions_bike</span>
                    </div>
                    <span className="text-xl font-bold">Volunteer Hub</span>
                </Link>

                {user && (
                    <div className="mb-4 p-3 bg-slate-800/30 rounded-xl">
                        <p className="font-medium text-sm">{user.name || user.full_name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                        <span className="mt-1 inline-block text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Volunteer</span>
                    </div>
                )}

                {/* Online toggle */}
                <button
                    onClick={toggleStatus}
                    disabled={statusChanging}
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-xl mb-4 transition-all ${isOnline ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-slate-700/50 border border-slate-600 text-slate-400"}`}
                >
                    <span className="font-medium text-sm">{isOnline ? "🟢 Online" : "⚫ Offline"}</span>
                    <div className={`w-8 h-4 rounded-full transition-colors relative ${isOnline ? "bg-green-500" : "bg-slate-600"}`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isOnline ? "left-4" : "left-0.5"}`} />
                    </div>
                </button>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as TabType)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeTab === item.id ? "bg-blue-500/20 text-blue-400" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                        >
                            <span className="material-symbols-outlined text-sm">{item.icon}</span>
                            <span className="font-medium text-sm">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors">
                    <span className="material-symbols-outlined">logout</span>
                    <span className="font-medium">Logout</span>
                </button>
            </aside>

            {/* Main */}
            <main className="ml-64 p-8 relative z-10">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* ── OVERVIEW ── */}
                        {activeTab === "overview" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">Hi, {user?.name?.split(" ")[0] || "Volunteer"} 🚴</h1>
                                    <p className="text-slate-400 mt-1">Your delivery performance overview</p>
                                </header>

                                {/* Quick stats */}
                                <div className="flex flex-wrap gap-4 mb-6">
                                    {[
                                        { label: "Total Deliveries", value: profile?.total_deliveries ?? 0, colour: "#38bdf8" },
                                        { label: "Rating", value: `⭐ ${profile?.rating?.toFixed(1) ?? "5.0"}`, colour: "#fbbf24" },
                                        { label: "Vehicle", value: profile?.vehicle_type ?? "—", colour: "#a78bfa" },
                                        { label: "Status", value: isOnline ? "Online" : "Offline", colour: isOnline ? "#34d399" : "#94a3b8" },
                                        { label: "On-Time %", value: perf ? `${perf.my_stats.on_time_percentage}%` : "—", colour: "#4ade80" },
                                    ].map((s) => (
                                        <div key={s.label} className="glass-card p-5 relative flex-1 min-w-[140px]">
                                            <div className="glass-highlight" />
                                            <p style={{ color: s.colour, fontSize: 22, fontWeight: 700 }}>{s.value}</p>
                                            <p className="text-slate-400 text-sm mt-1">{s.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Performance rings */}
                                {perf && (
                                    <div className="glass-card p-6 relative mb-6">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold mb-6 text-slate-200">Key Performance Indicators</h3>
                                        <div className="flex flex-wrap justify-around gap-6">
                                            <GaugeRing pct={perf.my_stats.on_time_percentage} colour="#34d399" label="On-Time Rate" />
                                            <GaugeRing
                                                pct={(perf.my_stats.total_deliveries / Math.max(perf.city_avg.avg_deliveries, 1)) * 50}
                                                colour="#38bdf8"
                                                label="Deliveries vs Avg"
                                            />
                                            <GaugeRing
                                                pct={Math.max(0, 100 - (perf.my_stats.avg_completion_minutes / Math.max(perf.city_avg.avg_completion_minutes, 1)) * 100)}
                                                colour="#a78bfa"
                                                label="Speed Score"
                                            />
                                            <GaugeRing pct={Math.min((perf.my_stats.rating / 5) * 100, 100)} colour="#fbbf24" label={`Rating ${perf.my_stats.rating}/5`} />
                                        </div>
                                    </div>
                                )}

                                {/* Recent tasks */}
                                <div className="glass-card p-6 relative">
                                    <div className="glass-highlight" />
                                    <h3 className="font-bold mb-4">Recent Tasks</h3>
                                    {myTasks.length === 0 ? (
                                        <p className="text-slate-400 text-center py-8">No tasks yet</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {myTasks.slice(0, 5).map((t: any) => (
                                                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="material-symbols-outlined text-blue-400">local_shipping</span>
                                                        <div>
                                                            <p className="font-medium text-sm">{t.food_type}</p>
                                                            <p className="text-xs text-slate-400">{t.pickup_address}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-sm">{t.quantity_kg}kg</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "DELIVERED" || t.status === "COMPLETED" ? "bg-green-500/20 text-green-400" : t.status === "IN_TRANSIT" || t.status === "PICKED_UP" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                                            {t.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── PERFORMANCE (US10) ── */}
                        {activeTab === "performance" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">📊 Performance Analytics</h1>
                                    <p className="text-slate-400 mt-1">US10 — Your stats vs city average</p>
                                </header>

                                {!perf ? (
                                    <div className="glass-card p-8 text-center text-slate-400">
                                        Complete at least one delivery to see performance data.
                                    </div>
                                ) : (
                                    <>
                                        {/* Comparison table */}
                                        <div className="glass-card p-6 relative mb-6">
                                            <div className="glass-highlight" />
                                            <div className="grid grid-cols-4 gap-3 pb-2 border-b border-white/10 text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">
                                                <span>Metric</span>
                                                <span className="text-center text-blue-400">You</span>
                                                <span className="text-center">City Avg</span>
                                                <span className="text-center">Delta</span>
                                            </div>
                                            <CompareRow
                                                label="Total Deliveries" mine={perf.my_stats.total_deliveries}
                                                city={perf.city_avg.avg_deliveries} delta={perf.comparison.deliveries_vs_avg}
                                            />
                                            <CompareRow
                                                label="Avg Completion (min)" mine={perf.my_stats.avg_completion_minutes}
                                                city={perf.city_avg.avg_completion_minutes} delta={perf.comparison.completion_time_delta}
                                                unit=" min" invert
                                            />
                                            <CompareRow
                                                label="On-Time Rate" mine={perf.my_stats.on_time_percentage}
                                                city={perf.city_avg.on_time_percentage} delta={perf.comparison.on_time_delta_pct}
                                                unit="%"
                                            />
                                            <div className="grid grid-cols-4 gap-3 py-3 text-sm items-center">
                                                <span className="text-slate-400">Cancellation Rate</span>
                                                <span className="font-bold text-center">{perf.my_stats.cancellation_rate_pct}%</span>
                                                <span className="text-slate-500 text-center">—</span>
                                                <span className="text-center text-slate-500">—</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3 py-3 text-sm items-center">
                                                <span className="text-slate-400">Total KG Delivered</span>
                                                <span className="font-bold text-blue-400 text-center">{perf.my_stats.total_kg_delivered} kg</span>
                                                <span className="text-slate-500 text-center">—</span>
                                                <span className="text-center text-slate-500">—</span>
                                            </div>
                                        </div>

                                        {/* Rings */}
                                        <div className="glass-card p-6 relative mb-6">
                                            <div className="glass-highlight" />
                                            <h3 className="font-bold mb-6 text-slate-200">Visual Performance</h3>
                                            <div className="flex flex-wrap justify-around gap-6">
                                                <GaugeRing pct={perf.my_stats.on_time_percentage} colour="#34d399" label="On-Time %" />
                                                <GaugeRing pct={Math.min((perf.my_stats.rating / 5) * 100, 100)} colour="#fbbf24" label={`Rating ${perf.my_stats.rating}/5`} />
                                                <GaugeRing
                                                    pct={Math.max(0, 100 - perf.my_stats.cancellation_rate_pct)}
                                                    colour="#38bdf8"
                                                    label="Reliability"
                                                />
                                            </div>
                                        </div>

                                        {/* Tips */}
                                        <div className="glass-card p-6 relative">
                                            <div className="glass-highlight" />
                                            <h3 className="font-bold mb-4 text-slate-200">Performance Tips</h3>
                                            <div className="space-y-3">
                                                {perf.my_stats.on_time_percentage < perf.city_avg.on_time_percentage && (
                                                    <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                                        <span className="material-symbols-outlined text-yellow-400 text-sm">warning</span>
                                                        <p className="text-sm text-slate-300">Your on-time rate is below city average. Consider planning routes in advance using the dispatcher map.</p>
                                                    </div>
                                                )}
                                                {perf.my_stats.avg_completion_minutes > perf.city_avg.avg_completion_minutes && (
                                                    <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                        <span className="material-symbols-outlined text-blue-400 text-sm">info</span>
                                                        <p className="text-sm text-slate-300">Your average completion time is {(perf.my_stats.avg_completion_minutes - perf.city_avg.avg_completion_minutes).toFixed(0)} min above average. Optimize your pickup and delivery routes.</p>
                                                    </div>
                                                )}
                                                {perf.comparison.deliveries_vs_avg > 0 && (
                                                    <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                                        <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                                                        <p className="text-sm text-slate-300">You've completed {perf.comparison.deliveries_vs_avg.toFixed(0)} more deliveries than the city average. Excellent work!</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── FOOD SAFETY SCANNER (#1) ── */}
                        {activeTab === "food-scanner" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">📷 Food Safety Scanner</h1>
                                    <p className="text-slate-400 mt-1">Photograph the donation before pickup — AI assesses freshness, spoilage risk, and portion count instantly.</p>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Upload panel */}
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold mb-4">Upload Food Photo</h3>
                                        <label className="block w-full cursor-pointer">
                                            <div className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-48 transition-colors ${
                                                scanPreview ? "border-blue-500/40 bg-blue-500/5" : "border-white/10 hover:border-white/20 bg-slate-800/30"
                                            }`}>
                                                {scanPreview ? (
                                                    <img src={scanPreview} alt="Food preview" className="h-full w-full object-cover rounded-xl" />
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-4xl text-slate-500 mb-2">add_photo_alternate</span>
                                                        <p className="text-sm text-slate-400">Click to upload food photo</p>
                                                        <p className="text-xs text-slate-500 mt-1">JPG, PNG, WEBP</p>
                                                    </>
                                                )}
                                            </div>
                                            <input type="file" accept="image/*" className="hidden" onChange={handleScanImage} />
                                        </label>
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={runFoodScan}
                                                disabled={!scanFile || scanLoading}
                                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                                            >
                                                {scanLoading ? (
                                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning…</>
                                                ) : (
                                                    <><span className="material-symbols-outlined text-sm">document_scanner</span> Analyse Food</>
                                                )}
                                            </button>
                                            {scanPreview && (
                                                <button onClick={() => { setScanPreview(null); setScanFile(null); setScanResult(null); }}
                                                    className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 transition-all">
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Results panel */}
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold mb-4">Safety Assessment</h3>
                                        {!scanResult && !scanLoading && (
                                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                                <span className="material-symbols-outlined text-4xl mb-2">science</span>
                                                <p className="text-sm">Upload an image and click Analyse</p>
                                            </div>
                                        )}
                                        {scanLoading && (
                                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
                                                <p className="text-sm">AI is analysing the food…</p>
                                            </div>
                                        )}
                                        {scanResult && (
                                            <div className="space-y-4">
                                                {/* Risk badge */}
                                                <div className={`flex items-center gap-3 p-4 rounded-xl ${
                                                    scanResult.spoilage_risk === "HIGH" ? "bg-red-500/15 border border-red-500/30" :
                                                    scanResult.spoilage_risk === "MEDIUM" ? "bg-yellow-500/15 border border-yellow-500/30" :
                                                    "bg-green-500/15 border border-green-500/30"
                                                }`}>
                                                    <span className={`material-symbols-outlined text-2xl ${
                                                        scanResult.spoilage_risk === "HIGH" ? "text-red-400" :
                                                        scanResult.spoilage_risk === "MEDIUM" ? "text-yellow-400" : "text-green-400"
                                                    }`}>
                                                        {scanResult.safe_to_redistribute ? "check_circle" : "warning"}
                                                    </span>
                                                    <div>
                                                        <p className="font-bold">{scanResult.safe_to_redistribute ? "Safe to Redistribute" : "Do NOT Redistribute"}</p>
                                                        <p className="text-sm text-slate-400">Spoilage Risk: <span className={`font-bold ${
                                                            scanResult.spoilage_risk === "HIGH" ? "text-red-400" :
                                                            scanResult.spoilage_risk === "MEDIUM" ? "text-yellow-400" : "text-green-400"
                                                        }`}>{scanResult.spoilage_risk}</span></p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    {[
                                                        { label: "Identified Food", value: scanResult.food_type, colour: "#38bdf8" },
                                                        { label: "Freshness Window", value: `~${scanResult.freshness_window_hours}h`, colour: "#34d399" },
                                                        { label: "Portion Estimate", value: `~${scanResult.portion_count_estimate} servings`, colour: "#a78bfa" },
                                                    ].map(f => (
                                                        <div key={f.label} className="p-3 bg-slate-800/40 rounded-xl">
                                                            <p className="text-xs text-slate-400 mb-1">{f.label}</p>
                                                            <p className="font-bold" style={{ color: f.colour }}>{f.value}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {scanResult.notes && (
                                                    <div className="p-3 bg-slate-800/40 rounded-xl">
                                                        <p className="text-xs text-slate-400 mb-1">AI Notes</p>
                                                        <p className="text-sm text-slate-300">{scanResult.notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── TASKS ── */}
                        {activeTab === "tasks" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">🚚 My Tasks</h1>
                                    <p className="text-slate-400 mt-1">Active and completed deliveries</p>
                                </header>

                                <div className="space-y-3">
                                    {myTasks.length === 0 ? (
                                        <div className="glass-card p-8 text-center text-slate-400">
                                            No tasks assigned yet. Make sure you are online to receive assignments.
                                        </div>
                                    ) : (
                                        myTasks.map((t: any) => (
                                            <div key={t.id} className="glass-card p-5 relative flex items-center justify-between">
                                                <div className="glass-highlight" />
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-blue-400">local_shipping</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{t.food_type} — {t.quantity_kg}kg</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">From: {t.pickup_address}</p>
                                                        <p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${t.status === "DELIVERED" || t.status === "COMPLETED" ? "bg-green-500/20 text-green-400" : t.status === "IN_TRANSIT" || t.status === "PICKED_UP" ? "bg-blue-500/20 text-blue-400" : t.status === "CANCELLED" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                                    {t.status}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
