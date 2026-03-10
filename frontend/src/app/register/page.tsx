"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiService } from "../../lib/api-service";
import { useToast } from "../../lib/toast-context";

type Role = "DONOR" | "NGO" | "VOLUNTEER" | "DISPATCHER";

const ROLE_CONFIG: Record<Role, {
    label: string; icon: string; color: string; glow: string;
    accent: string; desc: string; borderCard: string; bgCard: string;
}> = {
    DONOR: {
        label: "Donor",
        icon: "volunteer_activism",
        color: "from-green-500 to-emerald-600",
        glow: "rgba(34,197,94,0.4)",
        accent: "ring-green-500/50 border-green-500",
        desc: "I have surplus food to donate",
        bgCard: "from-green-900/30 to-emerald-900/20",
        borderCard: "border-green-500/50",
    },
    NGO: {
        label: "NGO Partner",
        icon: "home_work",
        color: "from-blue-500 to-indigo-600",
        glow: "rgba(59,130,246,0.4)",
        accent: "ring-blue-500/50 border-blue-500",
        desc: "Organization that receives & distributes food",
        bgCard: "from-blue-900/30 to-indigo-900/20",
        borderCard: "border-blue-500/50",
    },
    VOLUNTEER: {
        label: "Volunteer",
        icon: "directions_bike",
        color: "from-orange-500 to-amber-600",
        glow: "rgba(249,115,22,0.4)",
        accent: "ring-orange-500/50 border-orange-500",
        desc: "I pick up and deliver food donations",
        bgCard: "from-orange-900/30 to-amber-900/20",
        borderCard: "border-orange-500/50",
    },
    DISPATCHER: {
        label: "Dispatcher",
        icon: "satellite_alt",
        color: "from-purple-500 to-violet-600",
        glow: "rgba(168,85,247,0.4)",
        accent: "ring-purple-500/50 border-purple-500",
        desc: "Platform coordinator & operations staff",
        bgCard: "from-purple-900/30 to-violet-900/20",
        borderCard: "border-purple-500/50",
    },
};

const VEHICLE_TYPES = [
    { value: "BIKE", label: "Bicycle", icon: "directions_bike" },
    { value: "SCOOTER", label: "Scooter", icon: "two_wheeler" },
    { value: "CAR", label: "Car", icon: "directions_car" },
    { value: "VAN", label: "Van", icon: "airport_shuttle" },
];

