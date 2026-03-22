/**
 * OfflineBanner — shared offline indicator
 *
 * Shows a yellow/amber banner when the app detects no connectivity.
 * Uses a periodic fetch-based connectivity check (no native module required).
 * Dismissible by the user.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing, borderRadius, layout } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Connectivity check — simple fetch ping (no native module dependency)
// ---------------------------------------------------------------------------

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://www.gstatic.com/generate_204", {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(id);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hook — polls connectivity every 10 s
// ---------------------------------------------------------------------------

function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const connected = await checkConnectivity();
      if (!cancelled) setOffline(!connected);
    }

    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return offline;
}

// ---------------------------------------------------------------------------
// Props — the component can also be driven externally (e.g. from a query error)
// ---------------------------------------------------------------------------

export interface OfflineBannerProps {
  /** Override the connectivity check — if true the banner is shown regardless */
  forceVisible?: boolean;
  /** Called when the user dismisses the banner */
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OfflineBanner({
  forceVisible,
  onDismiss,
}: OfflineBannerProps) {
  const detectedOffline = useIsOffline();
  const isOffline = forceVisible ?? detectedOffline;

  const [dismissed, setDismissed] = useState(false);
  const opacity = React.useRef(new Animated.Value(1)).current;

  // Reset dismissed state whenever connectivity flips back online then offline
  useEffect(() => {
    if (isOffline) setDismissed(false);
  }, [isOffline]);

  const handleDismiss = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
      onDismiss?.();
    });
  }, [opacity, onDismiss]);

  if (!isOffline || dismissed) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Ionicons name="warning-outline" size={16} color={styles.icon.color} />
      <Text style={styles.text} numberOfLines={1}>
        오프라인 모드 — 인터넷 연결을 확인해주세요
      </Text>
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="오프라인 배너 닫기"
      >
        <Ionicons name="close" size={16} color={styles.icon.color} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles — amber/yellow palette matching Material Design 3 warning tone
// ---------------------------------------------------------------------------

const AMBER_BG = "#fef9c3";   // yellow-100
const AMBER_BORDER = "#fde047"; // yellow-300
const AMBER_TEXT = "#854d0e";  // yellow-800

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: AMBER_BG,
    borderBottomWidth: 1,
    borderBottomColor: AMBER_BORDER,
    paddingVertical: spacing[2],
    paddingHorizontal: layout.pagePadding,
  },
  icon: {
    color: AMBER_TEXT,
  } as { color: string },
  text: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: AMBER_TEXT,
  },
});
