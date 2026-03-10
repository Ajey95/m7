"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiService } from "../../../../lib/api-service";
import { useAuth } from "../../../../lib/auth-context";
import { useRouter } from "next/navigation";

export default function NgoPendingPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<string>("PENDING");

    useEffect(() => {
        const checkStatus = async () => {
            const res = await apiService.getNgoStatus();
            if (res.data) {
                if (res.data.verification_status === "VERIFIED") {
                    router.push("/dashboard/ngo");
                } else if (res.data.verification_status === "REJECTED") {
                    router.push("/dashboard/ngo/rejected");
                }
                setStatus(res.data.verification_status);
            }
        };

        checkStatus();
        // Poll every 15 seconds
        const interval = setInterval(checkStatus, 15000);
        return () => clearInterval(interval);
    }, [router]);

    return (
        <div className="min-h-screen text-white flex items-center justify-center px-4 relative overflow-hidden">
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
            <div className="bg-nebula-parallax"></div>

            <div className="relative z-10 w-full max-w-md text-center">
                <Link href="/" className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#fb923c] to-orange-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(251,146,60,0.4)]">
                        <span className="material-symbols-outlined text-white text-2xl">eco</span>
                    </div>
                    <span className="text-2xl font-bold">Surplus</span>
                </Link>

                <div className="glass-card p-8 relative">
                    <div className="glass-highlight"></div>

                    {/* Animated Clock */}
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-yellow-400 text-4xl animate-pulse">hourglass_top</span>
                    </div>

                    <h1 className="text-2xl font-bold mb-3">Application Under Review</h1>
                    <p className="text-slate-400 mb-6">
                        Your NGO registration is being reviewed by our admin team. This usually takes 1-2 business days.
                    </p>

                    {/* Status Timeline */}
                    <div className="space-y-4 mb-8 text-left">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-green-400 text-sm">check</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-400">Account Created</p>
                                <p className="text-xs text-slate-500">Basic information submitted</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-green-400 text-sm">check</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-400">License Submitted</p>
                                <p className="text-xs text-slate-500">License documents uploaded</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                                <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-yellow-400">Admin Review</p>
                                <p className="text-xs text-slate-500">Waiting for verification...</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-500 text-sm">lock</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Access Granted</p>
                                <p className="text-xs text-slate-600">Full dashboard access after approval</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mb-6">
                        <div className="w-3 h-3 border border-slate-500 border-t-[#fb923c] rounded-full animate-spin"></div>
                        Auto-checking status...
                    </div>

                    <button onClick={logout} className="w-full py-3 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
