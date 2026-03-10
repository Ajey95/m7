// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
    // Auth
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
    me: "/api/v1/auth/me",
    refreshToken: "/api/v1/auth/refresh",

    // Donations (backend path is /donors/tasks)
    donations: "/api/v1/donors/tasks",
    createDonation: "/api/v1/donors/tasks",
    donationById: (id: string) => `/api/v1/donors/tasks/${id}`,

    // Volunteers
    volunteers: "/api/v1/volunteers/",
    volunteerStatus: "/api/v1/volunteers/status",
    volunteerLocation: "/api/v1/volunteers/location",

    // Tasks
    tasks: "/api/v1/tasks",
    taskById: (id: string) => `/api/v1/tasks/${id}`,
    assignTask: (id: string) => `/api/v1/tasks/${id}/assign`,
    completeTask: (id: string) => `/api/v1/tasks/${id}/complete`,

    // NGO
    ngoProfile: "/api/v1/ngos/profile",
    ngoDashboard: "/api/v1/ngos/dashboard",
    ngoNearbyTasks: "/api/v1/ngos/nearby-tasks",
    ngoClaimedTasks: "/api/v1/ngos/claimed-tasks",
    ngoClaimTask: (id: string) => `/api/v1/ngos/tasks/${id}/claim`,
    ngoSubmitLicense: "/api/v1/ngos/me/license",
    ngoUploadLicense: "/api/v1/ngos/upload-license",
    ngoStatus: "/api/v1/ngos/me/status",

    // Dispatcher
    dispatcherTasks: "/api/v1/dispatcher/tasks",
    dispatcherAssign: (id: string) => `/api/v1/dispatcher/tasks/${id}/assign`,
    dispatcherStats: "/api/v1/dispatcher/stats",
    dispatcherNgos: "/api/v1/dispatcher/ngos",
    dispatcherDonors: "/api/v1/dispatcher/donors",
    dispatcherPendingVolunteers: "/api/v1/dispatcher/volunteers/pending",
    dispatcherApproveVolunteer: (id: string) => `/api/v1/dispatcher/volunteers/${id}/approve`,
    dispatcherRejectVolunteer: (id: string) => `/api/v1/dispatcher/volunteers/${id}/reject`,

    // Admin
    adminUsers: "/api/v1/admin/users",
    adminUserById: (id: string) => `/api/v1/admin/users/${id}`,
    adminNgos: "/api/v1/admin/ngos",
    adminApproveNgo: (id: string) => `/api/v1/admin/ngos/${id}/approve`,
    adminRejectNgo: (id: string) => `/api/v1/admin/ngos/${id}/reject`,
    adminRejectNgoWithReason: (id: string) => `/api/v1/admin/ngos/${id}/reject-with-reason`,
    adminExpiringNgos: "/api/v1/admin/ngos/expiring",
    adminStats: "/api/v1/admin/stats",
    adminDonations: "/api/v1/admin/donations",

    // Donor profile
    donorMe: "/api/v1/donors/me",
    donorDonations: "/api/v1/donors/tasks",

    // Volunteer profile
    volunteerMe: "/api/v1/volunteers/me",
    volunteerTasks: "/api/v1/tasks",

    // Analytics — Donor
    analyticsCredits: (donorId: string) => `/api/v1/analytics/donor/${donorId}/credits`,
    analyticsCO2: (donorId: string) => `/api/v1/analytics/donor/${donorId}/co2`,
    analyticsSuggestions: (donorId: string) => `/api/v1/analytics/donor/${donorId}/suggestions`,
    analyticsTaxReport: (donorId: string, fy?: string) =>
        `/api/v1/analytics/donor/${donorId}/tax-report${fy ? `?financial_year=${fy}` : ""}`,

    // Analytics — Volunteer
    analyticsVolunteerPerf: (volId: string) => `/api/v1/analytics/volunteer/${volId}/perf`,

    // Analytics — NGO
    analyticsNgoMeals: (ngoId: string, start?: string, end?: string) => {
        const params = new URLSearchParams();
        if (start) params.set("start_date", start);
        if (end) params.set("end_date", end);
        const qs = params.toString();
        return `/api/v1/analytics/ngo/${ngoId}/meals-report${qs ? `?${qs}` : ""}`;
    },
    analyticsNgoNutrition: (ngoId: string) => `/api/v1/analytics/ngo/${ngoId}/nutrition`,
    analyticsNgoSentiment: (ngoId: string) => `/api/v1/analytics/ngo/${ngoId}/sentiment`,
    analyticsDemandForecast: (ngoId?: string) =>
        `/api/v1/analytics/demand-forecast${ngoId ? `?ngo_id=${ngoId}` : ""}`,

    // Analytics — Admin/Public
    analyticsWasteHotspots: "/api/v1/analytics/waste-hotspots",
    analyticsCityImpact: "/api/v1/analytics/city-impact",
    analyticsSurplusPrediction: "/api/v1/analytics/surplus-prediction",
    analyticsFraudFlags: "/api/v1/analytics/fraud-flags",
    analyticsRouteEfficiency: "/api/v1/analytics/route-efficiency",
} as const;

// WebSocket URL
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
