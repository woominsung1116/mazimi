// ---------------------------------------------------------------------------
// API client — connects to the Rust/Axum backend at API_BASE_URL.
//
// Auth token flow:
//   Call api.setToken(token) after login. All subsequent requests will
//   include `Authorization: Bearer <token>`. Call api.clearToken() on logout.
//
// All protected endpoints derive the user identity from the JWT on the server.
// No user_id is sent in request bodies or query params for authenticated routes.
// ---------------------------------------------------------------------------

import { useAuthStore } from "../store/auth";
import { cachedFetch, TTL } from "./cache";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

/** Read the current JWT synchronously from the Zustand auth store. */
function getToken(): string | null {
  return useAuthStore.getState().token;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired — attempt silent refresh before logging out
    const refreshed = await useAuthStore.getState().refreshAccessToken();
    if (refreshed) {
      const newToken = useAuthStore.getState().token;
      const retryRes = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
      if (retryRes.ok) return retryRes.json();
    }
    await useAuthStore.getState().logout();
    throw new Error("Unauthorized: session expired");
  }

  if (!res.ok) {
    let message = `API error: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Types — aligned to the Rust models in crates/core/src/models.rs
// ---------------------------------------------------------------------------

/** One step in a program's application guide (programs.application_steps JSONB) */
export interface ApplicationStep {
  step: number;
  title: string;
  description: string;
  url: string | null;
}

/** Matches the `Program` struct returned by GET /api/v1/programs/:id */
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
  /**
   * Step-by-step application guide. Present because the detail endpoint
   * flattens the `Program` row (#[serde(flatten)]) — may be absent on some
   * list payloads, so always guard before use.
   */
  application_steps?: ApplicationStep[] | null;
}

/** GET /api/v1/programs response envelope */
export interface ProgramListResponse {
  total: number;
  items: ApiProgram[];
}

// ---------------------------------------------------------------------------
// Application URL resolution
// ---------------------------------------------------------------------------

/**
 * Generic portal homepages that are NOT direct application pages. Deep-linking
 * a user here just dumps them on a landing page where they must search again,
 * so we treat these as a last resort behind any more specific URL.
 *
 * `finlife.fss.or.kr/main/main.do` is hardcoded for every FSS financial
 * product in the worker (financial.rs) because the FSS API returns no
 * per-product URL.
 */
const GENERIC_APPLY_URLS = ["finlife.fss.or.kr/main/main.do"];

function isGenericApplyUrl(url: string): boolean {
  // Anchor on the "//" scheme separator so "not-finlife.fss.or.kr" can't match
  // the "finlife.fss.or.kr" entry as a substring.
  return GENERIC_APPLY_URLS.some((generic) => url.includes(`//${generic}`));
}

/**
 * Only http/https URLs are safe to hand to Linking.openURL. Program URLs come
 * from external gov APIs and the DB, so reject other schemes (javascript:,
 * file:, intent:, etc.) before deep-linking.
 */
function isSafeWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Titles that mark an application_steps entry as the actual "go apply" step. */
const APPLY_STEP_HINTS = ["신청", "접속", "로그인", "지원", "발급"];

/**
 * Resolve the best "직행" (direct-jump) application URL for a program.
 *
 * Priority:
 *   1. `official_url` when it's a real apply page (not a generic portal)
 *   2. the most specific URL from `application_steps` — a 신청/접속/로그인 step
 *   3. any non-generic step URL
 *   4. `official_url` even if generic (better than nothing)
 *
 * Returns `null` when no usable URL exists.
 */
export function resolveApplyUrl(program: {
  official_url?: string | null;
  application_steps?: ApplicationStep[] | null;
}): string | null {
  const official = program.official_url?.trim() || null;
  const safeOfficial = official && isSafeWebUrl(official) ? official : null;
  if (safeOfficial && !isGenericApplyUrl(safeOfficial)) return safeOfficial;

  const stepUrls = (program.application_steps ?? [])
    .filter((s): s is ApplicationStep & { url: string } => !!s.url?.trim())
    .map((s) => ({ ...s, url: s.url.trim() }))
    .filter((s) => isSafeWebUrl(s.url));

  const hinted = stepUrls.find((s) =>
    APPLY_STEP_HINTS.some((hint) => s.title.includes(hint))
  );
  if (hinted) return hinted.url;

  const nonGeneric = stepUrls.find((s) => !isGenericApplyUrl(s.url));
  if (nonGeneric) return nonGeneric.url;

  return safeOfficial;
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
  nickname: string | null;
  profile_image_url: string | null;
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
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current user's ID from the Zustand auth store.
 * Throws if no user is authenticated.
 *
 * NOTE: Most API methods no longer require the caller to pass a user ID —
 * the server extracts identity from the JWT Bearer token automatically.
 * Use this only when you genuinely need the local user UUID (e.g. building
 * a cache key or logging).
 */
export function getCurrentUserId(): string {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    throw new Error("getCurrentUserId: no authenticated user");
  }
  return userId;
}