function RegisterForm() {
    const router = useRouter();
    const { addToast } = useToast();
    const [step, setStep] = useState<"role" | "form">("role");
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        password: "",
        confirmPassword: "",
        vehicle_type: "BIKE",
        vehicle_plate: "",
        admin_code: "",
        latitude: undefined as number | undefined,
        longitude: undefined as number | undefined,
    });
    const [gpsLoading, setGpsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fetchGPS = () => {
        if (!navigator.geolocation) {
            addToast({ type: "error", title: "Not supported", message: "Geolocation is not supported by your browser" });
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                // Reverse-geocode via Nominatim (free, no API key needed)
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
                        { headers: { "Accept-Language": "en" } }
                    );
                    const data = await res.json();
                    const addr = data.display_name as string | undefined;
                    setFormData(prev => ({ ...prev, latitude, longitude, address: addr ?? prev.address }));
                    addToast({ type: "success", title: "Location fetched", message: addr ? "Address auto-filled" : "GPS coordinates saved" });
                } catch {
                    setFormData(prev => ({ ...prev, latitude, longitude }));
                    addToast({ type: "success", title: "Location fetched", message: "GPS coordinates saved" });
                }
                setGpsLoading(false);
            },
            (err) => {
                setGpsLoading(false);
                addToast({ type: "error", title: "GPS error", message: err.message });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleRoleSelect = (role: Role) => {
        setSelectedRole(role);
        setStep("form");
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            addToast({ type: "error", title: "Error", message: "Passwords do not match" });
            return;
        }

        if (selectedRole === "DISPATCHER") {
            const expectedCode = process.env.NEXT_PUBLIC_DISPATCHER_INVITE_CODE || "DISPATCH2024";
            if (formData.admin_code !== expectedCode) {
                setError("Invalid dispatcher invite code. Contact your administrator.");
                addToast({ type: "error", title: "Access Denied", message: "Invalid invite code" });
                return;
            }
        }

        setIsLoading(true);

        const payload: Record<string, unknown> = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
            role: selectedRole!,
            address: formData.address,
            ...(formData.latitude !== undefined && { latitude: formData.latitude }),
            ...(formData.longitude !== undefined && { longitude: formData.longitude }),
        };

        if (selectedRole === "VOLUNTEER") {
            payload.vehicle_type = formData.vehicle_type;
            payload.vehicle_plate = formData.vehicle_plate;
        }

        const result = await apiService.register(payload as Parameters<typeof apiService.register>[0]);

        if (result.error) {
            setError(result.error);
            addToast({ type: "error", title: "Registration Failed", message: result.error });
        } else {
            addToast({ type: "success", title: "Account Created!", message: "Please sign in to continue" });
            router.push("/login?registered=true");
        }

        setIsLoading(false);
    };

    const inputClass = "w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#fb923c]/50 focus:border-[#fb923c] transition-all";

    // --- Step 1: Role Selection ---
    if (step === "role") {
        return (
            <div className="min-h-screen text-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
                <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
                <div className="bg-nebula-parallax"></div>

                <div className="relative z-10 w-full max-w-2xl">
                    <Link href="/" className="flex items-center justify-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#fb923c] to-orange-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(251,146,60,0.4)]">
                            <span className="material-symbols-outlined text-white text-2xl">eco</span>
                        </div>
                        <span className="text-2xl font-bold">Surplus</span>
                    </Link>

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold mb-2">Create Your Account</h1>
                        <p className="text-slate-400">Choose your role to get started</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(([role, cfg]) => (
                            <button
                                key={role}
                                onClick={() => handleRoleSelect(role)}
                                className={`glass-card p-6 text-left border transition-all duration-200 hover:scale-[1.02] hover:shadow-xl group relative overflow-hidden ${cfg.borderCard} bg-gradient-to-br ${cfg.bgCard}`}
                            >
                                <div className="glass-highlight"></div>
                                <div className={`w-12 h-12 bg-gradient-to-br ${cfg.color} rounded-xl flex items-center justify-center mb-4 shadow-lg glow-icon`}
                                    data-glow={cfg.glow}>
                                    <span className="material-symbols-outlined text-white text-2xl">{cfg.icon}</span>
                                </div>
                                <h3 className="text-lg font-bold mb-1">{cfg.label}</h3>
                                <p className="text-slate-400 text-sm">{cfg.desc}</p>
                                <span className="material-symbols-outlined absolute bottom-5 right-5 text-slate-600 group-hover:text-slate-400 transition-colors text-xl">arrow_forward</span>
                            </button>
                        ))}
                    </div>

                    <p className="text-center text-slate-400 text-sm mt-8">
                        Already have an account?{" "}
                        <Link href="/login" className="text-[#fb923c] hover:text-orange-300 font-medium">Sign In</Link>
                    </p>
                </div>
            </div>
        );
    }

    // --- Step 2: Registration Form ---
    const cfg = ROLE_CONFIG[selectedRole!];

    return (
        <div className="min-h-screen text-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
            <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-[#020617]"></div>
            <div className="bg-nebula-parallax"></div>

            <div className="relative z-10 w-full max-w-md">
                <Link href="/" className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#fb923c] to-orange-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(251,146,60,0.4)]">
                        <span className="material-symbols-outlined text-white text-2xl">eco</span>
                    </div>
                    <span className="text-2xl font-bold">Surplus</span>
                </Link>

                <div className="glass-card p-8 relative">
                    <div className="glass-highlight"></div>

                    {/* Role badge */}
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={() => setStep("role")}
                            className="text-slate-400 hover:text-white transition-colors"
                            aria-label="Go back"
                        >
                            <span className="material-symbols-outlined text-xl">arrow_back</span>
                        </button>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${cfg.bgCard} border ${cfg.borderCard}`}>
                            <span className="material-symbols-outlined text-base">{cfg.icon}</span>
                            <span className="text-sm font-medium">{cfg.label}</span>
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold mb-1">Create Account</h1>
                    <p className="text-slate-400 text-sm mb-6">Fill in your details to register</p>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl mb-5 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Common fields */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                {selectedRole === "NGO" ? "Organization Name" : "Full Name"}
                            </label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange}
                                placeholder={selectedRole === "NGO" ? "NGO / Charity Name" : "Your Full Name"}
                                className={inputClass} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange}
                                placeholder="you@example.com" className={inputClass} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                                placeholder="+1 234 567 8900" className={inputClass} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Address</label>
                            <div className="flex gap-2">
                                <input type="text" name="address" value={formData.address} onChange={handleChange}
                                    placeholder="123 Main St, City" className={inputClass} required />
                                <button
                                    type="button"
                                    onClick={fetchGPS}
                                    disabled={gpsLoading}
                                    title="Use my current location"
                                    className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-slate-800/50 border border-white/10 rounded-xl text-slate-300 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {gpsLoading
                                        ? <div className="w-4 h-4 border-2 border-slate-500 border-t-[#fb923c] rounded-full animate-spin"></div>
                                        : <span className="material-symbols-outlined text-xl">my_location</span>
                                    }
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Used for delivery / pickup location.{" "}
                                {formData.latitude !== undefined && (
                                    <span className="text-green-400">📍 GPS coordinates saved</span>
                                )}
                            </p>
                        </div>

                        {/* VOLUNTEER extra fields */}
                        {selectedRole === "VOLUNTEER" && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Vehicle Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {VEHICLE_TYPES.map((v) => (
                                            <label key={v.value}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${formData.vehicle_type === v.value
                                                    ? "border-[#fb923c] bg-orange-500/10 text-white"
                                                    : "border-white/10 bg-slate-800/30 text-slate-400 hover:border-white/20"}`}>
                                                <input type="radio" name="vehicle_type" value={v.value}
                                                    checked={formData.vehicle_type === v.value}
                                                    onChange={handleChange} className="sr-only" />
                                                <span className="material-symbols-outlined text-base">{v.icon}</span>
                                                <span className="text-sm font-medium">{v.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Vehicle Plate <span className="text-slate-500 font-normal">(optional)</span></label>
                                    <input type="text" name="vehicle_plate" value={formData.vehicle_plate} onChange={handleChange}
                                        placeholder="e.g. ABC 1234" className={inputClass} />
                                </div>
                            </>
                        )}

                        {/* DISPATCHER invite code */}
                        {selectedRole === "DISPATCHER" && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Dispatcher Invite Code</label>
                                <input type="password" name="admin_code" value={formData.admin_code} onChange={handleChange}
                                    placeholder="Enter invite code" className={inputClass} required />
                                <p className="text-xs text-slate-500 mt-1">Provided by your operations administrator.</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange}
                                placeholder="Min. 8 characters" className={inputClass} required minLength={8} />
                            {/* Strength indicator */}
                            {formData.password.length > 0 && (() => {
                                const p = formData.password;
                                let score = 0;
                                if (p.length >= 8) score++;
                                if (/[A-Z]/.test(p)) score++;
                                if (/[0-9]/.test(p)) score++;
                                if (/[^A-Za-z0-9]/.test(p)) score++;
                                const levels = [
                                    { label: "Weak", color: "bg-red-500", text: "text-red-400" },
                                    { label: "Fair", color: "bg-yellow-500", text: "text-yellow-400" },
                                    { label: "Good", color: "bg-blue-500", text: "text-blue-400" },
                                    { label: "Strong", color: "bg-green-500", text: "text-green-400" },
                                ];
                                const lvl = levels[Math.max(0, score - 1)];
                                return (
                                    <div className="mt-2 space-y-1">
                                        <div className="flex gap-1">
                                            {[0,1,2,3].map(i => (
                                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? lvl.color : "bg-slate-700"}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs ${lvl.text}`}>{lvl.label} password
                                            {score < 4 && <span className="text-slate-500"> — add {!(/[A-Z]/.test(p)) ? "uppercase, " : ""}{!(/[0-9]/.test(p)) ? "number, " : ""}{!(/[^A-Za-z0-9]/.test(p)) ? "symbol" : ""}</span>}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                                placeholder="Re-enter your password" className={inputClass} required minLength={8} />
                            {formData.confirmPassword.length > 0 && (
                                <p className={`text-xs mt-1 ${formData.password === formData.confirmPassword ? "text-green-400" : "text-red-400"}`}>
                                    {formData.password === formData.confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-[#fb923c] hover:bg-orange-400 text-slate-900 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(251,146,60,0.3)] hover:shadow-[0_0_30px_rgba(251,146,60,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>Create Account</span>
                                    <span className="material-symbols-outlined text-xl">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-400 text-sm">
                            Already have an account?{" "}
                            <Link href="/login" className="text-[#fb923c] hover:text-orange-300 font-medium">Sign In</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-8 h-8 border-2 border-[#fb923c]/30 border-t-[#fb923c] rounded-full animate-spin"></div>
            </div>
        }>
            <RegisterForm />
        </Suspense>
    );
}
