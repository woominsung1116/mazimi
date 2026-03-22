// ---------------------------------------------------------------------------
// Production-safe logger
//
// In production builds (APP_ENV=production or Expo release channel) all
// console.log / console.debug calls are no-ops.  console.warn and
// console.error are always forwarded so runtime warnings and crashes remain
// visible in crash-reporting tools (e.g. Sentry).
//
// Usage: import { logger } from "../lib/logger";
//        logger.log("fetched profile", profile);   // silent in production
//        logger.warn("slow network");              // always printed
//        logger.error("payment failed", err);      // always printed
//
// SECURITY: Never pass raw user credentials, JWT tokens, or PII to any
// logger method — even in development.  Log IDs and status codes only.
// ---------------------------------------------------------------------------

const IS_PRODUCTION =
  process.env.EXPO_PUBLIC_APP_ENV === "production" ||
  process.env.NODE_ENV === "production";

type LogArgs = unknown[];

function noop(..._args: LogArgs): void {
  // intentionally empty — suppressed in production
}

export const logger = {
  /** Debug / informational — suppressed in production builds. */
  log: IS_PRODUCTION ? noop : (...args: LogArgs) => console.log(...args),

  /** Verbose details — suppressed in production builds. */
  debug: IS_PRODUCTION ? noop : (...args: LogArgs) => console.debug(...args),

  /** Warnings — always active. */
  warn: (...args: LogArgs) => console.warn(...args),

  /** Errors — always active. */
  error: (...args: LogArgs) => console.error(...args),
} as const;
