"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiService } from "../../../lib/api-service";
import { useWebSocket, WebSocketMessage } from "../../../lib/websocket-service";
import { useToast } from "../../../lib/toast-context";
import { useAuth } from "../../../lib/auth-context";

interface Task {
    id: string;
    food_type: string;
    quantity_kg: number;
    status: string;
    pickup_address: string;
    created_at: string;
}

// ─── Analytics helpers ────────────────────────────────────────────────────────
function AnalyticsPill({ label, value, colour = "#a78bfa" }: { label: string; value: string | number; colour?: string }) {
    return (
        <div className="glass-card p-4 relative flex-1 min-w-[130px]">
            <div className="glass-highlight" />
            <p style={{ color: colour, fontSize: 22, fontWeight: 700 }}>{value}</p>
            <p className="text-slate-400 text-xs mt-1">{label}</p>
        </div>
    );
}

function NutrBar({ label, value, max, unit, colour }: { label: string; value: number; max: number; unit: string; colour: string }) {
    const colourMap: Record<string, string> = { orange: "#fb923c", blue: "#60a5fa", yellow: "#facc15", red: "#f87171", green: "#4ade80" };
    const cssColour = colourMap[colour] ?? colour;
    const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
    return (
        <div className="mb-2">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{label}</span>
                <span style={{ color: cssColour }}>{typeof value === "number" ? value.toLocaleString() : value} {unit}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div style={{ width: `${pct}%`, background: cssColour }} className="h-full rounded-full transition-all duration-700" />
            </div>
        </div>
    );
}

