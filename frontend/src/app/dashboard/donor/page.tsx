"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/toast-context";
import { apiService } from "../../../lib/api-service";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Credits {
    total_points: number;
    base_points: number;
    streak_weeks: number;
    streak_bonus: number;
    tier: { name: string; icon: string; next_tier: string | null; points_to_next: number };
    total_deliveries: number;
    total_kg_contributed: number;
}
interface CO2Data {
    total_food_kg_redistributed: number;
    co2_saved_kg: number;
    co2_saved_tonnes: number;
    trees_equivalent_per_year: number;
    car_km_equivalent: number;
    monthly_co2_kg: Record<string, number>;
}
interface Suggestions {
    archetype: string;
    description: string;
    suggestions: string[];
    donor_stats: {
        avg_quantity_kg: number;
        cancellation_rate_pct: number;
        avg_hours_before_expiry: number;
        donations_per_month: number;
    };
}
interface TaxReport {
    donor_name: string;
    organization: string;
    financial_year: string;
    donations_count: number;
    total_kg_donated: number;
    financials: {
        estimated_donation_value_inr: number;
        tax_deduction_eligible_inr: number;
        estimated_tax_saving_inr: number;
        estimated_gst_credit_inr: number;
    };
    legal_basis: string;
    disclaimer: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TIER_COLOURS: Record<string, string> = {
    Platinum: "#e2e8f0",
    Gold: "#fbbf24",
    Silver: "#94a3b8",
    Bronze: "#cd7f32",
};

function StatPill({ label, value, colour = "#a78bfa" }: { label: string; value: string | number; colour?: string }) {
    return (
        <div className="glass-card p-5 relative flex-1 min-w-[140px]">
            <div className="glass-highlight" />
            <p style={{ color: colour, fontSize: 26, fontWeight: 700 }}>{value}</p>
            <p className="text-slate-400 text-sm mt-1">{label}</p>
        </div>
    );
}

function BarRow({ label, value, max, colour }: { label: string; value: number; max: number; colour: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300">{label}</span>
                <span style={{ color: colour }}>{value.toFixed(1)} kg</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div style={{ width: `${pct}%`, background: colour, height: "100%", borderRadius: "9999px", transition: "width 0.6s ease" }} />
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DonorDashboard() {
    const { user, logout } = useAuth();
    const { addToast } = useToast();
    type TabType = "overview" | "credits" | "co2" | "suggestions" | "tax" | "ai-donate" | "ai-impact";
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [donorId, setDonorId] = useState<string | null>(null);
    const [credits, setCredits] = useState<Credits | null>(null);
    const [co2, setCO2] = useState<CO2Data | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
    const [taxReport, setTaxReport] = useState<TaxReport | null>(null);
    const [donations, setDonations] = useState<any[]>([]);
    const [selectedFY, setSelectedFY] = useState("2025-26");
    const [isLoading, setIsLoading] = useState(true);
    const [taxLoading, setTaxLoading] = useState(false);

    // ── AI Donate state (#2 Conversational Donation) ─────────
    const [aiDonateText, setAiDonateText] = useState("");
    const [aiDonateResult, setAiDonateResult] = useState<any>(null);
    const [aiDonateLoading, setAiDonateLoading] = useState(false);
    const [aiDonateSubmitting, setAiDonateSubmitting] = useState(false);

    // ── AI Impact Story state (#8) ────────────────────────────
    const [selectedDonation, setSelectedDonation] = useState<any>(null);
    const [impactStory, setImpactStory] = useState<any>(null);
    const [impactLoading, setImpactLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const profileRes = await apiService.getDonorProfile();
        if (!profileRes.data) {
            addToast({ type: "error", title: "Error", message: "Could not load donor profile" });
            setIsLoading(false);
            return;
        }
        const id: string = profileRes.data.id;
        setDonorId(id);

        const [creditsRes, co2Res, suggestRes, donationsRes] = await Promise.allSettled([
            apiService.getAnalyticsCredits(id),
            apiService.getAnalyticsCO2(id),
            apiService.getAnalyticsSuggestions(id),
            apiService.getDonations(),
        ]);

        if (creditsRes.status === "fulfilled" && creditsRes.value.data) setCredits(creditsRes.value.data);
        if (co2Res.status === "fulfilled" && co2Res.value.data) setCO2(co2Res.value.data);
        if (suggestRes.status === "fulfilled" && suggestRes.value.data) setSuggestions(suggestRes.value.data);
        if (donationsRes.status === "fulfilled" && donationsRes.value.data) setDonations(donationsRes.value.data);

        setIsLoading(false);
    };

    const loadTaxReport = async () => {
        if (!donorId) return;
        setTaxLoading(true);
        const res = await apiService.getAnalyticsTaxReport(donorId, selectedFY);
        if (res.data) setTaxReport(res.data);
        else addToast({ type: "error", title: "Error", message: res.error || "Failed to load tax report" });
        setTaxLoading(false);
    };

    const printReport = () => window.print();

    const parseAiDonation = async () => {
        if (!aiDonateText.trim()) return;
        setAiDonateLoading(true);
        setAiDonateResult(null);
        try {
            const res = await fetch("/api/ai/parse-donation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: aiDonateText }),
            });
            const data = await res.json();
            if (data.error) addToast({ type: "error", title: "AI Error", message: data.error });
            else setAiDonateResult(data);
        } catch {
            addToast({ type: "error", title: "Error", message: "AI service unavailable" });
        }
        setAiDonateLoading(false);
    };

    const submitAiDonation = async () => {
        if (!aiDonateResult) return;
        setAiDonateSubmitting(true);
        const expiry = new Date(Date.now() + (aiDonateResult.expiry_hours || 4) * 3600_000).toISOString();
        const res = await apiService.createDonation({
            food_type: aiDonateResult.food_type,
            quantity_kg: aiDonateResult.quantity_kg,
            pickup_lat: 12.9716,
            pickup_lng: 77.5946,
            expiry_time: expiry,
            description: aiDonateResult.description,
        });
        if (!res.error) {
            addToast({ type: "success", title: "Donation Created!", message: `${aiDonateResult.food_type} — ${aiDonateResult.quantity_kg}kg listed.` });
            setAiDonateText("");
            setAiDonateResult(null);
            loadData();
        } else {
            addToast({ type: "error", title: "Submit Failed", message: res.error });
        }
        setAiDonateSubmitting(false);
    };

    const generateImpactStory = async (donation: any) => {
        setSelectedDonation(donation);
        setImpactStory(null);
        setImpactLoading(true);
        try {
            const res = await fetch("/api/ai/impact-story", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    food_type: donation.food_type,
                    quantity_kg: donation.quantity_kg ?? donation.quantity,
                    donor_name: user?.name,
                    tier: credits?.tier?.name,
                    co2_saved_kg: co2 ? co2.co2_saved_kg : undefined,
                }),
            });
            const data = await res.json();
            if (data.error) addToast({ type: "error", title: "AI Error", message: data.error });
            else setImpactStory(data);
        } catch {
            addToast({ type: "error", title: "Error", message: "AI service unavailable" });
        }
        setImpactLoading(false);
    };

    const navItems = [
        { id: "overview", label: "Overview", icon: "dashboard" },
        { id: "ai-donate", label: "AI Donate", icon: "chat_bubble" },
        { id: "ai-impact", label: "Impact Story", icon: "auto_stories" },
        { id: "credits", label: "Sustainability Credits", icon: "emoji_events" },
        { id: "co2", label: "CO₂ Impact", icon: "eco" },
        { id: "suggestions", label: "Suggestions", icon: "lightbulb" },
        { id: "tax", label: "Tax Report", icon: "receipt_long" },
    ];

    const monthlyEntries = co2 ? Object.entries(co2.monthly_co2_kg).sort() : [];
    const maxMonthly = monthlyEntries.length ? Math.max(...monthlyEntries.map(([, v]) => v)) : 1;

    return (
        <div className="min-h-screen text-white">
            {/* Background */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]" />
            <div className="bg-nebula-parallax" />

            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 glass-card rounded-none border-r border-white/10 z-40 p-6 flex flex-col">
                <div className="glass-highlight" />
                <Link href="/" className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.4)]">
                        <span className="material-symbols-outlined text-white">volunteer_activism</span>
                    </div>
                    <span className="text-xl font-bold">Donor Hub</span>
                </Link>

                {user && (
                    <div className="mb-6 p-3 bg-slate-800/30 rounded-xl">
                        <p className="font-medium text-sm">{user.name || user.full_name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                        <span className="mt-1 inline-block text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Donor</span>
                    </div>
                )}

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as TabType)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeTab === item.id ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
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

            {/* Main Content */}
            <main className="ml-64 p-8 relative z-10">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* ── OVERVIEW ── */}
                        {activeTab === "overview" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(" ")[0] || "Donor"} 👋</h1>
                                    <p className="text-slate-400 mt-1">Your food rescue impact at a glance</p>
                                </header>
                                <div className="flex flex-wrap gap-4 mb-8">
                                    <StatPill label="Total Donations" value={donations.length} colour="#a78bfa" />
                                    <StatPill label="Deliveries Completed" value={credits?.total_deliveries ?? 0} colour="#34d399" />
                                    <StatPill label="KG Contributed" value={`${credits?.total_kg_contributed ?? 0} kg`} colour="#38bdf8" />
                                    <StatPill label="Points Earned" value={(credits?.total_points ?? 0).toLocaleString()} colour="#fbbf24" />
                                    <StatPill label="CO₂ Saved" value={co2 ? `${co2.co2_saved_kg} kg` : "—"} colour="#4ade80" />
                                </div>

                                {/* Tier badge */}
                                {credits && (
                                    <div className="glass-card p-6 relative mb-6">
                                        <div className="glass-highlight" />
                                        <div className="flex items-center gap-4">
                                            <div className="text-5xl">{credits.tier.icon}</div>
                                            <div>
                                                <p className="text-lg font-bold" style={{ color: TIER_COLOURS[credits.tier.name] || "#e2e8f0" }}>
                                                    {credits.tier.name} Tier
                                                </p>
                                                <p className="text-slate-400 text-sm">{credits.total_points.toLocaleString()} points · {credits.streak_weeks} week streak</p>
                                                {credits.tier.next_tier && (
                                                    <>
                                                        <div className="mt-2 h-2 bg-slate-700 rounded-full w-64 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                                                                style={{ width: `${Math.min(100, ((credits.total_points) / (credits.total_points + credits.tier.points_to_next)) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1">{credits.tier.points_to_next} pts to {credits.tier.next_tier}</p>
                                                    </>
                                                )}
                                            </div>
                                            <div className="ml-auto text-right">
                                                <p className="text-3xl font-bold text-emerald-400">{credits.total_points.toLocaleString()}</p>
                                                <p className="text-slate-400 text-sm">Total Points</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Recent donations */}
                                <div className="glass-card p-6 relative">
                                    <div className="glass-highlight" />
                                    <h2 className="text-lg font-bold mb-4">Recent Donations</h2>
                                    {donations.length === 0 ? (
                                        <p className="text-slate-400 text-center py-8">No donations yet</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {donations.slice(0, 6).map((d: any) => (
                                                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="material-symbols-outlined text-emerald-400">restaurant</span>
                                                        <div>
                                                            <p className="font-medium text-sm">{d.food_type}</p>
                                                            <p className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-sm">{d.quantity_kg ?? d.quantity}kg</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === "COMPLETED" || d.status === "DELIVERED" ? "bg-green-500/20 text-green-400" : d.status === "CANCELLED" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                                                            {d.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── CREDITS (US5) ── */}
                        {activeTab === "credits" && credits && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">🏆 Sustainability Credits</h1>
                                    <p className="text-slate-400 mt-1">US5 — Gamification for every successful redistribution</p>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    {/* Tier card */}
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <div className="text-center">
                                            <div className="text-6xl mb-3">{credits.tier.icon}</div>
                                            <h2 className="text-2xl font-bold" style={{ color: TIER_COLOURS[credits.tier.name] || "#e2e8f0" }}>{credits.tier.name}</h2>
                                            <p className="text-slate-400 text-sm mt-1">Current Tier</p>
                                            {credits.tier.next_tier && (
                                                <div className="mt-4">
                                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                                        <span>Progress to {credits.tier.next_tier}</span>
                                                        <span>{credits.tier.points_to_next} pts remaining</span>
                                                    </div>
                                                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                                                            style={{ width: `${Math.min(100, (credits.total_points / (credits.total_points + credits.tier.points_to_next)) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Points breakdown */}
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold mb-4 text-slate-300">Points Breakdown</h3>
                                        <div className="space-y-3">
                                            {[
                                                { label: "Base Points (10 pts/kg)", value: credits.base_points, colour: "#34d399" },
                                                { label: `Streak Bonus (${credits.streak_weeks} wk × 50)`, value: credits.streak_bonus, colour: "#fbbf24" },
                                            ].map((r) => (
                                                <div key={r.label}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-slate-400">{r.label}</span>
                                                        <span style={{ color: r.colour }} className="font-bold">{r.value.toLocaleString()} pts</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                        <div style={{ width: `${(r.value / Math.max(credits.total_points, 1)) * 100}%`, background: r.colour }} className="h-full rounded-full transition-all duration-700" />
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="border-t border-white/10 pt-3 flex justify-between">
                                                <span className="font-bold">Total</span>
                                                <span className="text-2xl font-bold text-emerald-400">{credits.total_points.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex flex-wrap gap-4">
                                    <StatPill label="Deliveries" value={credits.total_deliveries} colour="#38bdf8" />
                                    <StatPill label="KG Contributed" value={`${credits.total_kg_contributed} kg`} colour="#34d399" />
                                    <StatPill label="Streak" value={`${credits.streak_weeks} weeks`} colour="#fbbf24" />
                                    <StatPill label="Base Points" value={credits.base_points.toLocaleString()} colour="#a78bfa" />
                                    <StatPill label="Streak Bonus" value={credits.streak_bonus.toLocaleString()} colour="#f97316" />
                                </div>

                                {/* All tiers info */}
                                <div className="glass-card p-6 relative mt-6">
                                    <div className="glass-highlight" />
                                    <h3 className="font-bold mb-4">Tier Milestones</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { name: "Bronze", icon: "🥉", range: "0 – 499 pts", colour: "#cd7f32" },
                                            { name: "Silver", icon: "🥈", range: "500 – 1,999 pts", colour: "#94a3b8" },
                                            { name: "Gold", icon: "🥇", range: "2,000 – 4,999 pts", colour: "#fbbf24" },
                                            { name: "Platinum", icon: "🏆", range: "5,000+ pts", colour: "#e2e8f0" },
                                        ].map((t) => (
                                            <div key={t.name} className={`p-4 rounded-xl border text-center ${credits.tier.name === t.name ? "border-white/30 bg-white/5" : "border-white/5"}`}>
                                                <div className="text-3xl mb-1">{t.icon}</div>
                                                <p className="font-bold text-sm" style={{ color: t.colour }}>{t.name}</p>
                                                <p className="text-xs text-slate-500">{t.range}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── CO2 IMPACT (US6) ── */}
                        {activeTab === "co2" && co2 && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">🌱 CO₂ Reduction Metrics</h1>
                                    <p className="text-slate-400 mt-1">US6 — Your environmental impact via food rescue</p>
                                </header>

                                <div className="flex flex-wrap gap-4 mb-8">
                                    <StatPill label="Food Redistributed" value={`${co2.total_food_kg_redistributed} kg`} colour="#34d399" />
                                    <StatPill label="CO₂ Saved" value={`${co2.co2_saved_kg} kg`} colour="#4ade80" />
                                    <StatPill label="CO₂ in Tonnes" value={`${co2.co2_saved_tonnes} t`} colour="#a78bfa" />
                                    <StatPill label="Trees Equivalent / yr" value={`🌳 ${co2.trees_equivalent_per_year}`} colour="#86efac" />
                                    <StatPill label="Car Km Equivalent" value={`🚗 ${co2.car_km_equivalent}`} colour="#38bdf8" />
                                </div>

                                {/* Methodology card */}
                                <div className="glass-card p-4 relative mb-6 border-l-4 border-emerald-500">
                                    <div className="glass-highlight" />
                                    <p className="text-sm text-slate-300">
                                        <span className="text-emerald-400 font-semibold">Methodology: </span>
                                        IPCC standard — 2.5 kg CO₂e saved per kg food waste prevented.
                                        Tree absorption: 21 kg CO₂/year. Car emission: 210 g CO₂/km.
                                    </p>
                                </div>

                                {/* Monthly chart */}
                                {monthlyEntries.length > 0 && (
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold mb-4">Monthly CO₂ Savings (kg)</h3>
                                        <div className="space-y-2">
                                            {monthlyEntries.map(([month, val]) => (
                                                <BarRow key={month} label={month} value={val} max={maxMonthly} colour="#4ade80" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SUGGESTIONS (US3) ── */}
                        {activeTab === "suggestions" && suggestions && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">💡 Personalized Suggestions</h1>
                                    <p className="text-slate-400 mt-1">US3 — K-Means clustering based waste-reduction advice</p>
                                </header>

                                {/* Archetype */}
                                <div className="glass-card p-6 relative mb-6">
                                    <div className="glass-highlight" />
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-violet-400">person_pin</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-violet-300">{suggestions.archetype}</h2>
                                            <p className="text-slate-400 mt-1">{suggestions.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action items */}
                                <div className="glass-card p-6 relative mb-6">
                                    <div className="glass-highlight" />
                                    <h3 className="font-bold mb-4 text-slate-200">Action Items</h3>
                                    <div className="space-y-3">
                                        {suggestions.suggestions.map((s, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-xl">
                                                <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span className="text-emerald-400 text-xs font-bold">{i + 1}</span>
                                                </div>
                                                <p className="text-slate-300 text-sm">{s}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Donor stats */}
                                {suggestions.donor_stats && (
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold mb-4 text-slate-200">Your Behavioral Profile</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { label: "Avg Quantity / Task", value: `${suggestions.donor_stats.avg_quantity_kg} kg`, colour: "#38bdf8" },
                                                { label: "Cancellation Rate", value: `${suggestions.donor_stats.cancellation_rate_pct}%`, colour: "#f87171" },
                                                { label: "Avg Hrs Before Expiry", value: `${suggestions.donor_stats.avg_hours_before_expiry} hrs`, colour: "#fbbf24" },
                                                { label: "Donations / Month", value: suggestions.donor_stats.donations_per_month, colour: "#34d399" },
                                            ].map((s) => (
                                                <div key={s.label} className="text-center p-4 bg-slate-800/30 rounded-xl">
                                                    <p className="text-xl font-bold" style={{ color: s.colour }}>{s.value}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── AI DONATE (#2 Conversational Donation) ── */}
                        {activeTab === "ai-donate" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">🤖 AI Donate</h1>
                                    <p className="text-slate-400 mt-1">Describe your donation in plain language — AI extracts the details instantly. No forms.</p>
                                </header>

                                <div className="glass-card p-6 relative mb-6">
                                    <div className="glass-highlight" />
                                    <p className="text-sm text-slate-400 mb-3">
                                        Example: <em>"About 20kg of leftover biryani and garlic bread from tonight's wedding, need pickup in 90 minutes"</em>
                                    </p>
                                    <textarea
                                        value={aiDonateText}
                                        onChange={e => setAiDonateText(e.target.value)}
                                        placeholder="Describe your donation here…"
                                        rows={4}
                                        className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none text-sm"
                                    />
                                    <button
                                        onClick={parseAiDonation}
                                        disabled={aiDonateLoading || !aiDonateText.trim()}
                                        className="mt-3 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-medium transition-all flex items-center gap-2"
                                    >
                                        {aiDonateLoading ? (
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Parsing…</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-sm">auto_fix_high</span> Parse with AI</>
                                        )}
                                    </button>
                                </div>

                                {aiDonateResult && (
                                    <div className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                                            <h3 className="font-bold text-lg">AI Extracted Fields</h3>
                                            <span className="ml-auto text-sm text-slate-400">Confidence: <span className="font-bold text-emerald-400">{Math.round((aiDonateResult.confidence || 0.9) * 100)}%</span></span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                            {[
                                                { label: "Food Type", value: aiDonateResult.food_type, icon: "restaurant", colour: "#34d399" },
                                                { label: "Quantity (kg)", value: `${aiDonateResult.quantity_kg} kg`, icon: "scale", colour: "#38bdf8" },
                                                { label: "Urgency", value: aiDonateResult.urgency, icon: "timer", colour: aiDonateResult.urgency === "HIGH" ? "#f87171" : aiDonateResult.urgency === "MEDIUM" ? "#fbbf24" : "#34d399" },
                                                { label: "Expires In", value: `~${aiDonateResult.expiry_hours}h`, icon: "hourglass_bottom", colour: "#a78bfa" },
                                            ].map(f => (
                                                <div key={f.label} className="p-4 bg-slate-800/40 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="material-symbols-outlined text-sm" style={{ color: f.colour }}>{f.icon}</span>
                                                        <p className="text-xs text-slate-400">{f.label}</p>
                                                    </div>
                                                    <p className="font-bold" style={{ color: f.colour }}>{f.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {aiDonateResult.notes && (
                                            <div className="p-3 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300">
                                                <span className="font-semibold">AI Note: </span>{aiDonateResult.notes}
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 mb-3">Description: {aiDonateResult.description}</p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={submitAiDonation}
                                                disabled={aiDonateSubmitting}
                                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl font-medium transition-all flex items-center gap-2"
                                            >
                                                {aiDonateSubmitting ? "Submitting…" : "✓ Confirm & Create Donation"}
                                            </button>
                                            <button onClick={() => setAiDonateResult(null)} className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-all">
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── IMPACT STORY (#8) ── */}
                        {activeTab === "ai-impact" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">🌱 Impact Story Generator</h1>
                                    <p className="text-slate-400 mt-1">Select a completed donation — AI crafts a shareable story card with real data.</p>
                                </header>

                                <div className="glass-card p-6 relative mb-6">
                                    <div className="glass-highlight" />
                                    <h3 className="font-bold mb-4">Select a Completed Donation</h3>
                                    <div className="space-y-3">
                                        {donations.filter(d => d.status === "COMPLETED" || d.status === "DELIVERED").length === 0 && (
                                            <p className="text-slate-400 text-sm">No completed donations yet.</p>
                                        )}
                                        {donations.filter(d => d.status === "COMPLETED" || d.status === "DELIVERED").map((d: any) => (
                                            <button
                                                key={d.id}
                                                onClick={() => generateImpactStory(d)}
                                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${selectedDonation?.id === d.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 bg-slate-800/30 hover:border-white/10"}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-outlined text-emerald-400">restaurant</span>
                                                    <div>
                                                        <p className="font-medium text-sm">{d.food_type}</p>
                                                        <p className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-sm">{d.quantity_kg ?? d.quantity}kg</span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{d.status}</span>
                                                    <span className="material-symbols-outlined text-sm text-slate-400">auto_stories</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {impactLoading && (
                                    <div className="flex items-center gap-3 text-slate-400 mb-6">
                                        <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                        Generating your impact story…
                                    </div>
                                )}

                                {impactStory && selectedDonation && (
                                    <div className="glass-card relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(6,78,59,0.4) 0%, rgba(15,23,42,0.6) 60%, rgba(30,27,75,0.4) 100%)", border: "1px solid rgba(52,211,153,0.3)" }}>
                                        <div className="glass-highlight" />
                                        {/* Story card */}
                                        <div className="p-8">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-emerald-400">volunteer_activism</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-emerald-300">{user?.name || "Donor"}</p>
                                                    <p className="text-xs text-slate-400">{credits?.tier?.icon} {credits?.tier?.name} Tier</p>
                                                </div>
                                            </div>

                                            <h2 className="text-2xl font-bold text-white mb-3">{impactStory.headline}</h2>
                                            <p className="text-slate-300 text-base leading-relaxed mb-5">{impactStory.story}</p>

                                            {/* Stats row */}
                                            <div className="flex flex-wrap gap-4 mb-6">
                                                {[
                                                    { label: "Food Rescued", value: `${selectedDonation.quantity_kg ?? selectedDonation.quantity}kg`, icon: "restaurant", colour: "#34d399" },
                                                    { label: "Meals Provided", value: `~${impactStory.estimated_meals}`, icon: "group", colour: "#38bdf8" },
                                                    { label: "Trees Equivalent", value: `🌳 ${impactStory.trees_equiv}`, icon: "park", colour: "#86efac" },
                                                ].map(s => (
                                                    <div key={s.label} className="bg-black/20 rounded-xl px-4 py-3 text-center min-w-[100px]">
                                                        <p className="text-xl font-bold" style={{ color: s.colour }}>{s.value}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <p className="text-sm text-slate-400 italic mb-4">{impactStory.stats_line}</p>

                                            {impactStory.hashtags && (
                                                <div className="flex flex-wrap gap-2">
                                                    {impactStory.hashtags.map((tag: string, i: number) => (
                                                        <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full">{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── TAX REPORT (US13) ── */}
                        {activeTab === "tax" && (
                            <div>
                                <header className="mb-8">
                                    <h1 className="text-3xl font-bold">🧾 Tax Benefit Report</h1>
                                    <p className="text-slate-400 mt-1">US13 — Cost saving & tax benefit analysis (India: Section 80GGA)</p>
                                </header>

                                {/* Financial Year selector */}
                                <div className="glass-card p-6 relative mb-6">
                                    <div className="glass-highlight" />
                                    <div className="flex items-end gap-4 flex-wrap">
                                        <div>
                                            <label className="block text-sm text-slate-400 mb-2">Financial Year</label>
                                            <select
                                                value={selectedFY}
                                                onChange={(e) => setSelectedFY(e.target.value)}
                                                aria-label="Financial Year"
                                                className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="2023-24">2023-24</option>
                                                <option value="2024-25">2024-25</option>
                                                <option value="2025-26">2025-26</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={loadTaxReport}
                                            disabled={taxLoading}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                                        >
                                            {taxLoading ? "Generating…" : "Generate Report"}
                                        </button>
                                        {taxReport && (
                                            <button onClick={printReport} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">print</span>
                                                Print / Save PDF
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {taxReport && (
                                    <div className="space-y-4">
                                        {/* Summary */}
                                        <div className="glass-card p-6 relative">
                                            <div className="glass-highlight" />
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h2 className="text-xl font-bold">{taxReport.donor_name}</h2>
                                                    <p className="text-slate-400 text-sm">{taxReport.organization}</p>
                                                </div>
                                                <span className="text-sm bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full">FY {taxReport.financial_year}</span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <StatPill label="Donations" value={taxReport.donations_count} colour="#38bdf8" />
                                                <StatPill label="Total KG Donated" value={`${taxReport.total_kg_donated} kg`} colour="#34d399" />
                                                <StatPill label="Est. Donation Value" value={`₹${taxReport.financials.estimated_donation_value_inr.toLocaleString()}`} colour="#fbbf24" />
                                                <StatPill label="Est. Tax Saving" value={`₹${taxReport.financials.estimated_tax_saving_inr.toLocaleString()}`} colour="#a78bfa" />
                                            </div>
                                        </div>

                                        {/* Financial breakdown */}
                                        <div className="glass-card p-6 relative">
                                            <div className="glass-highlight" />
                                            <h3 className="font-bold mb-4">Financial Breakdown</h3>
                                            <table className="w-full text-sm">
                                                <tbody className="divide-y divide-white/5">
                                                    {[
                                                        { label: "Estimated Donation Value", value: taxReport.financials.estimated_donation_value_inr, note: "₹50/kg avg prepared food" },
                                                        { label: "Tax Deduction Eligible (100%)", value: taxReport.financials.tax_deduction_eligible_inr, note: "Section 80GGA" },
                                                        { label: "Estimated Tax Saving (30%)", value: taxReport.financials.estimated_tax_saving_inr, note: "At 30% bracket" },
                                                        { label: "Estimated GST Credit (5%)", value: taxReport.financials.estimated_gst_credit_inr, note: "Food sector input credit" },
                                                    ].map((r) => (
                                                        <tr key={r.label}>
                                                            <td className="py-3 text-slate-400">{r.label}</td>
                                                            <td className="py-3 text-center text-slate-500 text-xs">{r.note}</td>
                                                            <td className="py-3 text-right font-bold text-emerald-400">₹{r.value.toLocaleString("en-IN")}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Legal basis */}
                                        <div className="glass-card p-4 relative border-l-4 border-yellow-500">
                                            <div className="glass-highlight" />
                                            <p className="text-sm text-yellow-300 font-medium">{taxReport.legal_basis}</p>
                                            <p className="text-xs text-slate-400 mt-1">{taxReport.disclaimer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