// ---------------------------------------------------------------------------
// API methods
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
    const cacheKey = `programs:list${qs ? `:${qs}` : ""}`;
    return cachedFetch(
      cacheKey,
      () => request<ProgramListResponse>(`/api/v1/programs${qs ? `?${qs}` : ""}`),
      TTL.PROGRAMS
    );
  },

  getProgram: (id: string): Promise<ApiProgram> =>
    request<ApiProgram>(`/api/v1/programs/${id}`),

  toggleBookmark: (programId: string): Promise<BookmarkResponse> =>
    request<BookmarkResponse>(`/api/v1/programs/${programId}/bookmark`, {
      method: "POST",
    }),

  // ── Recommendations ───────────────────────────────────────────────────────

  getRecommendPreview: (profile: ProfileInput): Promise<RecommendationResult> =>
    request<RecommendationResult>("/api/v1/recommend/preview", {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  // ── Dashboard ─────────────────────────────────────────────────────────────

  getDashboard: (): Promise<DashboardData> =>
    cachedFetch(
      "dashboard:me",
      () => request<DashboardData>("/api/v1/dashboard"),
      TTL.DASHBOARD
    ),

  // ── Alerts ────────────────────────────────────────────────────────────────

  getAlerts: (
    opts?: { limit?: number; offset?: number }
  ): Promise<AlertListResponse> => {
    const q = new URLSearchParams();
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.offset) q.set("offset", String(opts.offset));
    const qs = q.toString();
    return request<AlertListResponse>(`/api/v1/alerts${qs ? `?${qs}` : ""}`);
  },

  upsertAlertPreference: (
    programId: string,
    enabled: boolean
  ): Promise<unknown> =>
    request("/api/v1/alerts/preferences", {
      method: "POST",
      body: JSON.stringify({ program_id: programId, enabled }),
    }),

  // ── Profile ───────────────────────────────────────────────────────────────

  getProfile: (): Promise<UserProfileResponse> =>
    cachedFetch(
      "profile:me",
      () => request<UserProfileResponse>("/api/v1/profile"),
      TTL.PROFILE
    ),

  saveProfile: (profile: ProfileInput): Promise<UserProfileResponse> =>
    request<UserProfileResponse>("/api/v1/profile", {
      method: "POST",
      body: JSON.stringify(profile),
    }),

  // ── Application status tracking ───────────────────────────────────────────

  /**
   * Returns all programs the authenticated user has a status record for.
   * GET /api/v1/my/applications
   */
  getMyApplications: (): Promise<ApplicationListResponse> =>
    request<ApplicationListResponse>("/api/v1/my/applications"),

  /**
   * Returns status + full history for a single program.
   * Returns null when the user has never set a status for this program
   * (backend returns 404 in that case).
   * GET /api/v1/my/applications/{programId}
   */
  getApplicationStatus: async (
    programId: string
  ): Promise<ApplicationDetail | null> => {
    try {
      return await request<ApplicationDetail>(
        `/api/v1/my/applications/${programId}`
      );
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("API error: 404")) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Upserts the application status for one program.
   * PUT /api/v1/my/applications/{programId}
   * Body: { status, memo? }
   */
  updateApplicationStatus: (
    programId: string,
    status: ApplicationStatus,
    memo?: string
  ): Promise<UpdateStatusResponse> =>
    request<UpdateStatusResponse>(
      `/api/v1/my/applications/${programId}`,
      {
        method: "PUT",
        body: JSON.stringify({ status, memo: memo ?? null }),
      }
    ),

  // ── Saved / Bookmarks ────────────────────────────────────────────────────

  getSaved: (): Promise<{ items: ApiProgram[] }> =>
    request<{ items: ApiProgram[] }>("/api/v1/my/saved"),

  // ── Push notifications ─────────────────────────────────────────────────────

  /**
   * Registers an Expo push token for the authenticated user.
   * POST /api/v1/push/register
   * Body: { token, platform }  — user identity comes from JWT, not the body.
   */
  registerPushToken: (token: string, platform: string): Promise<unknown> =>
    request("/api/v1/push/register", {
      method: "POST",
      body: JSON.stringify({ token, platform }),
    }),

  /**
   * Removes all push tokens for the authenticated user.
   * DELETE /api/v1/push/register
   * No body required — user identity comes from JWT.
   */
  unregisterPushToken: (): Promise<unknown> =>
    request("/api/v1/push/register", {
      method: "DELETE",
    }),
};
