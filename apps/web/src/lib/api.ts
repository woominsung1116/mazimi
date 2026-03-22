const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

// ── Auth token helpers ──
//
// JWT is stored either in localStorage (key: "wello_token") or as a cookie
// (name: "wello_token"). The helper below checks both locations so that SSR
// and CSR callers each get the token via whichever mechanism was used at
// sign-in time.

function getAuthToken(): string | null {
  // localStorage is only available in browser contexts
  if (typeof window !== "undefined") {
    const fromStorage = window.localStorage.getItem("wello_token");
    if (fromStorage) return fromStorage;

    // Fall back to cookie
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("wello_token="));
    if (match) return match.split("=")[1] ?? null;
  }
  return null;
}

// ── API error class ──

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: unknown
  ) {
    super(`API error: ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

// ── Core fetch wrapper ──

async function request<T>(
  path: string,
  options?: RequestInit,
  authenticated = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, res.statusText, body);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json();
}

// Convenience wrappers to avoid passing the boolean everywhere
function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options, false);
}

function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options, true);
}

// ── Domain types ──

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

// Backend paginated list response shape for /api/v1/programs
export interface ProgramListResponse {
  items: Program[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export const USER_ID = "00000000-0000-0000-0000-000000000001";

export const api = {
  // Returns the paginated envelope from the backend.
  // Callers that previously expected `{ programs }` must use `.items` instead.
  getPrograms: (params?: {
    type?: string;
    region?: string;
    page?: number;
    per_page?: number;
  }): Promise<ProgramListResponse> => {
    const query = new URLSearchParams();
    if (params?.type) query.set("category", params.type);
    if (params?.region) query.set("region", params.region);
    if (params?.page != null) query.set("page", String(params.page));
    if (params?.per_page != null) query.set("per_page", String(params.per_page));
    const qs = query.toString();
    return publicRequest<ProgramListResponse>(
      `/api/v1/programs${qs ? `?${qs}` : ""}`
    );
  },

  getProgram: (id: string) =>
    publicRequest<Program>(`/api/v1/programs/${id}`),

  getPreview: (profile: ProfilePayload) =>
    publicRequest<PreviewResponse>("/api/v1/recommend/preview", {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  getProgramCount: (region?: string) => {
    const qs = region ? `?region=${region}` : "";
    return publicRequest<{ count: number }>(`/api/v1/programs/count${qs}`);
  },

  getDashboard: (userId: string) =>
    authRequest<DashboardData>(`/api/v1/dashboard?user_id=${userId}`),

  getSaved: (userId: string) =>
    authRequest<{ saved: SavedProgram[] }>(`/api/v1/my/saved?user_id=${userId}`),

  getApplications: (userId: string) =>
    authRequest<{ applications: ApplicationItem[] }>(
      `/api/v1/my/applications?user_id=${userId}`
    ),

  toggleBookmark: (programId: string, userId: string) =>
    authRequest<{ bookmarked: boolean }>(
      `/api/v1/programs/${programId}/bookmark`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      }
    ),

  // Backend route is PUT /api/v1/my/applications/{program_id}
  updateApplicationStatus: (
    applicationId: string,
    status: ApplicationStatus,
    memo: string,
    userId: string
  ) =>
    authRequest<ApplicationItem>(`/api/v1/my/applications/${applicationId}`, {
      method: "PUT",
      body: JSON.stringify({ status, memo, user_id: userId }),
    }),

  getAlerts: (userId: string) =>
    authRequest<Alert[]>(`/api/v1/alerts?user_id=${userId}`),

  updateAlertPreferences: (userId: string, prefs: AlertPreferences) =>
    authRequest<void>("/api/v1/alerts/preferences", {
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

// Backend list response shape for GET /api/v1/admin/programs
export interface AdminProgramListResponse {
  total: number;
  limit: number;
  offset: number;
  items: AdminProgram[];
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
  getStats: () => authRequest<AdminStats>("/api/v1/admin/stats"),

  triggerSync: () =>
    authRequest<{ status: string; message: string }>("/api/v1/admin/sync", {
      method: "POST",
    }),

  // Returns { total, limit, offset, items } — matches backend list_admin_programs response
  listPrograms: (params?: {
    limit?: number;
    offset?: number;
  }): Promise<AdminProgramListResponse> => {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const qs = query.toString();
    return authRequest<AdminProgramListResponse>(
      `/api/v1/admin/programs${qs ? `?${qs}` : ""}`
    );
  },

  // Single program detail: uses the public /api/v1/programs/{id} endpoint
  getProgram: (id: string) =>
    authRequest<AdminProgram>(`/api/v1/programs/${id}`),

  createProgram: (input: CreateProgramInput) =>
    authRequest<AdminProgram>("/api/v1/admin/programs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Backend handler is PUT /api/v1/admin/programs/{id}
  updateProgram: (id: string, input: UpdateProgramInput) =>
    authRequest<AdminProgram>(`/api/v1/admin/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  togglePublish: (id: string) =>
    authRequest<{ id: string; is_active: boolean }>(
      `/api/v1/admin/programs/${id}/publish`,
      { method: "POST" }
    ),
};
