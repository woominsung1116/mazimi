/**
 * Onboarding Step 4 — Employment Status
 * Matches Stitch "Onboarding / Profile Setup" design exactly.
 */
import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
import { api } from "@/lib/api";
import { colors, typography, borderRadius, layout } from "@/constants/theme";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;
const CURRENT_STEP = 4;
const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

type EmploymentOption = {
  value: string;
  label: string;
};

const EMPLOYMENT_OPTIONS: EmploymentOption[] = [
  { value: "미취업", label: "미취업 (구직 중)" },
  { value: "재직", label: "재직 중 (4대 보험 가입)" },
  { value: "기타", label: "기타 (아르바이트, 프리랜서 등)" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function OnboardingStep3() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { nickname, region, age, enrollmentStatus, employmentStatus, setEmploymentStatus } =
    useOnboardingStore();

  const canProceed = employmentStatus !== "";

  const handleNext = useCallback(async () => {
    if (!canProceed) return;
    // Save profile to backend before continuing
    try {
      await api.saveProfile({
        birth_year: age ? getBirthYear(age) : 2001,
        region_code: region || "busan",
        enrollment_status: enrollmentStatus || undefined,
        employment_status: employmentStatus || undefined,
      });
    } catch {
      // Non-blocking — profile can be saved later from profile tab
    }
    router.push("/calculator");
  }, [canProceed, router, age, region, enrollmentStatus, employmentStatus]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Guard: prior steps must be complete (after all hooks)
  useEffect(() => {
    if (!region || !enrollmentStatus) router.replace("/onboarding");
  }, [region, enrollmentStatus, router]);

  if (!region || !enrollmentStatus) return null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Decorative blobs */}
      <View style={[styles.blobTopRight, { top: insets.top + 64 }]} />
      <View style={styles.blobBottomLeft} />

      {/* Glass header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <Ionicons name="chevron-back" size={22} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
        <Text style={styles.headerBrand}>마지미</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress indicator */}
        <View style={styles.progressWrap}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressStepLabel}>STEP {CURRENT_STEP}/{TOTAL_STEPS}</Text>
            <Text style={styles.progressPctLabel}>{PROGRESS_PCT}% Completed</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${PROGRESS_PCT}%` }]} />
          </View>
        </View>

        {/* Question header */}
        <View style={styles.questionWrap}>
          <Text style={styles.questionTitle}>취업 상태를{"\n"}알려주세요</Text>
          <Text style={styles.questionSubtitle}>
            맞춤 지원금을 찾기 위해 몇 가지만 여쭤볼게요.
          </Text>
        </View>

        {/* Employment status — radio list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>취업 상태</Text>
          <View style={styles.radioList}>
            {EMPLOYMENT_OPTIONS.map((opt) => {
              const isSelected = employmentStatus === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [
                    styles.radioItem,
                    isSelected && styles.radioItemSelected,
                    pressed && styles.radioItemPressed,
                  ]}
                  onPress={() => setEmploymentStatus(opt.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ checked: isSelected }}
                >
                  {/* Radio indicator */}
                  <View
                    style={[
                      styles.radioIndicator,
                      isSelected && styles.radioIndicatorSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioIndicatorDot} />}
                  </View>

                  <Text
                    style={[
                      styles.radioLabel,
                      isSelected && styles.radioLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky gradient CTA */}
      <View style={[styles.ctaWrapper, { paddingBottom: insets.bottom + 16 }]}>
        <LinearGradient
          colors={canProceed ? [colors.primary, colors.primaryContainer] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaGradient}
        >
          <TouchableOpacity
            style={styles.ctaTouchable}
            onPress={handleNext}
            disabled={!canProceed}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="추천 결과 보기"
            accessibilityState={{ disabled: !canProceed }}
          >
            <Text style={[styles.ctaLabel, !canProceed && styles.ctaLabelDisabled]}>
              다음
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={canProceed ? colors.onPrimary : colors.outline}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  blobTopRight: {
    position: "absolute",
    right: -80,
    width: 256,
    height: 256,
    borderRadius: 9999,
    backgroundColor: colors.decorativeBlob,
    zIndex: -1,
  },
  blobBottomLeft: {
    position: "absolute",
    bottom: 160,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 9999,
    backgroundColor: "rgba(202, 218, 255, 0.07)",
    zIndex: -1,
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    ...Platform.select({
      ios: {
        shadowColor: "#b6c7eb",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 120,
  },

  progressWrap: {
    marginBottom: 40,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  progressStepLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: 1.5,
  },
  progressPctLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  progressTrack: {
    height: layout.progressBarHeight,
    borderRadius: 9999,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },

  questionWrap: {
    marginBottom: 40,
  },
  questionTitle: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    lineHeight: typography.fontSize["3xl"] * 1.2,
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    lineHeight: typography.fontSize.base * 1.5,
  },

  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 16,
    marginLeft: 4,
  },

  // Radio list
  radioList: {
    gap: 12,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    minHeight: layout.touchTargetMin,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#b6c7eb",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  radioItemSelected: {
    borderColor: "rgba(0, 88, 188, 0.08)",
  },
  radioItemPressed: {
    transform: [{ scale: 0.98 }],
  },
  radioIndicator: {
    width: 24,
    height: 24,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: colors.primaryFixedDim,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  radioIndicatorSelected: {
    borderColor: colors.primary,
  },
  radioIndicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  radioLabelSelected: {
    color: colors.primary,
  },

  // CTA
  ctaWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  ctaGradient: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  ctaTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: layout.buttonHeightLg,
    paddingHorizontal: 24,
  },
  ctaLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  ctaLabelDisabled: {
    color: colors.outline,
  },
});
