// ---------------------------------------------------------------------------
// Funnel event analytics — logging-only for now.
//
// Verified (2026-07): no amplitude/firebase/posthog/mixpanel/segment SDK is
// wired into this app yet (grepped apps/mobile — the only "firebase" hit is
// a privacy-policy sentence about FCM push, unrelated to analytics). This
// module gives funnel instrumentation ONE seam: call sites (`trackEvent(...)`)
// never change when a real analytics SDK is added later — only the body of
// `trackEvent` does.
//
// North-star metric this feeds: 추천 → 서류준비 → 신청 완결률
// (recommendation → document prep → application completion rate).
//
// SECURITY (CLAUDE.md #9): never log PII or tokens here, even in dev.
// `meta` may only carry short identifiers (program_id) and primitive flags —
// no names, emails, phone numbers, addresses, or auth tokens.
// ---------------------------------------------------------------------------

import { logger } from "./logger";

/** Funnel events tracked toward the 추천→서류준비→신청 완결률 north star. */
export type FunnelEvent =
  /** A recommendation list was rendered to the user. */
  | "recommendation_shown"
  /** User opened a program detail screen. */
  | "program_viewed"
  /** User entered the apply-assistant wizard for a program. */
  | "apply_assistant_started"
  /** User reached the 서류 확인 (documents) step of the wizard. */
  | "documents_step_reached"
  /** User tapped through to the official application site (외부 브라우저 딥링크 직행). */
  | "apply_link_opened";

/** Non-PII metadata attached to a funnel event. Keep this to IDs/flags only. */
export interface FunnelEventMeta {
  program_id?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Record a funnel event. Currently forwards to `logger.log` (a no-op in
 * production builds, visible in dev) so the funnel is inspectable during QA
 * without shipping a third-party SDK before one is chosen.
 *
 * TODO(#13): swap the body for a real analytics SDK call (amplitude.track /
 * posthog.capture / etc.) once one is selected — no call site needs to change.
 */
export function trackEvent(event: FunnelEvent, meta?: FunnelEventMeta): void {
  logger.log(`[funnel] ${event}`, meta ?? {});
}

/**
 * Hook wrapper for component call sites. `trackEvent` carries no internal
 * state, so this just re-exports a stable reference — kept as a hook so this
 * file has one obvious growth point (e.g. auto-attaching session context)
 * without having to touch every call site later.
 */
export function useAnalytics(): { trackEvent: typeof trackEvent } {
  return { trackEvent };
}
