/**
 * 놓친 돈 계산기 — shown once after onboarding step 3 completes.
 *
 * Flow: onboarding/step3 → /calculator → /(tabs)
 *
 * - Fetches recommendation preview using the onboarding profile
 * - Animated counter counts up from 0 to the estimated annual benefit
 * - Breakdown cards by program_type
 * - CTA and secondary link both navigate to /(tabs)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
import { api, type RecommendationResult, type RecommendationItem } from "@/lib/api";
import { colors, typography, borderRadius, layout, shadows } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_KEY = "majimi_preview_cache_v2";
const COUNTER_DURATION_MS = 1800;

// Breakdown category config — order matters for display
const BREAKDOWN_CATEGORIES: {
  key: string;
  label: string;
  showMonthly: boolean;
}[] = [
  { key: "scholarship", label: "장학금", showMonthly: true },
  { key: "youth_policy", label: "청년 정책", showMonthly: true },
  { key: "welfare", label: "복지/생활", showMonthly: false },
  { key: "financial", label: "금융상품", showMonthly: false },
  { key: "corporate", label: "기업 혜택", showMonthly: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProfileInput(params: {
  region: string;
  birthYear: number;
  enrollmentStatus: string;
  employmentStatus: string;
  schoolName?: string | null;
  incomeBracket?: number | null;
}) {
  return {
    birth_year: params.birthYear,
    region_code: params.region,
    enrollment_status: params.enrollmentStatus || null,
    employment_status: params.employmentStatus || null,
    school_name: params.schoolName || null,
    income_bracket: params.incomeBracket ?? null,
  };
}

/** Estimated annual amount: monthly * 12 + semester * 2 */
function calcAnnual(result: RecommendationResult): number {
  return result.estimated_monthly * 12 + result.estimated_semester * 2;
}

function formatWonFull(amount: number): string {
  return amount.toLocaleString("ko-KR");
}

function formatWonManWon(amount: number): string {
  const man = Math.floor(amount / 10_000);
  if (man === 0) return "0원";
  return `월 ${man}만원`;
}

/** Count items whose program_type matches a given key (supports aliases). */
function countByType(items: RecommendationItem[], key: string): RecommendationItem[] {
  if (key === "youth_policy") {
    return items.filter(
      (i) => i.program_type === "youth_policy" || i.program_type === "support"
    );
  }
  return items.filter((i) => i.program_type === key);
}

