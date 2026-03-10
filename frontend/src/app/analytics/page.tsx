"use client";

import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────
interface CityImpact {
    total_kg_rescued: number;
    total_meals_served: number;
    co2_saved_tonnes: number;
    total_deliveries: number;
    active_volunteers: number;
    active_ngos: number;
    kg_rescued_this_week: number;
}

interface SurplusItem {
    donor_name: string;
    organization: string;
    predicted_kg: number;
    trend: string;
    confidence: string;
}

interface FraudFlag {
    entity_type: string;
    entity_id: string;
    anomaly_score: number;
    reason: string;
}

interface RouteEfficiency {
    total_deliveries_analysed: number;
    model_r2: number;
    volunteer_stats: Array<{
        volunteer_id: string;
        deliveries: number;
        avg_efficiency_ratio: number;
        avg_distance_km: number;
        performance: string;
    }>;
}

// ─── Colour helpers ──────────────────────────────────────────
const TREND_COLOUR: Record<string, string> = {
    INCREASING: "#22d3ee",
    DECREASING: "#f87171",
    STABLE: "#a3e635",
};
const RISK_COLOUR: Record<string, string> = {
    HIGH: "#ef4444",
    MEDIUM: "#f59e0b",
    LOW: "#22c55e",
};
const PERF_COLOUR: Record<string, string> = {
    FAST: "#22d3ee",
    NORMAL: "#a3e635",
    SLOW: "#f87171",
};

// ─── StatCard component ───────────────────────────────────────
function StatCard({
    label,
    value,
    sub,
    colour = "#a78bfa",
}: {
    label: string;
    value: string | number;
    sub?: string;
    colour?: string;
}) {
    return (
        <div
            style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 16,
                padding: "20px 24px",
                minWidth: 160,
                flex: "1 1 160px",
            }}
        >
            <div style={{ fontSize: 28, fontWeight: 700, color: colour }}>{value}</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

// ─── Section header ──────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
    return (
        <h2
            style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#e2e8f0",
                borderLeft: "4px solid #7c3aed",
                paddingLeft: 12,
                marginBottom: 18,
            }}
        >
            {icon} {title}
        </h2>
    );
}

