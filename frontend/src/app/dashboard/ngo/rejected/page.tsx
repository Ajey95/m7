"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiService } from "../../../../lib/api-service";
import { useAuth } from "../../../../lib/auth-context";
import { useToast } from "../../../../lib/toast-context";

export default function NgoRejectedPage() {
    const { user, logout } = useAuth();
    const { addToast } = useToast();
    const router = useRouter();
    const [rejectionReason, setRejectionReason] = useState<string>("");
    const [isResubmitting, setIsResubmitting] = useState(false);

    // Resubmit form state
    const [licenseNumber, setLicenseNumber] = useState("");
    const [licenseExpiry, setLicenseExpiry] = useState("");
    const [licenseFile, setLicenseFile] = useState<File | null>(null);
    const [regType, setRegType] = useState("DARPAN");

    useEffect(() => {
        const fetchStatus = async () => {
            const res = await apiService.getNgoStatus();
            if (res.data) {
                if (res.data.verification_status === "VERIFIED") {
                    router.push("/dashboard/ngo");
                } else if (res.data.verification_status === "PENDING") {
                    router.push("/dashboard/ngo/pending");
                }
                setRejectionReason(res.data.rejection_reason || "No reason provided");
            }
        };
        fetchStatus();
    }, [router]);

    const handleResubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsResubmitting(true);

        let documentUrl = "";
        if (licenseFile) {
            const uploadRes = await apiService.uploadLicenseFile(licenseFile);
            if (uploadRes.error) {
                addToast({ type: "error", title: "Upload Failed", message: uploadRes.error });
                setIsResubmitting(false);
                return;
            }
            documentUrl = uploadRes.data?.url || "";
        }

        const result = await apiService.submitNgoLicense({
            license_number: `${regType}-${licenseNumber}`,
            license_expiry: licenseExpiry,
            license_document_url: documentUrl || undefined,
        });

        if (result.error) {
            addToast({ type: "error", title: "Resubmission Failed", message: result.error });
        } else {
            addToast({ type: "success", title: "Resubmitted!", message: "Your application has been resubmitted for review" });
            router.push("/dashboard/ngo/pending");
        }

        setIsResubmitting(false);
    };

    const inputClass = "w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#fb923c]/50 focus:border-[#fb923c] transition-all";

    return (
        <div className="min-h-screen text-white flex items-center justify-center px-4 py-8 relative overflow-hidden">
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

                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-400 text-3xl">gpp_bad</span>
                    </div>

                    <h1 className="text-2xl font-bold text-center mb-2">Application Rejected</h1>
                    <p className="text-slate-400 text-center mb-4">Your NGO license verification was unsuccessful.</p>

                    {/* Rejection Reason */}
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                        <p className="text-sm font-medium text-red-400 mb-1">Reason for Rejection</p>
                        <p className="text-sm text-slate-300">{rejectionReason}</p>
                    </div>

                    {/* Resubmit Form */}
                    <div className="border-t border-white/10 pt-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#fb923c]">refresh</span>
                            Resubmit License
                        </h2>

                        <form onSubmit={handleResubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Registration Type</label>
                                <select value={regType} onChange={(e) => setRegType(e.target.value)} className={inputClass}>
                                    <option value="DARPAN">NGO DARPAN ID</option>
                                    <option value="FCRA">FCRA Registration</option>
                                    <option value="TRUST">Trust Registration</option>
                                    <option value="SOCIETY">Society Registration</option>
                                    <option value="SEC8">Section 8 Company</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">License Number</label>
                                <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="XXXXXXXXXX" className={inputClass} required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">License Expiry</label>
                                <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className={inputClass} required min={new Date().toISOString().split("T")[0]} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Upload New Document</label>
                                <div className={`border-2 border-dashed rounded-xl p-4 text-center ${licenseFile ? "border-green-500/40 bg-green-500/5" : "border-white/10"}`}>
                                    {licenseFile ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-green-400">description</span>
                                            <span className="text-sm text-white">{licenseFile.name}</span>
                                            <button type="button" onClick={() => setLicenseFile(null)} className="text-red-400 hover:text-red-300">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer">
                                            <span className="material-symbols-outlined text-slate-500 text-2xl">cloud_upload</span>
                                            <p className="text-sm text-[#fb923c] font-medium mt-1">Browse Files</p>
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => e.target.files?.[0] && setLicenseFile(e.target.files[0])} />
                                        </label>
                                    )}
                                </div>
                            </div>

                            <button type="submit" disabled={isResubmitting} className="w-full h-12 bg-[#fb923c] hover:bg-orange-400 text-slate-900 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(251,146,60,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                {isResubmitting ? (
                                    <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span>Resubmit Application</span>
                                        <span className="material-symbols-outlined text-xl">send</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <button onClick={logout} className="w-full mt-4 py-3 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm">
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}
