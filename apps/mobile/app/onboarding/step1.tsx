/**
 * Onboarding Step 2 — Region Selection
 * Matches Stitch "Onboarding / Profile Setup" design exactly.
 */
import React, { useCallback } from "react";
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
import { useOnboardingStore } from "@/store/onboarding";
import { colors, typography, spacing, borderRadius, shadows, layout } from "@/constants/theme";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;
const CURRENT_STEP = 2;
const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

type RegionOption = {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const PRIMARY_REGIONS: RegionOption[] = [
  { value: "busan", label: "부산", icon: "location" },
  { value: "daegu", label: "대구", icon: "business" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function OnboardingStepRegion() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { region, setRegion } = useOnboardingStore();

  const canProceed = region !== "";

  const handleNext = useCallback(() => {
    if (!canProceed) return;
    router.push("/onboarding/step2");
  }, [canProceed, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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

        {/* Right spacer — mirrors back button width for true centering */}
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
          <Text style={styles.questionTitle}>어느 지역에 거주하시나요?</Text>
          <Text style={styles.questionSubtitle}>
            맞춤 지원금을 찾기 위해 몇 가지만 여쭤볼게요.
          </Text>
        </View>

        {/* Region section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>거주 지역 선택</Text>

          {/* 2-col primary region grid */}
          <View style={styles.regionGrid}>
            {PRIMARY_REGIONS.map((r) => {
              const isSelected = region === r.value;
              return (
                <Pressable
                  key={r.value}
                  style={({ pressed }) => [
                    styles.regionCard,
                    isSelected && styles.regionCardSelected,
                    pressed && styles.regionCardPressed,
                  ]}
                  onPress={() => setRegion(r.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${r.label} 선택`}
                  accessibilityState={{ checked: isSelected }}
                >
                  <Ionicons
                    name={r.icon}
                    size={28}
                    color={isSelected ? colors.primary : colors.onSurfaceVariant}
                    style={styles.regionCardIcon}
                  />
                  <Text
                    style={[
                      styles.regionCardLabel,
                      isSelected && styles.regionCardLabelSelected,
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Other region button */}
          <Pressable
            style={({ pressed }) => [
              styles.otherRegionBtn,
              pressed && styles.otherRegionBtnPressed,
            ]}
            onPress={() => setRegion("other")}
            accessibilityRole="button"
            accessibilityLabel="기타 지역 선택"
          >
            <Text
              style={[
                styles.otherRegionBtnText,
                region === "other" && styles.otherRegionBtnTextSelected,
              ]}
            >
              기타 지역 선택
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={region === "other" ? colors.primary : colors.onSurfaceVariant}
              style={{ marginLeft: 6 }}
            />
          </Pressable>
        </View>
      </ScrollView>

      {/* Sticky gradient CTA */}
      <View style={[styles.ctaWrapper, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.ctaGradientOverlay} pointerEvents="none" />
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.ctaGradient,
            !canProceed && styles.ctaDisabled,
          ]}
        >
          <TouchableOpacity
            style={styles.ctaTouchable}
            onPress={handleNext}
            disabled={!canProceed}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="다음 단계로 이동"
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

  // --- Decorative blobs ---
  blobTopRight: {
    position: "absolute",
    right: -80,
    width: 256,
    height: 256,
    borderRadius: 9999,
    backgroundColor: colors.decorativeBlob,
    zIndex: -1,
    // blur simulated via opacity + large radius; real blur needs @react-native-community/blur
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

  // --- Header ---
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
        shadowColor: colors.secondaryFixedDim,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerBackBtn:
 {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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

  // --- Scroll ---
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 120, // below header
  },

  // --- Progress ---
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

  // --- Question header ---
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

  // --- Section ---
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

  // --- Region grid ---
  regionGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  regionCard: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 88, 188, 0.08)",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: { elevation: 2 },
    }),
  },
  regionCardSelected: {
    borderColor: colors.primary,
  },
  regionCardPressed: {
    transform: [{ scale: 0.96 }],
  },
  regionCardIcon: {
    marginBottom: 8,
  },
  regionCardLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  regionCardLabelSelected: {
    color: colors.primary,
  },

  // --- Other region ---
  otherRegionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceContainerLowest,
    minHeight: layout.touchTargetMin,
  },
  otherRegionBtnPressed: {
    backgroundColor: colors.surfaceContainerLow,
  },
  otherRegionBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  otherRegionBtnTextSelected: {
    color: colors.primary,
  },

  // --- Sticky CTA ---
  ctaWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  ctaGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    // Simulate the from-surface to-transparent fade via the wrapper background
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
  ctaDisabled: {
    opacity: 0,
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