// ─── Main page ────────────────────────────────────────────────
export default function AnalyticsDashboard() {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

    const [cityImpact, setCityImpact] = useState<CityImpact | null>(null);
    const [surplus, setSurplus] = useState<SurplusItem[]>([]);
    const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
    const [routeEff, setRouteEff] = useState<RouteEfficiency | null>(null);
    const [spoilage, setSpoilage] = useState<any[]>([]);
    const [sentimentText, setSentimentText] = useState("");
    const [sentimentResult, setSentimentResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const token =
        typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const authFetch = (url: string, opts?: RequestInit) =>
        fetch(url, {
            ...opts,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(opts?.headers || {}),
            },
        });

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);

                // City impact is public — no auth needed
                const ci = await fetch(`${API}/analytics/city-impact`);
                if (ci.ok) setCityImpact(await ci.json());

                if (token) {
                    const [surpRes, fraudRes, routeRes, spoilRes] = await Promise.allSettled([
                        authFetch(`${API}/analytics/surplus-prediction`),
                        authFetch(`${API}/analytics/fraud-flags`),
                        authFetch(`${API}/analytics/route-efficiency`),
                        authFetch(`${API}/analytics/spoilage-risk`),
                    ]);

                    if (surpRes.status === "fulfilled" && surpRes.value.ok) {
                        const d = await surpRes.value.json();
                        setSurplus(d.predictions?.slice(0, 8) || []);
                    }
                    if (fraudRes.status === "fulfilled" && fraudRes.value.ok) {
                        const d = await fraudRes.value.json();
                        setFraudFlags(d.flags?.slice(0, 8) || []);
                    }
                    if (routeRes.status === "fulfilled" && routeRes.value.ok) {
                        setRouteEff(await routeRes.value.json());
                    }
                    if (spoilRes.status === "fulfilled" && spoilRes.value.ok) {
                        const d = await spoilRes.value.json();
                        setSpoilage(d.risk_assessments?.slice(0, 6) || []);
                    }
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    async function runSentiment() {
        if (!sentimentText.trim()) return;
        const res = await authFetch(`${API}/analytics/sentiment/analyze`, {
            method: "POST",
            body: JSON.stringify({ text: sentimentText }),
        });
        if (res.ok) setSentimentResult(await res.json());
    }

    // ── Render ─────────────────────────────────────────────────
    return (
        <div
            style={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                color: "#e2e8f0",
                padding: "32px 24px",
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: 40, textAlign: "center" }}>
                <h1
                    style={{
                        fontSize: 34,
                        fontWeight: 800,
                        background: "linear-gradient(to right, #a78bfa, #38bdf8)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    📊 Analytics Intelligence Hub
                </h1>
                <p style={{ color: "#94a3b8", marginTop: 8, fontSize: 14 }}>
                    ML-powered insights · 15 User Stories · Real-time data
                </p>
            </div>

            {loading && (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 18 }}>
                    Loading analytics…
                </div>
            )}

            {/* ── US9: City Impact (public) ── */}
            {cityImpact && (
                <section style={{ marginBottom: 40 }}>
                    <SectionHeader icon="🌆" title="US9 — City-Level Impact Dashboard" />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                        <StatCard label="Total Food Rescued" value={`${cityImpact.total_kg_rescued.toLocaleString()} kg`} colour="#a78bfa" />
                        <StatCard label="Meals Served" value={cityImpact.total_meals_served.toLocaleString()} colour="#38bdf8" />
                        <StatCard label="CO₂ Saved" value={`${cityImpact.co2_saved_tonnes} t`} sub="IPCC 2.5 kg CO₂/kg food" colour="#4ade80" />
                        <StatCard label="Deliveries" value={cityImpact.total_deliveries} colour="#f59e0b" />
                        <StatCard label="Active Volunteers" value={cityImpact.active_volunteers} colour="#ec4899" />
                        <StatCard label="Active NGOs" value={cityImpact.active_ngos} colour="#22d3ee" />
                        <StatCard label="Rescued This Week" value={`${cityImpact.kg_rescued_this_week} kg`} colour="#a3e635" />
                    </div>
                </section>
            )}

            {/* ── US1: Surplus Prediction (Linear Regression) ── */}
            {surplus.length > 0 && (
                <section style={{ marginBottom: 40 }}>
                    <SectionHeader icon="📈" title="US1 — Surplus Volume Prediction (Linear Regression)" />
                    <div
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.08)",
                        }}
                    >
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "rgba(124,58,237,0.25)" }}>
                                    {["Donor / Org", "Predicted Next Month (kg)", "Trend", "Confidence"].map((h) => (
                                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#c4b5fd" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {surplus.map((s, i) => (
                                    <tr
                                        key={i}
                                        style={{
                                            borderTop: "1px solid rgba(255,255,255,0.05)",
                                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                                        }}
                                    >
                                        <td style={{ padding: "10px 16px" }}>{s.organization || s.donor_name}</td>
                                        <td style={{ padding: "10px 16px", fontWeight: 600, color: "#a78bfa" }}>
                                            {s.predicted_kg.toFixed(1)}
                                        </td>
                                        <td style={{ padding: "10px 16px", color: TREND_COLOUR[s.trend] || "#e2e8f0" }}>
                                            {s.trend === "INCREASING" ? "↑" : s.trend === "DECREASING" ? "↓" : "→"} {s.trend}
                                        </td>
                                        <td style={{ padding: "10px 16px", color: "#94a3b8" }}>{s.confidence}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ── US4: Spoilage Risk (Logistic Regression) ── */}
            {spoilage.length > 0 && (
                <section style={{ marginBottom: 40 }}>
                    <SectionHeader icon="🌡️" title="US4 — Spoilage Risk Analytics (Logistic Regression)" />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        {spoilage.map((s, i) => (
                            <div
                                key={i}
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: `1px solid ${RISK_COLOUR[s.risk_level]}44`,
                                    borderRadius: 12,
                                    padding: "14px 18px",
                                    minWidth: 200,
                                    flex: "1 1 200px",
                                }}
                            >
                                <div style={{ fontSize: 11, color: "#64748b" }}>Task {s.task_id.slice(0, 8)}</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: RISK_COLOUR[s.risk_level], marginTop: 4 }}>
                                    {(s.risk_score * 100).toFixed(0)}% risk
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                    {s.food_type} · {s.quantity_kg} kg · {s.hours_until_expiry}h left
                                </div>
                                <div
                                    style={{
                                        marginTop: 8,
                                        display: "inline-block",
                                        background: RISK_COLOUR[s.risk_level] + "22",
                                        color: RISK_COLOUR[s.risk_level],
                                        borderRadius: 99,
                                        padding: "2px 10px",
                                        fontSize: 11,
                                        fontWeight: 600,
                                    }}
                                >
                                    {s.risk_level}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── US8: Fraud Detection (Isolation Forest) ── */}
            {fraudFlags.length > 0 && (
                <section style={{ marginBottom: 40 }}>
                    <SectionHeader icon="🚨" title="US8 — Fraud Detection (Isolation Forest)" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {fraudFlags.map((f, i) => (
                            <div
                                key={i}
                                style={{
                                    background: "rgba(239,68,68,0.08)",
                                    border: "1px solid rgba(239,68,68,0.25)",
                                    borderRadius: 10,
                                    padding: "12px 18px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                }}
                            >
                                <span style={{ fontSize: 20 }}>{f.entity_type === "DONOR" ? "🤝" : "🏢"}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                                        {f.entity_type}: {f.entity_id.slice(0, 12)}…
                                    </div>
                                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{f.reason}</div>
                                </div>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: 14,
                                        color: f.anomaly_score > 0.7 ? "#ef4444" : "#f59e0b",
                                    }}
                                >
                                    {(f.anomaly_score * 100).toFixed(0)}% anomaly
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── US15: Route Efficiency (Ridge Regression) ── */}
            {routeEff && routeEff.volunteer_stats.length > 0 && (
                <section style={{ marginBottom: 40 }}>
                    <SectionHeader icon="🗺️" title="US15 — Route Efficiency Analysis (Ridge Regression)" />
                    <div style={{ marginBottom: 12, color: "#94a3b8", fontSize: 13 }}>
                        Model R² = <span style={{ color: "#a78bfa", fontWeight: 600 }}>{routeEff.model_r2}</span> ·{" "}
                        {routeEff.total_deliveries_analysed} deliveries analysed
                    </div>
                    <div
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.08)",
                        }}
                    >
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "rgba(124,58,237,0.25)" }}>
                                    {["Volunteer", "Deliveries", "Avg Efficiency Ratio", "Avg Distance (km)", "Status"].map((h) => (
                                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#c4b5fd" }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {routeEff.volunteer_stats.slice(0, 8).map((v, i) => (
                                    <tr
                                        key={i}
                                        style={{
                                            borderTop: "1px solid rgba(255,255,255,0.05)",
                                            background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                                        }}
                                    >
                                        <td style={{ padding: "10px 16px" }}>{v.volunteer_id.slice(0, 10)}…</td>
                                        <td style={{ padding: "10px 16px" }}>{v.deliveries}</td>
                                        <td style={{ padding: "10px 16px", fontWeight: 600, color: PERF_COLOUR[v.performance] }}>
                                            {v.avg_efficiency_ratio.toFixed(2)}x
                                        </td>
                                        <td style={{ padding: "10px 16px" }}>{v.avg_distance_km} km</td>
                                        <td style={{ padding: "10px 16px", color: PERF_COLOUR[v.performance] }}>
                                            {v.performance}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ── US14: Sentiment Analysis (VADER NLP) ── */}
            <section style={{ marginBottom: 40 }}>
                <SectionHeader icon="💬" title="US14 — Sentiment Analysis (VADER NLP)" />
                <div
                    style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        padding: 20,
                    }}
                >
                    <textarea
                        value={sentimentText}
                        onChange={(e) => setSentimentText(e.target.value)}
                        placeholder="Paste NGO feedback text here to analyse sentiment…"
                        rows={3}
                        style={{
                            width: "100%",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 8,
                            color: "#e2e8f0",
                            padding: "10px 14px",
                            fontSize: 14,
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                        }}
                    />
                    <button
                        onClick={runSentiment}
                        style={{
                            marginTop: 12,
                            background: "linear-gradient(to right, #7c3aed, #2563eb)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "10px 24px",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Analyse with VADER
                    </button>

                    {sentimentResult && (
                        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 16 }}>
                            <StatCard
                                label="Compound Score"
                                value={sentimentResult.compound}
                                colour={sentimentResult.compound >= 0.05 ? "#4ade80" : sentimentResult.compound <= -0.05 ? "#f87171" : "#f59e0b"}
                            />
                            <StatCard
                                label="Label"
                                value={sentimentResult.label}
                                colour={sentimentResult.label === "POSITIVE" ? "#4ade80" : sentimentResult.label === "NEGATIVE" ? "#f87171" : "#f59e0b"}
                            />
                            <StatCard label="Star Rating" value={`${"⭐".repeat(sentimentResult.star_rating)}`} colour="#f59e0b" />
                            <StatCard label="Positive" value={sentimentResult.pos} colour="#4ade80" />
                            <StatCard label="Negative" value={sentimentResult.neg} colour="#f87171" />
                            <StatCard label="Neutral" value={sentimentResult.neu} colour="#94a3b8" />
                        </div>
                    )}
                </div>
            </section>

            {/* Footer */}
            <div style={{ textAlign: "center", color: "#475569", fontSize: 12, marginTop: 20 }}>
                Analytics powered by scikit-learn · statsmodels · VADER NLP · PostGIS
            </div>
        </div>
    );
}
