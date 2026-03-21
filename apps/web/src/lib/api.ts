const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export interface Program {
  id: string;
  name: string;
  type: "정책" | "장학금";
  region: "부산" | "대구";
  benefitAmount: number;
  benefitUnit: string;
  deadline: string;
  summary: string;
  description: string;
  eligibility: string[];
  applicationUrl: string;
  organization: string;
}

export interface RecommendationResult {
  program: Program;
  matchScore: number;
  reasons: string[];
  missingChecks: string[];
}

export interface PreviewResponse {
  totalCount: number;
  estimatedMonthlyBenefit: number;
  recommendations: RecommendationResult[];
}

export interface ProfilePayload {
  region: string;
  birthYear: number;
  enrollmentStatus: string;
  schoolName?: string;
  incomeBracket?: number | null;
}

export type ApplicationStatus =
  | "interested"
  | "planning"
  | "applying"
  | "applied"
  | "received";

export interface SavedProgram {
  id: string;
  program: Program;
  savedAt: string;
}

export interface ApplicationItem {
  id: string;
  program: Program;
  status: ApplicationStatus;
  memo: string;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  label: string;
  done: boolean;
}

export interface DashboardData {
  estimatedMonthlyBenefit: number;
  estimatedSemesterBenefit: number;
  deadlineSoon: RecommendationResult[];
  applying: ApplicationItem[];
  saved: SavedProgram[];
  todos: TodoItem[];
}

export const USER_ID = "00000000-0000-0000-0000-000000000001";

export const api = {
  getPrograms: (params?: { type?: string; region?: string }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.region) query.set("region", params.region);
    const qs = query.toString();
    return request<{ programs: Program[] }>(
      `/api/v1/programs${qs ? `?${qs}` : ""}`
    );
  },

  getProgram: (id: string) =>
    request<Program>(`/api/v1/programs/${id}`),

  getPreview: (profile: ProfilePayload) =>
    request<PreviewResponse>("/api/v1/recommend/preview", {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  getProgramCount: (region?: string) => {
    const qs = region ? `?region=${region}` : "";
    return request<{ count: number }>(`/api/v1/programs/count${qs}`);
  },

  getDashboard: (userId: string) =>
    request<DashboardData>(`/api/v1/dashboard?user_id=${userId}`),

  getSaved: (userId: string) =>
    request<{ saved: SavedProgram[] }>(`/api/v1/my/saved?user_id=${userId}`),

  getApplications: (userId: string) =>
    request<{ applications: ApplicationItem[] }>(
      `/api/v1/my/applications?user_id=${userId}`
    ),

  toggleBookmark: (programId: string, userId: string) =>
    request<{ bookmarked: boolean }>(
      `/api/v1/programs/${programId}/bookmark`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      }
    ),

  updateApplicationStatus: (
    applicationId: string,
    status: ApplicationStatus,
    memo: string,
    userId: string
  ) =>
    request<ApplicationItem>(`/api/v1/my/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, memo, user_id: userId }),
    }),

  getAlerts: (userId: string) =>
    request<Alert[]>(`/api/v1/alerts?user_id=${userId}`),

  updateAlertPreferences: (userId: string, prefs: AlertPreferences) =>
    request<void>("/api/v1/alerts/preferences", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...prefs }),
    }),
};

// ── Alert types ──

export interface Alert {
  id: string;
  type: "deadline" | "new_program" | "profile_update";
  title: string;
  message: string;
  programTitle?: string;
  amount?: number;
  daysLeft?: number;
  createdAt: string;
  isRead: boolean;
}

export interface AlertPreferences {
  deadline: boolean;
  new_program: boolean;
  profile_update: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
  };
}

// ── Admin types ──

export interface AdminProgram {
  id: string;
  program_type: string;
  title: string;
  summary: string | null;
  provider_name: string | null;
  official_url: string | null;
  program_status: string;
  application_start_at: string | null;
  application_end_at: string | null;
  benefit_amount_monthly: number | null;
  benefit_amount_semester: number | null;
  benefit_amount_once: number | null;
  min_age: number | null;
  max_age: number | null;
  regions: string[] | null;
  deadline_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  total_programs: number;
  active_programs: number;
  total_users: number;
}

export interface CreateProgramInput {
  program_type: string;
  title: string;
  summary?: string;
  provider_name?: string;
  official_url?: string;
  benefit_amount_monthly?: number;
  benefit_amount_semester?: number;
  benefit_amount_once?: number;
  min_age?: number;
  max_age?: number;
  regions?: string[];
  deadline_at?: string;
  application_start_at?: string;
  application_end_at?: string;
  is_active?: boolean;
}

export interface UpdateProgramInput {
  program_type?: string;
  title?: string;
  summary?: string;
  provider_name?: string;
  official_url?: string;
  benefit_amount_monthly?: number;
  benefit_amount_semester?: number;
  benefit_amount_once?: number;
  min_age?: number;
  max_age?: number;
  regions?: string[];
  deadline_at?: string;
  application_start_at?: string;
  application_end_at?: string;
  is_active?: boolean;
}

export const adminApi = {
  getStats: () => request<AdminStats>("/api/v1/admin/stats"),

  listPrograms: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const qs = query.toString();
    return request<{ total: number; limit: number; offset: number; items: AdminProgram[] }>(
      `/api/v1/admin/programs${qs ? `?${qs}` : ""}`
    );
  },

  getProgram: (id: string) =>
    request<AdminProgram>(`/api/v1/programs/${id}`),

  createProgram: (input: CreateProgramInput) =>
    request<AdminProgram>("/api/v1/admin/programs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateProgram: (id: string, input: UpdateProgramInput) =>
    request<AdminProgram>(`/api/v1/admin/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  togglePublish: (id: string) =>
    request<{ id: string; is_active: boolean }>(
      `/api/v1/admin/programs/${id}/publish`,
      { method: "POST" }
    ),
};
