/**
 * ErrorMessage — shared user-friendly error display
 *
 * Maps common error types / HTTP status codes to Korean-language messages.
 * Includes a "다시 시도" retry button.
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
} from "@/constants/theme";

// ---------------------------------------------------------------------------
// Error → Korean message mapping
// ---------------------------------------------------------------------------

function resolveMessage(error: unknown): string {
  if (!error) return "문제가 발생했어요. 잠시 후 다시 시도해주세요";

  // Network-level errors (no response)
  const isNetworkError =
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.message.toLowerCase().includes("network") ||
        error.message.toLowerCase().includes("fetch") ||
        error.message.toLowerCase().includes("failed") ||
        error.message.toLowerCase().includes("abort")));

  if (isNetworkError) return "인터넷 연결을 확인해주세요";

  // HTTP status code errors
  const status =
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status;

  if (status === 401) return "다시 로그인해주세요";
  if (status === 404) return "정보를 찾을 수 없어요";
  if (status !== undefined && status >= 500) return "잠시 후 다시 시도해주세요";

  return "문제가 발생했어요. 잠시 후 다시 시도해주세요";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ErrorMessageProps {
  /** The raw error value — can be an Error, an Axios/fetch response, or null */
  error?: unknown;
  /** Override the derived message entirely */
  message?: string;
  /** Called when the user taps the retry button */
  onRetry?: () => void;
  /** Hide the retry button */
  hideRetry?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ErrorMessage({
  error,
  message,
  onRetry,
  hideRetry = false,
}: ErrorMessageProps) {
  const displayMessage = message ?? resolveMessage(error);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons
          name="alert-circle-outline"
          size={32}
          color={colors.error}
        />
      </View>

      <Text style={styles.message}>{displayMessage}</Text>

      {!hideRetry && onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Ionicons name="refresh-outline" size={16} color={colors.onPrimary} />
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[8],
    paddingHorizontal: layout.pagePadding,
    gap: spacing[4],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurface,
    textAlign: "center",
    lineHeight: typography.fontSize.base * 1.5,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    minHeight: layout.touchTargetMin,
    ...shadows.card,
  },
  retryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
});
