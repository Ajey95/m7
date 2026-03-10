"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { apiService } from "../../../lib/api-service";
import { API_BASE_URL } from "../../../lib/api-config";
import { useWebSocket } from "../../../lib/websocket-service";
import { useToast } from "../../../lib/toast-context";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
    is_active: boolean;
}

interface NGO {
    id: string;
    name: string;
    email: string;
    status: "pending" | "approved" | "rejected" | "PENDING" | "VERIFIED" | "REJECTED";
    created_at: string;
    license_number?: string;
    license_expiry?: string;
    license_document_url?: string;
    rejection_reason?: string;
}

interface Donation {
    id: string;
    donor_name: string;
    food_type: string;
    quantity_kg: number;
    status: string;
    pickup_token?: string;
    delivery_token?: string;
    created_at: string;
}

interface Stats {
    users: { total: number; volunteers: number; ngos: number; donors: number };
    volunteers: { online: number; busy: number; offline: number };
    ngos: { pending: number; approved: number; rejected: number };
    tasks: { total: number; pending: number; assigned: number; in_progress: number; completed: number; cancelled: number; this_week: number };
    impact?: { total_weight_kg: number; co2_saved_kg: number };
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<"overview" | "users" | "ngos" | "donations" | "hotspots">("overview");
    const [hotspots, setHotspots] = useState<Array<{lat: number; lng: number; type: string; quantity_kg: number; date: string}>>([]);
    const [hotspotsLoading, setHotspotsLoading] = useState(false);
    const { isLoaded: mapsLoaded } = useJsApiLoader({ googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "" });
    const [users, setUsers] = useState<User[]>([]);
    const [ngos, setNgos] = useState<NGO[]>([]);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    // Filters
    const [foodTypeFilter, setFoodTypeFilter] = useState<string>("ALL");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    // Real-time updates
    useWebSocket([
        "task_created",
        "task_updated",
        "task_assigned",
        "task_completed",
        "volunteer_online",
        "donation_claimed",
        "notification"
    ], (message) => {
        addToast({
            type: "info",
            title: "Real-time Update",
            message: `${message.type}: ${JSON.stringify(message.payload).slice(0, 50)}...`,
        });
        fetchData(); // Refresh stats
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, ngosRes, statsRes, donationsRes] = await Promise.all([
                apiService.getAdminUsers(),
                apiService.getAdminNgos(),
                apiService.getAdminStats(),
                apiService.getAdminDonations(),
            ]);

            if (usersRes.data) setUsers(usersRes.data);
            if (ngosRes.data) {
                console.log("DEBUG NGOS:", ngosRes.data);
                setNgos(ngosRes.data);
            }
            if (statsRes.data) setStats(statsRes.data);
            if (donationsRes.data) setDonations(donationsRes.data);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApproveNgo = async (id: string) => {
        const res = await apiService.approveNgo(id);
        if (!res.error) {
            addToast({ type: "success", title: "NGO Approved", message: "The NGO has been activated" });
            fetchData();
        } else {
            addToast({ type: "error", title: "Error", message: res.error });
        }
    };

    const handleRejectNgo = async (id: string) => {
        const reason = window.prompt("Enter rejection reason (optional):");
        if (reason === null) return; // User cancelled
        const res = await apiService.rejectNgo(id, reason || undefined);
        if (!res.error) {
            addToast({ type: "warning", title: "NGO Rejected", message: "The NGO application was rejected" });
            fetchData();
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        const res = await apiService.deleteUser(id);
        if (!res.error) {
            addToast({ type: "success", title: "User Deleted" });
            fetchData();
        }
    };

    const handleLogout = () => {
        apiService.logout();
    };

    // Filtered donations
    const filteredDonations = donations.filter(donation => {
        const matchesType = foodTypeFilter === "ALL" || donation.food_type === foodTypeFilter;
        const matchesStatus = statusFilter === "ALL" || donation.status === statusFilter;
        return matchesType && matchesStatus;
    });

    return (
        <div className="min-h-screen text-white">
            {/* Background */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
            <div className="bg-nebula-parallax"></div>

            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 glass-card rounded-none border-r border-white/10 z-40 p-6 flex flex-col">
                <div className="glass-highlight"></div>

                <Link href="/" className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        <span className="material-symbols-outlined text-white">admin_panel_settings</span>
                    </div>
                    <span className="text-xl font-bold">Admin Panel</span>
                </Link>

                <nav className="flex-1 space-y-2">
                    {[
                        { id: "overview", icon: "dashboard", label: "Overview" },
                        { id: "users", icon: "group", label: "Users" },
                        { id: "ngos", icon: "volunteer_activism", label: "NGO Approvals" },
                        { id: "donations", icon: "inventory_2", label: "All Donations" },
                        { id: "hotspots", icon: "location_on", label: "Waste Hotspots" },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id
                                ? "bg-red-500/20 text-red-400"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors">
                    <span className="material-symbols-outlined">logout</span>
                    <span className="font-medium">Logout</span>
                </button>
            </aside>

            {/* Main Content */}
            <main className="ml-64 p-8 relative z-10">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-slate-400 mt-1">System management and oversight</p>
                </header>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                            {[
                                { label: "Total Users", value: stats?.users.total || 0, icon: "group", color: "blue" },
                                { label: "Donations", value: stats?.tasks.total || 0, icon: "inventory_2", color: "green" },
                                { label: "Rescued (kg)", value: stats?.impact?.total_weight_kg || 0, icon: "scale", color: "orange" },
                                { label: "Active Volunteers", value: (stats?.volunteers.online || 0) + (stats?.volunteers.busy || 0), icon: "local_shipping", color: "purple" },
                                { label: "Pending NGOs", value: stats?.ngos.pending || 0, icon: "pending", color: "yellow" },
                                { label: "CO₂ Prevented (kg)", value: (stats?.impact?.co2_saved_kg || 0).toFixed(1), icon: "eco", color: "teal" },
                            ].map((stat, i) => (
                                <div key={i} className="glass-card p-4 relative">
                                    <div className="glass-highlight"></div>
                                    <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/20 flex items-center justify-center mb-3`}>
                                        <span className={`material-symbols-outlined text-${stat.color}-400`}>{stat.icon}</span>
                                    </div>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                    <p className="text-xs text-slate-400">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="glass-card p-6 relative">
                                <div className="glass-highlight"></div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-yellow-400">pending</span>
                                    Pending NGO Approvals
                                </h2>
                                <div className="space-y-3">
                                    {ngos.filter(n => n.status === "pending" || n.status === "PENDING").slice(0, 5).map((ngo) => (
                                        <div key={ngo.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                                            <div>
                                                <p className="font-medium">{ngo.name}</p>
                                                <p className="text-sm text-slate-400">{ngo.email}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApproveNgo(ngo.id)} className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30">
                                                    Approve
                                                </button>
                                                <button onClick={() => handleRejectNgo(ngo.id)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30">
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {ngos.filter(n => n.status === "pending" || n.status === "PENDING").length === 0 && (
                                        <p className="text-slate-400 text-center py-4">No pending approvals</p>
                                    )}
                                </div>
                            </div>

                            <div className="glass-card p-6 relative">
                                <div className="glass-highlight"></div>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-400">insights</span>
                                    Recent Activity
                                </h2>
                                <div className="space-y-3">
                                    {users.slice(0, 5).map((user) => (
                                        <div key={user.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-sm">person</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{user.name}</p>
                                                    <p className="text-xs text-slate-400">{user.role}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs ${user.is_active ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"}`}>
                                                {user.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Users Tab */}
                {activeTab === "users" && (
                    <div className="glass-card p-6 relative">
                        <div className="glass-highlight"></div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">All Users</h2>
                            <span className="text-slate-400">{users.length} total</span>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                                            <th className="pb-3 font-medium">Name</th>
                                            <th className="pb-3 font-medium">Email</th>
                                            <th className="pb-3 font-medium">Role</th>
                                            <th className="pb-3 font-medium">Status</th>
                                            <th className="pb-3 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user.id} className="border-b border-white/5">
                                                <td className="py-4">{user.name}</td>
                                                <td className="py-4 text-slate-400">{user.email}</td>
                                                <td className="py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === "admin" ? "bg-red-500/20 text-red-400" :
                                                        user.role === "ngo" ? "bg-purple-500/20 text-purple-400" :
                                                            user.role === "volunteer" ? "bg-blue-500/20 text-blue-400" :
                                                                "bg-green-500/20 text-green-400"
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="py-4">
                                                    <span className={`w-2 h-2 rounded-full inline-block mr-2 ${user.is_active ? "bg-green-400" : "bg-slate-500"}`}></span>
                                                    {user.is_active ? "Active" : "Inactive"}
                                                </td>
                                                <td className="py-4">
                                                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-300 text-sm">
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* NGOs Tab */}
                {activeTab === "ngos" && (
                    <div className="glass-card p-6 relative">
                        <div className="glass-highlight"></div>
                        <h2 className="text-xl font-bold mb-6">NGO Applications</h2>

                        <div className="space-y-4">
                            {ngos.map((ngo) => (
                                <div key={ngo.id} className="p-4 bg-slate-800/30 rounded-xl">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-purple-400">volunteer_activism</span>
                                            </div>
                                            <div>
                                                <p className="font-medium">{ngo.name}</p>
                                                <p className="text-sm text-slate-400">{ngo.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${(ngo.status?.toLowerCase() === "verified" || ngo.status?.toLowerCase() === "approved") ? "bg-green-500/20 text-green-400" :
                                                (ngo.status?.toLowerCase() === "rejected") ? "bg-red-500/20 text-red-400" :
                                                    "bg-yellow-500/20 text-yellow-400"
                                                }`}>
                                                {ngo.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* License Details */}
                                    <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                                        <div className="bg-slate-700/30 rounded-lg p-2">
                                            <p className="text-slate-500 text-xs">License #</p>
                                            <p className="text-slate-200 font-mono text-xs">{ngo.license_number || "Not submitted"}</p>
                                        </div>
                                        <div className="bg-slate-700/30 rounded-lg p-2">
                                            <p className="text-slate-500 text-xs">Expiry</p>
                                            <p className="text-slate-200 text-xs">{ngo.license_expiry ? new Date(ngo.license_expiry).toLocaleDateString() : "N/A"}</p>
                                        </div>
                                        <div className="bg-slate-700/30 rounded-lg p-2">
                                            <p className="text-slate-500 text-xs">Document</p>
                                            {ngo.license_document_url ? (
                                                <a href={`${API_BASE_URL}${ngo.license_document_url}`} target="_blank" rel="noopener noreferrer" className="text-[#fb923c] text-xs hover:text-orange-300 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                                                    View PDF
                                                </a>
                                            ) : (
                                                <p className="text-slate-500 text-xs">Not uploaded</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rejection reason if rejected */}
                                    {ngo.status?.toLowerCase() === "rejected" && ngo.rejection_reason && (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-3">
                                            <p className="text-xs text-red-400">Rejection: {ngo.rejection_reason}</p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {(ngo.status?.toLowerCase() === "pending") && (
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleApproveNgo(ngo.id)} className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors">
                                                Approve
                                            </button>
                                            <button onClick={() => handleRejectNgo(ngo.id)} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors">
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {ngos.length === 0 && (
                                <p className="text-center text-slate-400 py-8">No NGO applications</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Donations Tab */}
                {activeTab === "donations" && (
                    <div className="glass-card p-6 relative">
                        <div className="glass-highlight"></div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">All Donations</h2>
                            <div className="flex gap-3">
                                <select
                                    value={foodTypeFilter}
                                    onChange={(e) => setFoodTypeFilter(e.target.value)}
                                    className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#fb923c]"
                                >
                                    <option value="ALL">All Types</option>
                                    <option value="VEG">Veg</option>
                                    <option value="NON_VEG">Non-Veg</option>
                                    <option value="VEGAN">Vegan</option>
                                    <option value="MIXED">Mixed</option>
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#fb923c]"
                                >
                                    <option value="ALL">All Status</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="ASSIGNED">Assigned</option>
                                    <option value="IN_TRANSIT">In Transit</option>
                                    <option value="DELIVERED">Delivered</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-slate-400 text-sm border-b border-white/10">
                                            <th className="pb-3 font-medium">Donor</th>
                                            <th className="pb-3 font-medium">Food Type</th>
                                            <th className="pb-3 font-medium">Qty (kg)</th>
                                            <th className="pb-3 font-medium">Status</th>
                                            <th className="pb-3 font-medium">Tokens (P/D)</th>
                                            <th className="pb-3 font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDonations.map((donation) => (
                                            <tr key={donation.id} className="border-b border-white/5">
                                                <td className="py-4 font-medium">{donation.donor_name || "Unknown"}</td>
                                                <td className="py-4 text-slate-300">{donation.food_type}</td>
                                                <td className="py-4 text-slate-300">{donation.quantity_kg}</td>
                                                <td className="py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${donation.status === "DELIVERED" ? "bg-green-500/20 text-green-400" :
                                                        donation.status === "CANCELLED" ? "bg-red-500/20 text-red-400" :
                                                            donation.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                                                                "bg-blue-500/20 text-blue-400"
                                                        }`}>
                                                        {donation.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-sm font-mono text-slate-400">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="w-4 inline-block text-slate-500">P:</span>
                                                        <span className="text-white select-all">{donation.pickup_token?.substring(0, 8)}...</span>
                                                        {donation.pickup_token && (
                                                            <button
                                                                onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${donation.pickup_token}`, '_blank', 'width=400,height=400')}
                                                                className="text-xs bg-[#fb923c]/20 text-[#fb923c] px-2 py-0.5 rounded hover:bg-[#fb923c]/30"
                                                            >
                                                                QR
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-4 inline-block text-slate-500">D:</span>
                                                        <span className="text-white select-all">{donation.delivery_token?.substring(0, 8)}...</span>
                                                        {donation.delivery_token && (
                                                            <button
                                                                onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${donation.delivery_token}`, '_blank', 'width=400,height=400')}
                                                                className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded hover:bg-blue-500/30"
                                                            >
                                                                QR
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 text-slate-400 text-sm">
                                                    {new Date(donation.created_at).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {filteredDonations.length === 0 && !isLoading && (
                            <p className="text-center text-slate-400 py-12">No donations found.</p>
                        )}
                    </div>
                )}

                {/* Hotspots Tab (US12) */}
                {activeTab === "hotspots" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-400">location_on</span>
                                Waste Hotspot Map (US12)
                            </h2>
                            <button
                                onClick={async () => {
                                    setHotspotsLoading(true);
                                    const res = await apiService.getAnalyticsWasteHotspots();
                                    if (res.data?.hotspots) setHotspots(res.data.hotspots);
                                    else addToast({ type: "error", title: "Error", message: res.error || "Failed to load hotspots" });
                                    setHotspotsLoading(false);
                                }}
                                disabled={hotspotsLoading}
                                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {hotspotsLoading ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">refresh</span>}
                                Load Hotspots
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight" />
                                <p className="text-2xl font-bold">{hotspots.length}</p>
                                <p className="text-xs text-slate-400">Total Hotspots</p>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight" />
                                <p className="text-2xl font-bold text-red-400">{hotspots.filter(h => h.type === "SPOILED").length}</p>
                                <p className="text-xs text-slate-400">Spoiled</p>
                            </div>
                            <div className="glass-card p-4 relative">
                                <div className="glass-highlight" />
                                <p className="text-2xl font-bold text-orange-400">{hotspots.filter(h => h.type === "CANCELLED").length}</p>
                                <p className="text-xs text-slate-400">Cancelled</p>
                            </div>
                        </div>

                        <div className="glass-card p-0 relative overflow-hidden rounded-2xl" style={{ height: 480 }}>
                            <div className="glass-highlight" />
                            {hotspots.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-slate-400">
                                    Click &ldquo;Load Hotspots&rdquo; to view the map
                                </div>
                            ) : mapsLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={{ width: "100%", height: "100%" }}
                                    center={hotspots.length > 0 ? { lat: hotspots[0].lat, lng: hotspots[0].lng } : { lat: 20.5937, lng: 78.9629 }}
                                    zoom={11}
                                    options={{ styles: [{ elementType: "geometry", stylers: [{ color: "#1a1a2e" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#8895a7" }] }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3561" }] }] }}
                                >
                                    {hotspots.map((h, i) => (
                                        <Marker
                                            key={i}
                                            position={{ lat: h.lat, lng: h.lng }}
                                            icon={{
                                                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                                                fillColor: h.type === "SPOILED" ? "#ef4444" : "#fb923c",
                                                fillOpacity: 0.9,
                                                strokeColor: "#fff",
                                                strokeWeight: 1,
                                                scale: 1.5,
                                            }}
                                            title={`${h.type} — ${h.quantity_kg}kg on ${h.date}`}
                                        />
                                    ))}
                                </GoogleMap>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400">Loading map…</div>
                            )}
                        </div>

                        {hotspots.length > 0 && (
                            <div className="glass-card p-6 relative">
                                <div className="glass-highlight" />
                                <h3 className="text-base font-semibold mb-4">Hotspot List</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-slate-400 border-b border-white/10">
                                                <th className="text-left pb-2">Type</th>
                                                <th className="text-right pb-2">Qty (kg)</th>
                                                <th className="text-right pb-2">Date</th>
                                                <th className="text-right pb-2">Coordinates</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hotspots.map((h, i) => (
                                                <tr key={i} className="border-b border-white/5">
                                                    <td className="py-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${h.type === "SPOILED" ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"}`}>
                                                            {h.type}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right">{h.quantity_kg?.toFixed(1)}</td>
                                                    <td className="py-2 text-right text-slate-400">{h.date}</td>
                                                    <td className="py-2 text-right text-slate-500 font-mono text-xs">{h.lat?.toFixed(4)}, {h.lng?.toFixed(4)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
