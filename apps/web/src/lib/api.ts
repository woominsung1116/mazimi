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

// ---------------------------------------------------------------------------
// Types — aligned to the Rust models (snake_case, matching backend responses)
// ---------------------------------------------------------------------------

/** Matches the `Program` struct returned by GET /api/v1/programs/{id} */
export interface ApiProgram {
  id: string;
  program_type: string;       // "scholarship" | "support" | etc.
  source_type: string;
  source_id: string | null;
  title: string;
  summary: string | null;
  provider_name: string | null;
  official_url: string | null;
  program_status: string;     // "open" | "closed" | "always_open" | etc.
  application_start_at: string | null;
  application_end_at: string | null;
  benefit_amount_monthly: number | null;
  benefit_amount_semester: number | null;
  benefit_amount_once: number | null;
  region_scope: unknown | null;
  school_scope: unknown | null;
  tags: unknown | null;
  min_age: number | null;
  max_age: number | null;
  regions: string[] | null;
  deadline_at: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/programs response envelope */
export interface ProgramListResponse {
  total: number;
  items: ApiProgram[];
}

/** Single item inside RecommendationResult.items */
export interface RecommendationItem {
  program_id: string;
  title: string;
  program_type: string;
  match_score: number;
  benefit_amount_monthly: number | null;
  benefit_amount_semester: number | null;
  deadline: string | null;
  reasons: string[];
  missing_checks: string[];
  official_url: string | null;
}

/** POST /api/v1/recommend/preview response */
export interface RecommendationResult {
  total_available: number;
  estimated_monthly: number;
  estimated_semester: number;
  items: RecommendationItem[];
}

/** POST /api/v1/recommend/preview request body — matches Rust ProfileInput */
export interface ProfileInput {
  birth_year: number;
  region_code: string;
  city_code?: string | null;
  school_name?: string | null;
  school_year?: number | null;
  enrollment_status?: string | null;
  employment_status?: string | null;
  major_group?: string | null;
  income_bracket?: number | null;
  kosaf_support_bracket?: number | null;
  housing_type?: string | null;
  household_size?: number | null;
  has_disability?: boolean | null;
  is_multicultural_family?: boolean | null;
  is_low_income_household?: boolean | null;
  veteran_family?: boolean | null;
  preferred_categories?: string[] | null;
  school_type?: string | null;
  age_band?: string | null;
}

/** GET /api/v1/dashboard response (user identity from JWT) */
export interface DashboardData {
  bookmarked_count: number;
  applying_count: number;
  upcoming_deadlines: ApiProgram[];
  estimated_monthly: number;
  estimated_semester: number;
  todo_items: string[];
}

/** Single alert item from GET /api/v1/alerts */
export interface AlertItem {
  id: string;
  user_id: string;
  program_id: string;
  alert_type: string;
  alert_date: string;
  program_title: string;
  official_url: string | null;
  deadline_at: string | null;
  application_end_at: string | null;
}

/** GET /api/v1/alerts response (user identity from JWT) */
export interface AlertListResponse {
  total: number;
  limit: number;
  offset: number;
  items: AlertItem[];
}

/** GET /api/v1/profile response (user identity from JWT) */
export interface UserProfileResponse {
  user_id: string;
  profile: UserProfile;
}

export interface UserProfile {
  user_id: string;
  birth_year: number | null;
  region_code: string | null;
  city_code: string | null;
  school_name: string | null;
  school_year: number | null;
  enrollment_status: string | null;
  employment_status: string | null;
  major_group: string | null;
  income_bracket: number | null;
  kosaf_support_bracket: number | null;
  housing_type: string | null;
  household_size: number | null;
  has_disability: boolean;
  is_multicultural_family: boolean;
  is_low_income_household: boolean;
  veteran_family: boolean;
  preferred_categories: string[];
  school_type: string | null;
  age_band: string | null;
  profile_version: number;
  updated_at: string;
}

/** POST /api/v1/programs/{id}/bookmark response */
export interface BookmarkResponse {
  bookmarked: boolean;
}

// Application status values as used by the backend
export type ApplicationStatus =
  | "interested"
  | "planning"
  | "applying"
  | "applied"
  | "waiting"
  | "received"
  | "abandoned";

/** Single history entry inside ApplicationDetail */
export interface StateHistoryEntry {
  state: ApplicationStatus;
  memo: string | null;
  changed_at: string;
}

/** GET /api/v1/my/applications/{program_id} (user identity from JWT) */
export interface ApplicationDetail {
  program_id: string;
  program_title: string;
  current_status: ApplicationStatus;
  memo: string | null;
  applied_at: string | null;
  result_at: string | null;
  updated_at: string;
  history: StateHistoryEntry[];
}

/** GET /api/v1/my/applications (user identity from JWT) */
export interface ApplicationListResponse {
  total: number;
  items: ApplicationDetail[];
}

/** PUT /api/v1/my/applications/{program_id} response (user identity from JWT) */
export interface UpdateStatusResponse {
  program_id: string;
  status: ApplicationStatus;
  memo: string | null;
  applied_at: string | null;
  result_at: string | null;
  updated_at: string;
}

/** Alert preference payload for POST /api/v1/alerts/preferences */
export interface AlertPreferences {
  program_id: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a benefit amount into a human-readable Korean label. */
export function formatBenefit(program: ApiProgram): string {
  if (program.benefit_amount_monthly) {
    const m = Math.round(program.benefit_amount_monthly / 10000);
    return `월 ${m}만원`;
  }
  if (program.benefit_amount_semester) {
    const s = Math.round(program.benefit_amount_semester / 10000);
    return `학기 ${s}만원`;
  }
  if (program.benefit_amount_once) {
    const o = Math.round(program.benefit_amount_once / 10000);
    return `최대 ${o}만원`;
  }
  return "혜택 확인";
}

/** Map program_type English key to Korean display label. */
export function programTypeLabel(programType: string): string {
  switch (programType) {
    case "scholarship":
      return "장학금";
    case "support":
    case "youth_policy":
      return "청년정책";
    case "welfare":
      return "복지/생활";
    default:
      return programType;
  }
}

/** Map program_status to a Korean status label. */
export function programStatusLabel(status: string, deadlineAt: string | null): string {
  if (status === "always_open") return "상시";
  if (status === "closed") return "마감";
  if (deadlineAt) {
    const days = Math.ceil(
      (new Date(deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 0) return "마감";
    if (days <= 30) return `D-${days}`;
    return "신청 중";
  }
  return "신청 중";
}

// ---------------------------------------------------------------------------
// API methods
// All protected endpoints derive the user identity from the JWT on the server.
// No user_id is sent in request bodies or query params for authenticated routes.
// ---------------------------------------------------------------------------

export const api = {
  // ── Programs ──────────────────────────────────────────────────────────────

  getPrograms: (params?: {
    program_type?: string;
    region?: string;
  }): Promise<ProgramListResponse> => {
    const query = new URLSearchParams();
    if (params?.program_type) query.set("program_type", params.program_type);
    if (params?.region) query.set("region", params.region);
    const qs = query.toString();
    return publicRequest<ProgramListResponse>(
      `/api/v1/programs${qs ? `?${qs}` : ""}`
    );
  },

  getProgram: (id: string): Promise<ApiProgram> =>
    publicRequest<ApiProgram>(`/api/v1/programs/${id}`),

  toggleBookmark: (programId: string): Promise<BookmarkResponse> =>
    authRequest<BookmarkResponse>(`/api/v1/programs/${programId}/bookmark`, {
      method: "POST",
    }),

  // ── Recommendations ───────────────────────────────────────────────────────

  getRecommendPreview: (profile: ProfileInput): Promise<RecommendationResult> =>
    publicRequest<RecommendationResult>("/api/v1/recommend/preview", {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  // ── Dashboard ─────────────────────────────────────────────────────────────

  getDashboard: (): Promise<DashboardData> =>
    authRequest<DashboardData>("/api/v1/dashboard"),

  // ── Alerts ────────────────────────────────────────────────────────────────

  getAlerts: (
    opts?: { limit?: number; offset?: number }
  ): Promise<AlertListResponse> => {
    const q = new URLSearchParams();
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.offset) q.set("offset", String(opts.offset));
    const qs = q.toString();
    return authRequest<AlertListResponse>(`/api/v1/alerts${qs ? `?${qs}` : ""}`);
  },

  upsertAlertPreference: (
    programId: string,
    enabled: boolean
  ): Promise<unknown> =>
    authRequest("/api/v1/alerts/preferences", {
      method: "POST",
      body: JSON.stringify({ program_id: programId, enabled }),
    }),

  // ── Profile ───────────────────────────────────────────────────────────────

  getProfile: (): Promise<UserProfileResponse> =>
    authRequest<UserProfileResponse>("/api/v1/profile"),

  saveProfile: (profile: ProfileInput): Promise<UserProfileResponse> =>
    authRequest<UserProfileResponse>("/api/v1/profile", {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  // ── Application status tracking ───────────────────────────────────────────

  getMyApplications: (): Promise<ApplicationListResponse> =>
    authRequest<ApplicationListResponse>("/api/v1/my/applications"),

  getApplicationStatus: async (
    programId: string
  ): Promise<ApplicationDetail | null> => {
    try {
      return await authRequest<ApplicationDetail>(
        `/api/v1/my/applications/${programId}`
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  updateApplicationStatus: (
    programId: string,
    status: ApplicationStatus,
    memo?: string
  ): Promise<UpdateStatusResponse> =>
    authRequest<UpdateStatusResponse>(
      `/api/v1/my/applications/${programId}`,
      {
        method: "PUT",
        body: JSON.stringify({ status, memo: memo ?? null }),
      }
    ),

  // ── Saved / Bookmarks ────────────────────────────────────────────────────

  getSaved: (): Promise<{ items: ApiProgram[] }> =>
    authRequest<{ items: ApiProgram[] }>("/api/v1/my/saved"),

  // ── Program count ─────────────────────────────────────────────────────────

  getProgramCount: (region?: string) => {
    const qs = region ? `?region=${region}` : "";
    return publicRequest<{ count: number }>(`/api/v1/programs/count${qs}`);
  },
};

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

  getProgram: (id: string) =>
    authRequest<AdminProgram>(`/api/v1/programs/${id}`),

  createProgram: (input: CreateProgramInput) =>
    authRequest<AdminProgram>("/api/v1/admin/programs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

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
