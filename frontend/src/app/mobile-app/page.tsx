"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth-context";

export default function MobileAppRedirect() {
    const { logout } = useAuth();

    const handleBackToLogin = () => {
        // Clear auth state so the route protection doesn't redirect back here
        logout();
    };

    return (
        <div className="min-h-screen text-white flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
            <div className="bg-nebula-parallax"></div>

            <div className="relative z-10 max-w-lg text-center">
                <div className="glass-card p-10 relative">
                    <div className="glass-highlight"></div>

                    <div className="w-20 h-20 bg-gradient-to-br from-[#fb923c] to-orange-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(251,146,60,0.4)] mx-auto mb-8">
                        <span className="material-symbols-outlined text-white text-4xl">mobile_friendly</span>
                    </div>

                    <h1 className="text-3xl font-bold mb-4">Mobile App Required</h1>
                    <p className="text-slate-400 mb-8 text-lg">
                        The web platform is designed for NGOs, Dispatchers, and Administrators.
                        <br /><br />
                        As a <span className="text-[#fb923c] font-medium">Donor</span> or <span className="text-green-400 font-medium">Volunteer</span>,
                        please download our mobile app to manage your activities.
                    </p>

                    <div className="flex flex-col gap-4">
                        <button className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl flex items-center justify-center gap-3 transition-all group">
                            <span className="material-symbols-outlined text-3xl group-hover:text-[#fb923c] transition-colors">android</span>
                            <div className="text-left">
                                <p className="text-xs text-slate-400">Get it on</p>
                                <p className="text-lg font-bold leading-none">Google Play</p>
                            </div>
                        </button>

                        <button className="w-full py-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl flex items-center justify-center gap-3 transition-all group">
                            <span className="material-symbols-outlined text-3xl group-hover:text-white transition-colors">apple</span>
                            <div className="text-left">
                                <p className="text-xs text-slate-400">Download on the</p>
                                <p className="text-lg font-bold leading-none">App Store</p>
                            </div>
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/10">
                        <Link href="/login" onClick={handleBackToLogin} className="text-sm text-slate-500 hover:text-white transition-colors">
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