/** Sum monthly benefit for a set of items. */
function sumMonthly(items: RecommendationItem[]): number {
  return items.reduce((acc, i) => acc + (i.benefit_amount_monthly ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useAnimatedCounter(target: number, durationMs: number) {
  const [displayed, setDisplayed] = useState(0);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (target <= 0) return;
    animValue.setValue(0);
    const animation = Animated.timing(animValue, {
      toValue: target,
      duration: durationMs,
      useNativeDriver: false,
    });
    const listenerId = animValue.addListener(({ value }) => {
      setDisplayed(Math.round(value));
    });
    animation.start();
    return () => {
      animValue.removeListener(listenerId);
      animation.stop();
    };
  }, [target, durationMs]);

  return displayed;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BreakdownCard({
  label,
  count,
  monthlyTotal,
  showMonthly,
  delay,
}: {
  label: string;
  count: number;
  monthlyTotal: number;
  showMonthly: boolean;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.View style={[styles.breakdownCard, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.breakdownLeft}>
        <Text style={styles.breakdownLabel}>{label}</Text>
        {showMonthly && monthlyTotal > 0 && (
          <Text style={styles.breakdownMonthly}>{formatWonManWon(monthlyTotal)}</Text>
        )}
      </View>
      <View style={styles.breakdownBadge}>
        <Text style={styles.breakdownBadgeText}>{count}건</Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function CalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { region, age, enrollmentStatus, employmentStatus, schoolName, incomeBracket } =
    useOnboardingStore();
  const birthYear = getBirthYear(age);

  const [data, setData] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hero fade-in animation
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.94)).current;

  // Guard
  if (!region || !birthYear || !enrollmentStatus) {
    router.replace("/onboarding");
    return null;
  }

  const annualAmount = data ? calcAnnual(data) : 0;
  const displayedCounter = useAnimatedCounter(annualAmount, COUNTER_DURATION_MS);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try cache first for instant display
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setData(JSON.parse(cached) as RecommendationResult);
        setLoading(false);
      }

      const profile = buildProfileInput({
        region,
        birthYear,
        enrollmentStatus,
        employmentStatus,
        schoolName,
        incomeBracket,
      });
      const result = await api.getRecommendPreview(profile);
      setData(result);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (err: unknown) {
      if (!data) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      }
      // If cache already loaded, silently ignore fetch error
    } finally {
      setLoading(false);
    }
  }, [region, birthYear, enrollmentStatus, employmentStatus, schoolName, incomeBracket]);

  useEffect(() => {
    fetchData();
  }, []);

  // Animate hero in once data arrives
  useEffect(() => {
    if (data) {
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.spring(heroScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
      ]).start();
    }
  }, [!!data]);

  const handleGoHome = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading && !data) {
    return (
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={styles.loadingContainer}
      >
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={colors.onPrimary} />
        <Text style={styles.loadingText}>맞춤 혜택을 계산하고 있어요...</Text>
        <Text style={styles.loadingSubtext}>잠시만 기다려주세요</Text>
      </LinearGradient>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state (no cached data)
  // ---------------------------------------------------------------------------

  if (error && !data) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>결과를 불러오지 못했어요</Text>
        <Text style={styles.errorDesc}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={fetchData}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text style={styles.retryBtnText}>다시 시도</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipLink}
          onPress={handleGoHome}
          accessibilityRole="button"
        >
          <Text style={styles.skipLinkText}>건너뛰기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Breakdown computation
  // ---------------------------------------------------------------------------

  const items = data?.items ?? [];

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero gradient section ─────────────────────────────────────── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 32 }]}
        >
          {/* Decorative circles */}
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />

          <Animated.View
            style={[
              styles.heroContent,
              { opacity: heroOpacity, transform: [{ scale: heroScale }] },
            ]}
          >
            {/* Sparkle badge */}
            <View style={styles.sparkleRow}>
              <Text style={styles.sparkleBadge}>놓친 돈 계산기</Text>
            </View>

            <Text style={styles.heroSubtitle}>지금까지 놓쳤던 혜택</Text>
            <Text style={styles.heroLabel}>연간 최대</Text>

            {/* Animated counter */}
            <View style={styles.counterRow}>
              <Text style={styles.counterValue}>
                {formatWonFull(displayedCounter)}
              </Text>
              <Text style={styles.counterUnit}>원</Text>
            </View>

            <Text style={styles.heroCaption}>
              총 {data?.total_available ?? 0}건의 혜택이 기다리고 있어요
            </Text>
          </Animated.View>
        </LinearGradient>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <View style={styles.body}>
          {/* Motivational message */}
          <View style={styles.motivationCard}>
            <Text style={styles.motivationText}>
              지금 바로 받을 수 있는 혜택이{"\n"}이렇게 많아요!
            </Text>
          </View>

          {/* Breakdown section */}
          <Text style={styles.sectionTitle}>혜택 분류별 현황</Text>
          <View style={styles.breakdownList}>
            {BREAKDOWN_CATEGORIES.map((cat, idx) => {
              const matched = countByType(items, cat.key);
              return (
                <BreakdownCard
                  key={cat.key}
                  label={cat.label}
                  count={matched.length}
                  monthlyTotal={cat.showMonthly ? sumMonthly(matched) : 0}
                  showMonthly={cat.showMonthly}
                  delay={300 + idx * 80}
                />
              );
            })}
          </View>

          {/* Estimated monthly summary */}
          {(data?.estimated_monthly ?? 0) > 0 && (
            <View style={styles.summaryStrip}>
              <Text style={styles.summaryStripLabel}>예상 월 수혜액</Text>
              <Text style={styles.summaryStripValue}>
                {formatWonManWon(data!.estimated_monthly)}
              </Text>
            </View>
          )}

          {/* Primary CTA */}
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <TouchableOpacity
              style={styles.ctaTouchable}
              onPress={handleGoHome}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="내 맞춤 혜택 보러가기"
            >
              <Text style={styles.ctaLabel}>내 맞춤 혜택 보러가기</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Secondary link */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleGoHome}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="나중에 볼게요"
          >
            <Text style={styles.skipBtnText}>나중에 볼게요</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },

  scroll: {
    flex: 1,
  },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  loadingSubtext: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.75)",
  },

  // ── Error ────────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 9999,
    backgroundColor: colors.errorContainer,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 56,
    fontSize: 28,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.error,
    overflow: "hidden",
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    textAlign: "center",
  },
  errorDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.outline,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minHeight: layout.touchTargetMin,
    justifyContent: "center",
    marginTop: 8,
    ...shadows.primaryButton,
  },
  retryBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  skipLink: {
    paddingVertical: 10,
    minHeight: layout.touchTargetMin,
    justifyContent: "center",
  },
  skipLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.outline,
    textDecorationLine: "underline",
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 56,
    overflow: "hidden",
  },
  heroCircle1: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroCircle2: {
    position: "absolute",
    bottom: -40,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  heroContent: {
    zIndex: 1,
  },
  sparkleRow: {
    marginBottom: 20,
  },
  sparkleBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: "rgba(255,255,255,0.80)",
    letterSpacing: 1.0,
    textTransform: "uppercase",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  heroSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: "rgba(255,255,255,0.78)",
    marginBottom: 4,
  },
  heroLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: "rgba(255,255,255,0.90)",
    marginBottom: 6,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  counterValue: {
    fontSize: 52,
    fontWeight: typography.fontWeight.black,
    color: colors.onPrimary,
    letterSpacing: -1.5,
    lineHeight: 60,
  },
  counterUnit: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
    marginBottom: 6,
    marginLeft: 2,
  },
  heroCaption: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.72)",
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: 24,
    gap: 16,
  },

  // Motivational card
  motivationCard: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.xl,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  motivationText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixed,
    textAlign: "center",
    lineHeight: typography.fontSize.md * 1.55,
  },

  // Section title
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    marginBottom: 4,
  },

  // Breakdown list
  breakdownList: {
    gap: 10,
  },
  breakdownCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.touchTargetMin,
    ...Platform.select({
      ios: {
        shadowColor: colors.secondaryFixedDim,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 1 },
    }),
  },
  breakdownLeft: {
    flex: 1,
    gap: 2,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
  },
  breakdownMonthly: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },
  breakdownBadge: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 52,
    alignItems: "center",
  },
  breakdownBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixed,
  },

  // Summary strip
  summaryStrip: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowColor: colors.secondaryFixedDim,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 1 },
    }),
  },
  summaryStripLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  summaryStripValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
  },

  // Primary CTA
  ctaGradient: {
    borderRadius: borderRadius.xl,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  ctaTouchable: {
    height: layout.buttonHeightLg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  ctaLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
    letterSpacing: -0.2,
  },

  // Secondary skip
  skipBtn: {
    height: layout.buttonHeightMd,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  skipBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.outline,
  },
});
