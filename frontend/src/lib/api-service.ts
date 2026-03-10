import { API_BASE_URL, API_ENDPOINTS } from "./api-config";

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    status: number;
}

class ApiService {
    private getToken(): string | null {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("auth_token");
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const token = this.getToken();

        const headers: HeadersInit = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (token) {
            (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers,
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                let errorMsg = "Request failed";
                if (data?.detail) {
                    if (typeof data.detail === "string") {
                        errorMsg = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        // Pydantic validation errors: [{type, loc, msg, input}, ...]
                        errorMsg = data.detail.map((e: { msg?: string; loc?: string[] }) => e.msg || JSON.stringify(e)).join("; ");
                    } else {
                        errorMsg = JSON.stringify(data.detail);
                    }
                } else if (data?.message) {
                    errorMsg = data.message;
                }
                return {
                    error: errorMsg,
                    status: response.status,
                };
            }

            return { data, status: response.status };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : "Network error",
                status: 0,
            };
        }
    }

    // Auth
    async login(email: string, password: string) {
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.login}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.detail || "Login failed", status: response.status };
        }

        localStorage.setItem("auth_token", data.access_token);
        return { data, status: response.status };
    }

    async register(userData: {
        name: string;
        email: string;
        phone: string;
        password: string;
        role: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        vehicle_type?: string;
        vehicle_plate?: string;
    }) {
        // Map frontend field names to backend schema (UserCreate)
        const { name, phone, vehicle_plate, ...rest } = userData;
        const payload: Record<string, unknown> = {
            ...rest,
            full_name: name,
            phone_number: phone,
        };
        if (vehicle_plate) payload.vehicle_plate = vehicle_plate;
        return this.request(API_ENDPOINTS.register, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    }

    async getMe() {
        return this.request<{
            id: string;
            name: string;
            email: string;
            role: string;
            verification_status?: string;
        }>(API_ENDPOINTS.me);
    }

    logout() {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
    }

    // Donations
    async getDonations() {
        return this.request<any[]>(API_ENDPOINTS.donations);
    }

    async createDonation(donationData: {
        food_type: string;
        quantity_kg: number;
        pickup_address?: string;
        pickup_lat: number;
        pickup_lng: number;
        expiry_time?: string;
        description?: string;
    }) {
        return this.request(API_ENDPOINTS.createDonation, {
            method: "POST",
            body: JSON.stringify(donationData),
        });
    }

    // Volunteers
    async getVolunteers() {
        return this.request<any[]>(API_ENDPOINTS.volunteers);
    }

    async updateVolunteerStatus(isOnline: boolean) {
        return this.request(API_ENDPOINTS.volunteerStatus, {
            method: "PATCH",
            body: JSON.stringify({ is_available: isOnline }),
        });
    }

    async updateVolunteerLocation(lat: number, lng: number) {
        return this.request(API_ENDPOINTS.volunteerLocation, {
            method: "PATCH",
            body: JSON.stringify({ latitude: lat, longitude: lng }),
        });
    }

    // Tasks
    async getTasks() {
        return this.request<any[]>(API_ENDPOINTS.tasks);
    }

    async getTaskById(id: string) {
        return this.request<any>(API_ENDPOINTS.taskById(id));
    }

    async assignTask(taskId: string, volunteerId: string) {
        return this.request(API_ENDPOINTS.assignTask(taskId), {
            method: "POST",
            body: JSON.stringify({ volunteer_id: volunteerId }),
        });
    }

    async completeTask(taskId: string, verificationData?: any) {
        return this.request(API_ENDPOINTS.completeTask(taskId), {
            method: "POST",
            body: JSON.stringify(verificationData || {}),
        });
    }

    // NGO
    async getNgoProfile() {
        return this.request<any>(API_ENDPOINTS.ngoProfile);
    }

    async getNgoDashboard() {
        return this.request<any>(API_ENDPOINTS.ngoDashboard);
    }

    async getNgoNearbyTasks() {
        return this.request<any[]>(API_ENDPOINTS.ngoNearbyTasks);
    }

    async getNgoClaimedTasks() {
        return this.request<any[]>(API_ENDPOINTS.ngoClaimedTasks);
    }

    async claimTask(taskId: string, branchId?: string) {
        return this.request(API_ENDPOINTS.ngoClaimTask(taskId), {
            method: "POST",
            body: JSON.stringify({ branch_id: branchId }),
        });
    }

    // Dispatcher
    async getDispatcherTasks() {
        return this.request<any[]>(API_ENDPOINTS.dispatcherTasks);
    }

    async dispatcherAssignTask(taskId: string, volunteerId: string) {
        return this.request(API_ENDPOINTS.dispatcherAssign(taskId), {
            method: "POST",
            body: JSON.stringify({ volunteer_id: volunteerId }),
        });
    }

    async getDispatcherStats() {
        return this.request<any>(API_ENDPOINTS.dispatcherStats);
    }

    async getDispatcherNgos() {
        return this.request<any[]>(API_ENDPOINTS.dispatcherNgos);
    }

    async getDispatcherDonors() {
        return this.request<any[]>(API_ENDPOINTS.dispatcherDonors);
    }

    async getPendingVolunteers() {
        return this.request<any[]>(API_ENDPOINTS.dispatcherPendingVolunteers);
    }

    async approveVolunteer(id: string) {
        return this.request(API_ENDPOINTS.dispatcherApproveVolunteer(id), {
            method: "PATCH",
        });
    }

    async rejectVolunteer(id: string) {
        return this.request(API_ENDPOINTS.dispatcherRejectVolunteer(id), {
            method: "PATCH",
        });
    }

    // Admin
    async getAdminUsers() {
        return this.request<any[]>(API_ENDPOINTS.adminUsers);
    }

    async getAdminUserById(id: string) {
        return this.request<any>(API_ENDPOINTS.adminUserById(id));
    }

    async updateUser(id: string, userData: any) {
        return this.request(API_ENDPOINTS.adminUserById(id), {
            method: "PATCH",
            body: JSON.stringify(userData),
        });
    }

    async deleteUser(id: string) {
        return this.request(API_ENDPOINTS.adminUserById(id), {
            method: "DELETE",
        });
    }

    async getAdminNgos() {
        return this.request<any[]>(API_ENDPOINTS.adminNgos);
    }

    async approveNgo(id: string) {
        return this.request(API_ENDPOINTS.adminApproveNgo(id), {
            method: "POST",
        });
    }

    async rejectNgo(id: string, reason?: string) {
        if (reason) {
            return this.request(API_ENDPOINTS.adminRejectNgoWithReason(id), {
                method: "POST",
                body: JSON.stringify({ reason }),
            });
        }
        return this.request(API_ENDPOINTS.adminRejectNgo(id), {
            method: "POST",
        });
    }

    async getAdminStats() {
        return this.request<{
            users: { total: number; volunteers: number; ngos: number; donors: number };
            volunteers: { online: number; busy: number; offline: number };
            ngos: { pending: number; approved: number; rejected: number };
            tasks: { total: number; pending: number; assigned: number; in_progress: number; completed: number; cancelled: number; this_week: number };
        }>(API_ENDPOINTS.adminStats);
    }

    async getAdminDonations() {
        return this.request<any[]>(API_ENDPOINTS.adminDonations);
    }

    // NGO License
    async submitNgoLicense(data: {
        license_number: string;
        license_expiry: string;
        license_document_url?: string;
    }) {
        return this.request(API_ENDPOINTS.ngoSubmitLicense, {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    async uploadLicenseFile(file: File) {
        const token = this.getToken();
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ngoUploadLicense}`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                return { error: data?.detail || "Upload failed", status: response.status };
            }
            return { data, status: response.status };
        } catch (error) {
            return { error: "Upload failed", status: 0 };
        }
    }

    async getNgoStatus() {
        return this.request<{
            verification_status: string;
            rejection_reason?: string;
            verified_at?: string;
            license_number?: string;
            license_expiry?: string;
        }>(API_ENDPOINTS.ngoStatus);
    }

    async getExpiringNgos() {
        return this.request<any[]>(API_ENDPOINTS.adminExpiringNgos);
    }

    // ── Donor profile ──────────────────────────────────────────
    async getDonorProfile() {
        return this.request<any>(API_ENDPOINTS.donorMe);
    }

    // ── Volunteer profile ──────────────────────────────────────
    async getVolunteerProfile() {
        return this.request<any>(API_ENDPOINTS.volunteerMe);
    }

    // ── Analytics: Donor ──────────────────────────────────────
    async getAnalyticsCredits(donorId: string) {
        return this.request<any>(API_ENDPOINTS.analyticsCredits(donorId));
    }

    async getAnalyticsCO2(donorId: string) {
        return this.request<any>(API_ENDPOINTS.analyticsCO2(donorId));
    }

    async getAnalyticsSuggestions(donorId: string) {
        return this.request<any>(API_ENDPOINTS.analyticsSuggestions(donorId));
    }

    async getAnalyticsTaxReport(donorId: string, financialYear?: string) {
        return this.request<any>(API_ENDPOINTS.analyticsTaxReport(donorId, financialYear));
    }

    // ── Analytics: Volunteer ──────────────────────────────────
    async getAnalyticsVolunteerPerf(volunteerId: string) {
        return this.request<any>(API_ENDPOINTS.analyticsVolunteerPerf(volunteerId));
    }

    // ── Analytics: NGO ───────────────────────────────────────
    async getAnalyticsNgoMeals(ngoId: string, startDate?: string, endDate?: string) {
        return this.request<any>(API_ENDPOINTS.analyticsNgoMeals(ngoId, startDate, endDate));
    }

    async getAnalyticsNgoNutrition(ngoId: string) {
        return this.request<any>(API_ENDPOINTS.analyticsNgoNutrition(ngoId));
    }

    async getAnalyticsNgoSentiment(ngoId: string) {
        return this.request<any>(API_ENDPOINTS.analyticsNgoSentiment(ngoId));
    }

    async getAnalyticsDemandForecast(ngoId?: string) {
        return this.request<any>(API_ENDPOINTS.analyticsDemandForecast(ngoId));
    }

    // ── Analytics: Admin/Public ───────────────────────────────
    async getAnalyticsWasteHotspots() {
        return this.request<any>(API_ENDPOINTS.analyticsWasteHotspots);
    }

    async getAnalyticsCityImpact() {
        return this.request<any>(API_ENDPOINTS.analyticsCityImpact);
    }

    async getAnalyticsSurplusPrediction() {
        return this.request<any>(API_ENDPOINTS.analyticsSurplusPrediction);
    }

    async getAnalyticsFraudFlags() {
        return this.request<any>(API_ENDPOINTS.analyticsFraudFlags);
    }

    async getAnalyticsRouteEfficiency() {
        return this.request<any>(API_ENDPOINTS.analyticsRouteEfficiency);
    }
}

export const apiService = new ApiService();