export default function NgoDashboard() {
    const { user, logout } = useAuth();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [claimedTasks, setClaimedTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"available" | "claimed" | "analytics" | "meal-planner" | "grant-writer">("available");

    // ── Analytics state ─────────────────────────────────────────
    const [ngoId, setNgoId] = useState<string | null>(null);
    const [mealsReport, setMealsReport] = useState<any>(null);
    const [nutrition, setNutrition] = useState<any>(null);
    const [demandForecast, setDemandForecast] = useState<any>(null);
    const [sentiment, setSentiment] = useState<any>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [mealsStart, setMealsStart] = useState("");
    const [mealsEnd, setMealsEnd] = useState("");

    // ── Meal Planner state (#5) ───────────────────────────────
    const [mealPlan, setMealPlan] = useState<any>(null);
    const [mealPlanLoading, setMealPlanLoading] = useState(false);
    const [mpIngredients, setMpIngredients] = useState([
        { food_type: "Rice", quantity_kg: 30 },
        { food_type: "Dal", quantity_kg: 12 },
        { food_type: "Spinach", quantity_kg: 6 },
    ]);
    const [mpBeneficiaries, setMpBeneficiaries] = useState(80);
    const [mpRestrictions, setMpRestrictions] = useState("");

    // ── Grant Writer state (#10) ──────────────────────────────
    const [grantDraft, setGrantDraft] = useState<any>(null);
    const [grantLoading, setGrantLoading] = useState(false);
    const [grantFunder, setGrantFunder] = useState("Tata Trust");
    const [grantProgram, setGrantProgram] = useState("Hunger Relief");
    const [ngoName, setNgoName] = useState("");

    // Real-time updates
    useWebSocket(["task_created", "donation_claimed"], (message: WebSocketMessage) => {
        if (message.type === "task_created") {
            addToast({
                type: "info",
                title: "New Donation Available",
                message: `${message.payload.food_type} - ${message.payload.quantity_kg ?? message.payload.quantity}kg`,
            });
            fetchTasks();
        }
        if (message.type === "donation_claimed") {
            addToast({
                type: "success",
                title: "Donation Claimed",
                message: "Task added to your claims",
            });
            fetchTasks();
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        fetchNgoProfile();
    }, []);

    const fetchNgoProfile = async () => {
        const res = await apiService.getNgoProfile();
        if (res.data?.id) {
            const id = res.data.id;
            setNgoId(id);
            setNgoName(res.data.organization_name || res.data.name || "");
            // Pre-load nutrition and demand forecast in background
            const [nutritionRes, demandRes, sentimentRes] = await Promise.allSettled([
                apiService.getAnalyticsNgoNutrition(id),
                apiService.getAnalyticsDemandForecast(id),
                apiService.getAnalyticsNgoSentiment(id),
            ]);
            if (nutritionRes.status === "fulfilled" && nutritionRes.value.data) setNutrition(nutritionRes.value.data);
            if (demandRes.status === "fulfilled" && demandRes.value.data) setDemandForecast(demandRes.value.data);
            if (sentimentRes.status === "fulfilled" && sentimentRes.value.data) setSentiment(sentimentRes.value.data);
        }
    };

    const loadMealsReport = async () => {
        if (!ngoId) return;
        setAnalyticsLoading(true);
        const res = await apiService.getAnalyticsNgoMeals(ngoId, mealsStart || undefined, mealsEnd || undefined);
        if (res.data) setMealsReport(res.data);
        else addToast({ type: "error", title: "Error", message: res.error || "Failed to load report" });
        setAnalyticsLoading(false);
    };

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const [availableRes, claimedRes] = await Promise.all([
                apiService.getNgoNearbyTasks(),
                apiService.getNgoClaimedTasks(),
            ]);

            if (availableRes.data) setTasks(availableRes.data);
            if (claimedRes.data) setClaimedTasks(claimedRes.data);
        } catch (error) {
            addToast({ type: "error", title: "Error", message: "Failed to load tasks" });
        } finally {
            setIsLoading(false);
        }
    };

    const claimTask = async (taskId: string) => {
        const res = await apiService.claimTask(taskId);
        if (!res.error) {
            addToast({ type: "success", title: "Success", message: "Donation claimed successfully" });
            fetchTasks();
        } else {
            addToast({ type: "error", title: "Error", message: res.error });
        }
    };

    return (
        <div className="min-h-screen text-white">
            {/* Background */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
            <div className="bg-nebula-parallax"></div>

            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 glass-card rounded-none border-r border-white/10 z-40 p-6 flex flex-col">
                <div className="glass-highlight"></div>

                <Link href="/" className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#fb923c] to-orange-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(251,146,60,0.4)]">
                        <span className="material-symbols-outlined text-white">eco</span>
                    </div>
                    <span className="text-xl font-bold">Surplus</span>
                </Link>

                {/* User Info */}
                {user && (
                    <div className="mb-6 p-3 bg-slate-800/30 rounded-xl">
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                )}

                <nav className="flex-1 space-y-2">
                    <button onClick={() => setActiveTab("available")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "available" ? "bg-[#fb923c]/20 text-[#fb923c]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                        <span className="material-symbols-outlined">inventory_2</span>
                        <span className="font-medium">Available Donations</span>
                    </button>
                    <button onClick={() => setActiveTab("claimed")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "claimed" ? "bg-[#fb923c]/20 text-[#fb923c]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                        <span className="material-symbols-outlined">fact_check</span>
                        <span className="font-medium">My Claims</span>
                    </button>
                    <button onClick={() => setActiveTab("meal-planner")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "meal-planner" ? "bg-[#fb923c]/20 text-[#fb923c]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                        <span className="material-symbols-outlined">restaurant_menu</span>
                        <span className="font-medium">AI Meal Planner</span>
                    </button>
                    <button onClick={() => setActiveTab("grant-writer")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "grant-writer" ? "bg-[#fb923c]/20 text-[#fb923c]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                        <span className="material-symbols-outlined">edit_document</span>
                        <span className="font-medium">Grant Writer</span>
                    </button>
                    <button onClick={() => setActiveTab("analytics")} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "analytics" ? "bg-[#fb923c]/20 text-[#fb923c]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                        <span className="material-symbols-outlined">analytics</span>
                        <span className="font-medium">Analytics</span>
                    </button>
                </nav>

                <button onClick={logout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors">
                    <span className="material-symbols-outlined">logout</span>
                    <span className="font-medium">Logout</span>
                </button>
            </aside>

            {/* Main Content */}
            <main className="ml-64 p-8 relative z-10">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold">NGO Dashboard</h1>
                    <p className="text-slate-400 mt-1">Manage your food rescue operations</p>
                </header>

                {/* ==== MEAL PLANNER (#5) ==== */}
                {activeTab === "meal-planner" && (
                    <div>
                        <header className="mb-8">
                            <h1 className="text-3xl font-bold">🍳 AI Meal Planner</h1>
                            <p className="text-slate-400 mt-1">Enter confirmed incoming donations — AI generates a 3-day meal plan optimised for your beneficiaries and nutritional targets.</p>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Inputs */}
                            <div className="glass-card p-6 relative">
                                <div className="glass-highlight" />
                                <h3 className="font-bold mb-4">Incoming Ingredients</h3>
                                <div className="space-y-3 mb-4">
                                    {mpIngredients.map((ing, i) => (
                                        <div key={i} className="flex gap-3">
                                            <input
                                                type="text"
                                                value={ing.food_type}
                                                onChange={e => setMpIngredients(prev => prev.map((x, j) => j === i ? { ...x, food_type: e.target.value } : x))}
                                                placeholder="Food type"
                                                className="flex-1 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50"
                                            />
                                            <input
                                                type="number"
                                                value={ing.quantity_kg}
                                                onChange={e => setMpIngredients(prev => prev.map((x, j) => j === i ? { ...x, quantity_kg: parseFloat(e.target.value) } : x))}
                                                placeholder="kg"
                                                className="w-20 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50"
                                            />
                                            <button onClick={() => setMpIngredients(prev => prev.filter((_, j) => j !== i))}
                                                className="px-2 text-slate-500 hover:text-red-400 transition-colors">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={() => setMpIngredients(prev => [...prev, { food_type: "", quantity_kg: 0 }])}
                                    className="text-sm text-[#fb923c] hover:text-orange-300 transition-colors flex items-center gap-1 mb-4">
                                    <span className="material-symbols-outlined text-sm">add</span> Add ingredient
                                </button>

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Beneficiaries to serve</label>
                                        <input type="number" title="Beneficiaries to serve" value={mpBeneficiaries} onChange={e => setMpBeneficiaries(parseInt(e.target.value))}
                                            className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Dietary restrictions (optional)</label>
                                        <input type="text" value={mpRestrictions} onChange={e => setMpRestrictions(e.target.value)}
                                            placeholder="e.g. vegetarian, diabetic"
                                            className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50" />
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        setMealPlanLoading(true);
                                        setMealPlan(null);
                                        try {
                                            const res = await fetch("/api/ai/meal-plan", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    ingredients: mpIngredients.filter(i => i.food_type),
                                                    beneficiary_count: mpBeneficiaries,
                                                    dietary_restrictions: mpRestrictions ? mpRestrictions.split(",").map(s => s.trim()) : [],
                                                }),
                                            });
                                            const data = await res.json();
                                            if (data.error) addToast({ type: "error", title: "AI Error", message: data.error });
                                            else setMealPlan(data);
                                        } catch {
                                            addToast({ type: "error", title: "Error", message: "AI service unavailable" });
                                        }
                                        setMealPlanLoading(false);
                                    }}
                                    disabled={mealPlanLoading || mpIngredients.filter(i => i.food_type).length === 0}
                                    className="mt-6 w-full py-2.5 bg-[#fb923c] hover:bg-orange-400 disabled:opacity-40 text-slate-900 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    {mealPlanLoading ? (
                                        <><div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> Generating Plan…</>
                                    ) : (
                                        <><span className="material-symbols-outlined text-sm">auto_fix_high</span> Generate 3-Day Meal Plan</>
                                    )}
                                </button>
                            </div>

                            {/* Summary */}
                            {mealPlan && (
                                <div className="glass-card p-6 relative">
                                    <div className="glass-highlight" />
                                    <h3 className="font-bold mb-4">Nutritional Summary</h3>
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="p-3 bg-slate-800/40 rounded-xl text-center">
                                            <p className="text-xl font-bold text-[#fb923c]">{mealPlan.nutritional_summary?.avg_daily_calories ?? "—"}</p>
                                            <p className="text-xs text-slate-400">Avg Daily kcal</p>
                                        </div>
                                        <div className="p-3 bg-slate-800/40 rounded-xl text-center">
                                            <p className="text-xl font-bold text-green-400">{mealPlan.nutritional_summary?.avg_protein_g ?? "—"}g</p>
                                            <p className="text-xs text-slate-400">Avg Protein</p>
                                        </div>
                                        <div className="p-3 bg-slate-800/40 rounded-xl text-center col-span-2">
                                            <p className="text-xl font-bold text-blue-400">{mealPlan.nutritional_summary?.coverage_pct ?? "—"}%</p>
                                            <p className="text-xs text-slate-400">Ingredient Coverage</p>
                                        </div>
                                    </div>
                                    {mealPlan.waste_reduction_tip && (
                                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300">
                                            <span className="font-semibold">💡 Tip: </span>{mealPlan.waste_reduction_tip}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Day-by-day plan */}
                        {mealPlan?.meal_plan && (
                            <div className="space-y-4">
                                {mealPlan.meal_plan.map((day: any) => (
                                    <div key={day.day} className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <h3 className="font-bold text-[#fb923c] mb-4">Day {day.day}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {day.meals?.map((meal: any, mi: number) => (
                                                <div key={mi} className="bg-slate-800/40 rounded-xl p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-sm text-[#fb923c]">
                                                            {meal.meal_type === "Breakfast" ? "free_breakfast" : meal.meal_type === "Lunch" ? "lunch_dining" : "dinner_dining"}
                                                        </span>
                                                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{meal.meal_type}</p>
                                                    </div>
                                                    <p className="font-bold text-sm mb-2">{meal.dish_name}</p>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        <span className="text-xs bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded-full">{meal.calories_per_serving} kcal</span>
                                                        <span className="text-xs bg-green-500/10 text-green-300 px-2 py-0.5 rounded-full">{meal.protein_g}g protein</span>
                                                        <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">{meal.servings} servings</span>
                                                    </div>
                                                    {meal.ingredients_used?.length > 0 && (
                                                        <p className="text-xs text-slate-500">
                                                            {meal.ingredients_used.map((ing: any) => `${ing.item} (${ing.quantity_kg}kg)`).join(", ")}
                                                        </p>
                                                    )}
                                                    {meal.notes && <p className="text-xs text-slate-500 mt-1 italic">{meal.notes}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ==== GRANT WRITER (#10) ==== */}
                {activeTab === "grant-writer" && (
                    <div>
                        <header className="mb-8">
                            <h1 className="text-3xl font-bold">📝 Grant Writing Assistant</h1>
                            <p className="text-slate-400 mt-1">Enter a funder and program — AI drafts a grant application pre-filled with your real platform impact data.</p>
                        </header>

                        <div className="glass-card p-6 relative mb-6">
                            <div className="glass-highlight" />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-2">Funder Name</label>
                                    <input type="text" value={grantFunder} onChange={e => setGrantFunder(e.target.value)}
                                        placeholder="e.g. Tata Trust, PM POSHAN"
                                        className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-2">Program / Focus Area</label>
                                    <input type="text" value={grantProgram} onChange={e => setGrantProgram(e.target.value)}
                                        placeholder="e.g. Hunger Relief, Child Nutrition"
                                        className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50" />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={async () => {
                                            setGrantLoading(true);
                                            setGrantDraft(null);
                                            try {
                                                const res = await fetch("/api/ai/grant-draft", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        ngo_name: ngoName || (user?.name ?? "Our NGO"),
                                                        funder: grantFunder,
                                                        program_type: grantProgram,
                                                        impact_stats: {
                                                            total_meals: mealsReport?.total_meals_served,
                                                            total_kg: mealsReport?.total_weight_kg,
                                                            beneficiaries: mpBeneficiaries,
                                                            months_active: mealsReport?.monthly_breakdown?.length,
                                                        },
                                                    }),
                                                });
                                                const data = await res.json();
                                                if (data.error) addToast({ type: "error", title: "AI Error", message: data.error });
                                                else setGrantDraft(data);
                                            } catch {
                                                addToast({ type: "error", title: "Error", message: "AI service unavailable" });
                                            }
                                            setGrantLoading(false);
                                        }}
                                        disabled={grantLoading || !grantFunder}
                                        className="w-full py-2.5 bg-[#fb923c] hover:bg-orange-400 disabled:opacity-40 text-slate-900 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        {grantLoading ? (
                                            <><div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" /> Drafting…</>
                                        ) : (
                                            <><span className="material-symbols-outlined text-sm">edit_document</span> Generate Draft</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {grantDraft && (
                            <div className="space-y-4">
                                {[
                                    { label: "Executive Summary", icon: "summarize", content: grantDraft.executive_summary, colour: "#fb923c" },
                                    { label: "Problem Statement", icon: "report_problem", content: grantDraft.problem_statement, colour: "#f87171" },
                                    { label: "Proposed Solution", icon: "lightbulb", content: grantDraft.proposed_solution, colour: "#34d399" },
                                    { label: "Impact Metrics", icon: "bar_chart", content: grantDraft.impact_metrics, colour: "#38bdf8" },
                                    { label: "Alignment with Funder", icon: "handshake", content: grantDraft.alignment_statement, colour: "#a78bfa" },
                                    { label: "Budget Justification Hint", icon: "payments", content: grantDraft.budget_justification_hint, colour: "#fbbf24" },
                                ].map(section => (
                                    <div key={section.label} className="glass-card p-6 relative">
                                        <div className="glass-highlight" />
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-sm" style={{ color: section.colour }}>{section.icon}</span>
                                            <h3 className="font-bold" style={{ color: section.colour }}>{section.label}</h3>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{section.content}</p>
                                    </div>
                                ))}
                                <div className="flex gap-3">
                                    <button onClick={() => { const t = Object.values(grantDraft).join("\n\n"); navigator.clipboard.writeText(t); addToast({ type: "success", title: "Copied!", message: "Draft copied to clipboard" }); }}
                                        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">content_copy</span> Copy All
                                    </button>
                                    <span className="text-xs text-slate-500 flex items-center">≈ {grantDraft.word_count_estimate} words</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==== ANALYTICS TAB ==== */}
                {activeTab === "analytics" && (
                    <div className="space-y-8">
                        <h2 className="text-2xl font-bold">NGO Analytics Dashboard</h2>

                        {analyticsLoading && (
                            <div className="flex items-center gap-3 text-slate-400">
                                <div className="w-5 h-5 border-2 border-[#fb923c]/30 border-t-[#fb923c] rounded-full animate-spin" />
                                Loading analytics…
                            </div>
                        )}

                        {/* US7 — Meals Served Report */}
                        <div className="glass-card p-6 relative">
                            <div className="glass-highlight" />
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#fb923c]">restaurant_menu</span>
                                Meals Served Report (US7)
                            </h3>
                            <div className="flex flex-wrap gap-4 mb-6">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                                    <input type="date" title="Start Date" value={mealsStart} onChange={e => setMealsStart(e.target.value)}
                                        className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">End Date</label>
                                    <input type="date" title="End Date" value={mealsEnd} onChange={e => setMealsEnd(e.target.value)}
                                        className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#fb923c]/50" />
                                </div>
                                <div className="flex items-end">
                                    <button onClick={loadMealsReport}
                                        className="px-5 py-2 bg-[#fb923c] hover:bg-orange-400 text-slate-900 rounded-lg font-medium transition-all">
                                        Generate
                                    </button>
                                </div>
                            </div>
                            {mealsReport ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                        <AnalyticsPill label="Total Meals" value={mealsReport.total_meals_served?.toLocaleString() ?? "—"} />
                                        <AnalyticsPill label="Total Weight" value={`${mealsReport.total_weight_kg?.toFixed(1) ?? "—"} kg`} />
                                        <AnalyticsPill label="NGOs Served" value={mealsReport.ngos_served?.toString() ?? "—"} />
                                        <AnalyticsPill label="Avg / Month" value={mealsReport.avg_meals_per_month?.toFixed(0) ?? "—"} />
                                    </div>
                                    {mealsReport.monthly_breakdown && mealsReport.monthly_breakdown.length > 0 && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-slate-400 border-b border-white/10">
                                                        <th className="text-left pb-2">Month</th>
                                                        <th className="text-right pb-2">Meals</th>
                                                        <th className="text-right pb-2">Weight (kg)</th>
                                                        <th className="text-right pb-2">Donations</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {mealsReport.monthly_breakdown.map((row: {month: string; meals_served: number; weight_kg: number; donation_count: number}, i: number) => (
                                                        <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                                                            <td className="py-2">{row.month}</td>
                                                            <td className="py-2 text-right font-medium">{row.meals_served?.toLocaleString()}</td>
                                                            <td className="py-2 text-right">{row.weight_kg?.toFixed(1)}</td>
                                                            <td className="py-2 text-right">{row.donation_count}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Select a date range and click Generate.</p>
                            )}
                        </div>

                        {/* US11 — Nutritional Breakdown */}
                        <div className="glass-card p-6 relative">
                            <div className="glass-highlight" />
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-400">nutrition</span>
                                Nutritional Breakdown (US11)
                            </h3>
                            {nutrition ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                        <AnalyticsPill label="Avg Calories" value={`${nutrition.avg_calories_per_meal?.toFixed(0) ?? "—"} kcal`} />
                                        <AnalyticsPill label="Avg Protein" value={`${nutrition.avg_protein_g?.toFixed(1) ?? "—"} g`} />
                                        <AnalyticsPill label="Avg Carbs" value={`${nutrition.avg_carbs_g?.toFixed(1) ?? "—"} g`} />
                                        <AnalyticsPill label="Avg Fat" value={`${nutrition.avg_fat_g?.toFixed(1) ?? "—"} g`} />
                                    </div>
                                    {nutrition.per_food_type && nutrition.per_food_type.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-slate-400 font-medium">By Food Type</p>
                                            {nutrition.per_food_type.map((ft: {food_type: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number}, i: number) => (
                                                <div key={i} className="bg-slate-800/40 rounded-xl p-4">
                                                    <p className="font-medium mb-2">{ft.food_type}</p>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        <NutrBar label="Calories" value={ft.calories} max={700} unit="kcal" colour="orange" />
                                                        <NutrBar label="Protein" value={ft.protein_g} max={50} unit="g" colour="blue" />
                                                        <NutrBar label="Carbs" value={ft.carbs_g} max={100} unit="g" colour="yellow" />
                                                        <NutrBar label="Fat" value={ft.fat_g} max={40} unit="g" colour="red" />
                                                        <NutrBar label="Fiber" value={ft.fiber_g} max={20} unit="g" colour="green" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Nutritional data loading…</p>
                            )}
                        </div>

                        {/* US2 — Demand Forecast */}
                        <div className="glass-card p-6 relative">
                            <div className="glass-highlight" />
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-400">trending_up</span>
                                Demand Forecast (US2)
                            </h3>
                            {demandForecast ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                                        <AnalyticsPill label="Forecast Horizon" value={`${demandForecast.forecast_horizon_months ?? "—"} months`} />
                                        <AnalyticsPill label="Model" value={demandForecast.model_used ?? "Holt-Winters"} />
                                        <AnalyticsPill label="Confidence" value={demandForecast.confidence_level ?? "—"} />
                                    </div>
                                    {demandForecast.forecast && demandForecast.forecast.length > 0 && (
                                        <div className="space-y-2">
                                            {demandForecast.forecast.map((f: {month: string; predicted_demand_kg: number}, i: number) => {
                                                const maxKg = Math.max(...demandForecast.forecast.map((x: {predicted_demand_kg: number}) => x.predicted_demand_kg), 1);
                                                return (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <span className="text-sm text-slate-400 w-24 shrink-0">{f.month}</span>
                                                        <div className="flex-1 bg-slate-800/50 rounded-full h-3 overflow-hidden">
                                                            <div className="h-full bg-purple-500 rounded-full transition-all"
                                                                style={{ width: `${(f.predicted_demand_kg / maxKg) * 100}%` }} />
                                                        </div>
                                                        <span className="text-sm font-medium w-20 text-right">{f.predicted_demand_kg?.toFixed(0)} kg</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Demand forecast loading…</p>
                            )}
                        </div>

                        {/* Sentiment Summary */}
                        <div className="glass-card p-6 relative">
                            <div className="glass-highlight" />
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-yellow-400">sentiment_satisfied</span>
                                Beneficiary Sentiment
                            </h3>
                            {sentiment ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <AnalyticsPill label="Avg Score" value={sentiment.avg_compound?.toFixed(3) ?? "—"} />
                                        <AnalyticsPill label="Avg Stars" value={`${sentiment.avg_stars?.toFixed(1) ?? "—"} ★`} />
                                        <AnalyticsPill label="Positive" value={`${sentiment.positive_pct?.toFixed(1) ?? "—"}%`} />
                                        <AnalyticsPill label="Negative" value={`${sentiment.negative_pct?.toFixed(1) ?? "—"}%`} />
                                    </div>
                                    {sentiment.label_distribution && (
                                        <div className="space-y-2 mt-2">
                                            {Object.entries(sentiment.label_distribution).map(([label, count]) => {
                                                const total = Object.values(sentiment.label_distribution).reduce((a: number, b) => a + (b as number), 0) as number;
                                                const pct = total > 0 ? ((count as number) / total) * 100 : 0;
                                                const textColour = label === "POSITIVE" ? "text-green-400" : label === "NEGATIVE" ? "text-red-400" : "text-yellow-400";
                                                const barColour = label === "POSITIVE" ? "bg-green-500" : label === "NEGATIVE" ? "bg-red-500" : "bg-yellow-500";
                                                return (
                                                    <div key={label} className="flex items-center gap-3">
                                                        <span className={`text-sm w-20 shrink-0 ${textColour}`}>{label}</span>
                                                        <div className="flex-1 bg-slate-800/50 rounded-full h-3 overflow-hidden">
                                                            <div className={`h-full ${barColour} rounded-full`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="text-sm w-16 text-right">{count as number} ({pct.toFixed(0)}%)</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm">Sentiment data loading…</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Task List — hidden on analytics tab */}
                {activeTab !== "analytics" && (<>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="glass-card p-6 relative">
                        <div className="glass-highlight"></div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-green-400 text-2xl">inventory_2</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{tasks.length}</p>
                                <p className="text-sm text-slate-400">Available</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-6 relative">
                        <div className="glass-highlight"></div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#fb923c]/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#fb923c] text-2xl">fact_check</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{claimedTasks.length}</p>
                                <p className="text-sm text-slate-400">Claimed</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-6 relative">
                        <div className="glass-highlight"></div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-blue-400 text-2xl">scale</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{claimedTasks.reduce((sum, t) => sum + (t.quantity_kg || 0), 0).toFixed(1)}kg</p>
                                <p className="text-sm text-slate-400">Total Rescued</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Task List */}
                <div className="glass-card p-6 relative">
                    <div className="glass-highlight"></div>
                    <h2 className="text-xl font-bold mb-6">{activeTab === "available" ? "Available Donations" : "My Claims"}</h2>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-[#fb923c]/30 border-t-[#fb923c] rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(activeTab === "available" ? tasks : claimedTasks).length === 0 ? (
                                <p className="text-center text-slate-400 py-8">No {activeTab === "available" ? "available donations" : "claimed tasks"} at the moment</p>
                            ) : (
                                (activeTab === "available" ? tasks : claimedTasks).map((task) => (
                                    <div key={task.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-[#fb923c]/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[#fb923c]">restaurant</span>
                                            </div>
                                            <div>
                                                <p className="font-medium">{task.food_type}</p>
                                                <p className="text-sm text-slate-400">{task.pickup_address}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-lg font-bold">{task.quantity_kg}kg</span>
                                            {activeTab === "available" ? (
                                                <button
                                                    onClick={() => claimTask(task.id)}
                                                    className="px-4 py-2 bg-[#fb923c] hover:bg-orange-400 text-slate-900 rounded-lg font-medium transition-all hover:shadow-[0_0_15px_rgba(251,146,60,0.3)]"
                                                >
                                                    Claim
                                                </button>
                                            ) : (
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${task.status === "COMPLETED" ? "bg-green-500/20 text-green-400" :
                                                        task.status === "IN_TRANSIT" ? "bg-blue-500/20 text-blue-400" :
                                                            "bg-[#fb923c]/20 text-[#fb923c]"
                                                    }`}>
                                                    {task.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
                </>)}
            </main>
        </div>
    );
}
