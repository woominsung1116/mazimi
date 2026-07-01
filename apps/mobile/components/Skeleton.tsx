/**
 * Skeleton — reusable shimmer loading placeholders.
 *
 * Replaces bare `<ActivityIndicator />` blocks across the app with content-
 * shaped placeholders (closer to the eventual layout, feels faster / less
 * jarring than a spinner). Uses RN's `Animated` API (same primitive already
 * used in OfflineBanner.tsx) — no extra dependency needed.
 *
 * Usage:
 *   {isLoading ? <ProgramCardSkeleton count={4} /> : <RealList .../>}
 */

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, type ViewStyle, type DimensionValue } from "react-native";
import { colors, spacing, borderRadius, shadows, layout } from "@/constants/theme";

// ---------------------------------------------------------------------------
// Base shimmer block
// ---------------------------------------------------------------------------

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Single pulsing rectangle — the atomic building block for all presets below. */
export function SkeletonBlock({
  width = "100%",
  height = 16,
  borderRadius: radius = borderRadius.sm,
  style,
}: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceContainerHigh,
          opacity,
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

// ---------------------------------------------------------------------------
// Preset — Explore / program list card (mirrors explore.tsx `styles.card`)
// ---------------------------------------------------------------------------

export function ProgramCardSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="프로그램 정보를 불러오는 중">
      <View style={styles.rowBetween}>
        <SkeletonBlock width={64} height={20} borderRadius={borderRadius.full} />
        <SkeletonBlock width={52} height={20} borderRadius={borderRadius.full} />
      </View>
      <SkeletonBlock width="85%" height={20} />
      <SkeletonBlock width="55%" height={20} style={{ marginTop: -spacing[1] }} />
      <SkeletonBlock width="40%" height={14} style={{ marginTop: spacing[1] }} />
      <View style={styles.divider} />
      <View style={styles.rowBetween}>
        <SkeletonBlock width={90} height={22} />
        <SkeletonBlock width={20} height={20} borderRadius={borderRadius.full} />
      </View>
    </View>
  );
}

/** Renders `count` ProgramCardSkeletons with the list gap already applied. */
export function ProgramListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: spacing[4] }}>
      {Array.from({ length: count }).map((_, i) => (
        <ProgramCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset — Home summary row card (mirrors index.tsx `styles.summaryCard`)
// ---------------------------------------------------------------------------

export function SummaryCardSkeleton() {
  return (
    <View style={styles.summaryCard}>
      <View style={{ gap: spacing[1.5], flex: 1 }}>
        <SkeletonBlock width="70%" height={12} />
        <SkeletonBlock width={40} height={22} />
      </View>
      <SkeletonBlock width={40} height={40} borderRadius={borderRadius.full} />
    </View>
  );
}

export function SummaryRowSkeleton() {
  return (
    <View style={styles.summaryRow}>
      <SummaryCardSkeleton />
      <SummaryCardSkeleton />
      <SummaryCardSkeleton />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset — Recommendation card (mirrors index.tsx `styles.recommendCard`)
// ---------------------------------------------------------------------------

export function RecommendationCardSkeleton() {
  return (
    <View style={styles.recommendCard} accessibilityLabel="추천 정보를 불러오는 중">
      <SkeletonBlock width={64} height={20} borderRadius={borderRadius.full} />
      <SkeletonBlock width="80%" height={20} />
      <SkeletonBlock width="45%" height={24} />
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <SkeletonBlock width={70} height={20} borderRadius={borderRadius.md} />
        <SkeletonBlock width={70} height={20} borderRadius={borderRadius.md} />
      </View>
    </View>
  );
}

export function RecommendationListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={{ gap: layout.cardGapLg }}>
      {Array.from({ length: count }).map((_, i) => (
        <RecommendationCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset — Manage tab match score card (mirrors manage.tsx `styles.matchCard`)
// ---------------------------------------------------------------------------

export function MatchScoreCardSkeleton() {
  return (
    <View style={styles.matchCard} accessibilityLabel="종합 분석 결과를 불러오는 중">
      <SkeletonBlock
        width={128}
        height={128}
        borderRadius={64}
        style={{ alignSelf: "center" }}
      />
      <SkeletonBlock width="70%" height={20} style={{ marginTop: spacing[4] }} />
      <SkeletonBlock width="90%" height={14} style={{ marginTop: spacing[2] }} />
      <SkeletonBlock width="60%" height={14} style={{ marginTop: spacing[1] }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset — Manage tab scholarship card (mirrors manage.tsx `styles.scholarshipCard`)
// ---------------------------------------------------------------------------

export function ScholarshipCardSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="장학금 정보를 불러오는 중">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: spacing[1.5] }}>
          <SkeletonBlock width={100} height={18} borderRadius={borderRadius.full} />
          <SkeletonBlock width="80%" height={20} />
          <SkeletonBlock width="50%" height={14} />
        </View>
        <View style={{ alignItems: "flex-end", gap: spacing[1] }}>
          <SkeletonBlock width={70} height={22} />
          <SkeletonBlock width={50} height={14} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={44} borderRadius={borderRadius.md} />
    </View>
  );
}

export function ScholarshipListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={{ gap: spacing[4] }}>
      {Array.from({ length: count }).map((_, i) => (
        <ScholarshipCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Preset — Program detail screen (mirrors programs/[id].tsx hero + sections)
// ---------------------------------------------------------------------------

export function ProgramDetailSkeleton() {
  return (
    <View style={styles.detailRoot} accessibilityLabel="프로그램 상세 정보를 불러오는 중">
      {/* Hero */}
      <View style={styles.detailHero}>
        <SkeletonBlock width={90} height={22} borderRadius={borderRadius.full} />
        <SkeletonBlock width="90%" height={28} style={{ marginTop: spacing[3] }} />
        <SkeletonBlock width="60%" height={28} style={{ marginTop: spacing[1] }} />
        <SkeletonBlock width="50%" height={16} style={{ marginTop: spacing[3] }} />
      </View>

      {/* Amount card */}
      <View style={styles.detailCard}>
        <SkeletonBlock width="40%" height={14} />
        <SkeletonBlock width="55%" height={32} style={{ marginTop: spacing[2] }} />
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <SkeletonBlock width={80} height={36} borderRadius={borderRadius.full} />
        <SkeletonBlock width={80} height={36} borderRadius={borderRadius.full} />
        <SkeletonBlock width={80} height={36} borderRadius={borderRadius.full} />
      </View>

      {/* Body lines */}
      <View style={styles.detailCard}>
        <SkeletonBlock width="100%" height={14} />
        <SkeletonBlock width="95%" height={14} style={{ marginTop: spacing[2] }} />
        <SkeletonBlock width="70%" height={14} style={{ marginTop: spacing[2] }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — reuse the shapes/paddings of the real cards they stand in for
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceContainerLow,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[3],
    ...shadows.cardMd,
  },

  matchCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    ...shadows.cardLg,
  },

  summaryRow: {
    flexDirection: "row",
    gap: layout.cardGap,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadows.card,
  },

  recommendCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[4],
    ...shadows.cardMd,
  },

  detailRoot: {
    gap: spacing[5],
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[6],
  },
  detailHero: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    ...shadows.cardMd,
  },
  detailCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    ...shadows.card,
  },
});
