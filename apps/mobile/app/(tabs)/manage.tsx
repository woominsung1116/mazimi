/**
 * Manage Tab — "추천 패키지" screen
 *
 * Data sources:
 *   - api.getRecommendPreview()  → scholarship / support recommendations
 *   - api.getDashboard()         → overall score, deadline items (JWT auth)
 *
 * On API failure the screen falls back to static mock data and shows an
 * "오프라인 모드" banner.
 */

import React, { useCallback, useState } from "react";
import {
  Alert as RNAlert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";

import {
  borderRadius,
  colors,
  gradients,
  layout,
  shadows,
  spacing,
  typography,
} from "@/constants/theme";
import {
  api,
  formatBenefit,
  type RecommendationItem,
  type DashboardData,
} from "@/lib/api";
import OfflineBanner from "@/components/OfflineBanner";
import { useAuthStore } from "@/store/auth";

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

interface ScholarshipItem {
  id: string;
  title: string;
  organization: string;
  matchScore: number;
  matchScoreHigh: boolean;
  amount: string;
  amountHighlight: boolean;
  deadline: string | null;
  reason: string;
  reasonIcon: "lightbulb" | "shield";
}

// No mock scholarships — always use real API data

interface LifestyleItem {
  id: string;
  iconName: keyof typeof Ionicons.glyphMap | string;
  iconLib: "ionicons" | "material" | "community";
  title: string;
  subtitle: string;
  quote: string;
}

// No mock lifestyle/housing data — always use real API data

// ---------------------------------------------------------------------------
// Adapters — convert RecommendationItem → ScholarshipItem
// ---------------------------------------------------------------------------

function recommendToScholarship(item: RecommendationItem, index: number): ScholarshipItem {
  const amountLabel =
    item.benefit_amount_monthly
      ? `${(item.benefit_amount_monthly / 10000).toFixed(0)}만원/월`
      : item.benefit_amount_semester
      ? `${(item.benefit_amount_semester / 10000).toFixed(0)}만원/학기`
      : "혜택 확인";

  const deadlineLabel = item.deadline
    ? (() => {
        const days = Math.ceil(
          (new Date(item.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return days <= 0 ? "마감" : `D-${days}일 남음`;
      })()
    : null;

  return {
    id: item.program_id,
    title: item.title,
    organization: amountLabel,
    matchScore: item.match_score,
    matchScoreHigh: item.match_score >= 80,
    amount: amountLabel,
    amountHighlight: item.match_score >= 80,
    deadline: deadlineLabel,
    reason: item.reasons[0] ?? "조건에 잘 맞는 프로그램이에요.",
    reasonIcon: index % 2 === 0 ? "lightbulb" : "shield",
  };
}

function scoreFromRecommendations(items: RecommendationItem[]): number {
  if (items.length === 0) return 0;
  const top = items.slice(0, 5);
  const avg = top.reduce((s, i) => s + i.match_score, 0) / top.length;
  return Math.round(avg);
}

// ---------------------------------------------------------------------------
// CircularProgress
// ---------------------------------------------------------------------------

interface CircularProgressProps {
  size: number;
  strokeWidth: number;
  progress: number;
  trackColor: string;
  fillColor: string;
}

function CircularProgress({
  size,
  strokeWidth,
  progress,
  trackColor,
  fillColor,
}: CircularProgressProps) {
  const filled = (progress / 100) * 360;

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size / 2,
            height: size,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: filled > 0 ? fillColor : "transparent",
              transform: [{ rotate: `${Math.min(filled, 180) - 180}deg` }],
            }}
          />
        </View>
      </View>

      {filled > 180 && (
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: size / 2,
              height: size,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: fillColor,
                transform: [{ rotate: `${filled - 180}deg` }],
              }}
            />
          </View>
        </View>
      )}

      <Text style={[styles.progressLabel, { color: fillColor }]}>
        {progress}%
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// HeroBadge
// ---------------------------------------------------------------------------

function HeroBadge() {
  return (
    <View style={styles.heroBadge}>
      <Ionicons name="checkmark" size={14} color={colors.onPrimaryFixedVariant} />
      <Text style={styles.heroBadgeText}>AI 맞춤 분석 완료</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MatchScoreCard
// ---------------------------------------------------------------------------

function MatchScoreCard({ score }: { score: number }) {
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    setSaving(false);
    RNAlert.alert("저장 완료", "추천 패키지가 저장되었습니다.");
  }, [saving]);

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchCardBlob} pointerEvents="none" />
      <View style={styles.matchCardBody}>
        <CircularProgress
          size={128}
          strokeWidth={10}
          progress={score}
          trackColor={colors.surfaceContainerHigh}
          fillColor={colors.primary}
        />
        <View style={styles.matchCardText}>
          <Text style={styles.matchCardTitle}>종합 신청 가능성</Text>
          <Text style={styles.matchCardDesc}>
            현재 프로필 기준으로 총 여러 지원 사업 요건과{"\n"}
            높은 적합도를 보이고 있어요.
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleSave}
        style={({ pressed }) => [styles.saveBtnOuter, pressed && { opacity: 0.85 }]}
        accessibilityLabel="이 패키지 저장하기"
        accessibilityRole="button"
      >
        <LinearGradient
          colors={gradients.primaryCta.colors as [string, string]}
          start={gradients.primaryCta.start}
          end={gradients.primaryCta.end}
          style={styles.saveBtn}
        >
          <Text style={styles.saveBtnLabel}>
            {saving ? "저장 중..." : "이 패키지 저장하기"}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — uses Ionicons/MaterialIcons instead of emoji
// ---------------------------------------------------------------------------

type SectionIconSpec =
  | { lib: "ionicons"; name: keyof typeof Ionicons.glyphMap }
  | { lib: "material"; name: string }
  | { lib: "community"; name: string };

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: SectionIconSpec;
  title: string;
  badge?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {icon.lib === "ionicons" && (
          <Ionicons
            name={icon.name as keyof typeof Ionicons.glyphMap}
            size={20}
            color={colors.onSurface}
          />
        )}
        {icon.lib === "material" && (
          <MaterialIcons name={icon.name as any} size={20} color={colors.onSurface} />
        )}
        {icon.lib === "community" && (
          <MaterialCommunityIcons name={icon.name as any} size={20} color={colors.onSurface} />
        )}
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
      {badge ? <Text style={styles.sectionHeaderBadge}>{badge}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ScholarshipCard
// ---------------------------------------------------------------------------

const ScholarshipCard = React.memo(function ScholarshipCard({ item }: { item: ScholarshipItem }) {
  return (
    <View style={styles.scholarshipCard}>
      <View style={styles.scholarshipTop}>
        <View style={styles.scholarshipLeft}>
          <View
            style={[
              styles.matchBadge,
              item.matchScoreHigh ? styles.matchBadgeHighBg : styles.matchBadgeLowBg,
            ]}
          >
            <Text
              style={[
                styles.matchBadgeText,
                item.matchScoreHigh ? styles.matchBadgeHighText : styles.matchBadgeLowText,
              ]}
            >
              신청 가능성 {item.matchScore}%
            </Text>
          </View>
          <Text style={styles.scholarshipTitle}>{item.title}</Text>
          <Text style={styles.scholarshipOrg}>{item.organization}</Text>
        </View>

        <View style={styles.scholarshipRight}>
          <Text
            style={[
              styles.scholarshipAmount,
              { color: item.amountHighlight ? colors.primary : colors.onSurface },
            ]}
          >
            {item.amount}
          </Text>
          {item.deadline !== null ? (
            <Text style={styles.scholarshipDeadline}>{item.deadline}</Text>
          ) : (
            <Text style={styles.scholarshipOpen}>상시 접수</Text>
          )}
        </View>
      </View>

      <View style={styles.reasonBox}>
        {item.reasonIcon === "lightbulb" ? (
          <Ionicons name="bulb-outline" size={18} color={colors.tertiary} style={styles.reasonIcon} />
        ) : (
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} style={styles.reasonIcon} />
        )}
        <Text style={styles.reasonText}>
          <Text style={styles.reasonBold}>추천 이유: </Text>
          {item.reason}
        </Text>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// HousingCard
// ---------------------------------------------------------------------------

function HousingCard({
  eligibilityItems,
}: {
  eligibilityItems: string[];
}) {
  return (
    <View style={styles.housingCard}>
      <View style={[styles.matchBadge, styles.matchBadgeHighBg]}>
        <Text style={[styles.matchBadgeText, styles.matchBadgeHighText]}>
          신청 가능성 92%
        </Text>
      </View>

      <Text style={styles.housingTitle}>부산 청년 월세 지원사업</Text>
      <Text style={styles.housingSubtitle}>월 20만원 (최대 10개월)</Text>

      <View style={styles.housingChecklist}>
        {eligibilityItems.map((label, idx) => (
          <View key={idx} style={styles.checkRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={14} color={colors.primary} />
            </View>
            <Text style={styles.checkLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.housingReasonBox}>
        <Text style={styles.housingReasonTitle}>추천 이유</Text>
        <Text style={styles.housingReasonDesc}>
          부산 거주 휴학생 전용 쿼터가 있어 당첨 확률이 매우 높습니다.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LifestyleCard
// ---------------------------------------------------------------------------

function LifestyleIconView({ item }: { item: LifestyleItem }) {
  if (item.iconLib === "ionicons") {
    return (
      <Ionicons
        name={item.iconName as keyof typeof Ionicons.glyphMap}
        size={24}
        color={colors.onSecondaryContainer}
      />
    );
  }
  if (item.iconLib === "material") {
    return <MaterialIcons name={item.iconName as any} size={24} color={colors.onSecondaryContainer} />;
  }
  return <MaterialCommunityIcons name={item.iconName as any} size={24} color={colors.onSecondaryContainer} />;
}

const LifestyleCard = React.memo(function LifestyleCard({ item }: { item: LifestyleItem }) {
  return (
    <View style={styles.lifestyleCard}>
      <View style={styles.lifestyleTop}>
        <View style={styles.lifestyleIconWrap}>
          <LifestyleIconView item={item} />
        </View>
        <View style={styles.lifestyleMeta}>
          <Text style={styles.lifestyleTitle}>{item.title}</Text>
          <Text style={styles.lifestyleSubtitle}>{item.subtitle}</Text>
        </View>
      </View>
      <View style={styles.lifestyleDivider} />
      <Text style={styles.lifestyleQuote}>"{item.quote}"</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const recommendQuery = useQuery({
    queryKey: ["recommend-preview-manage"],
    queryFn: () =>
      api.getRecommendPreview({
        birth_year: 2001,
        region_code: "busan",
        enrollment_status: "enrolled",
      }),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    enabled: !!user,
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "me"],
    queryFn: () => api.getDashboard(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    enabled: !!user,
  });

  const isLoading = recommendQuery.isLoading || dashboardQuery.isLoading;
  const isOffline =
    (recommendQuery.isError || dashboardQuery.isError) && !isLoading;

  // Resolve scholarships from API only
  const scholarships: ScholarshipItem[] =
    recommendQuery.data?.items && recommendQuery.data.items.length > 0
      ? recommendQuery.data.items
          .filter(
            (i) => i.program_type === "scholarship" || i.program_type === "support"
          )
          .slice(0, 4)
          .map((item, idx) => recommendToScholarship(item, idx))
      : [];

  const overallScore = recommendQuery.data?.items?.length
    ? scoreFromRecommendations(recommendQuery.data.items)
    : 0;

  const scholarshipCount = scholarships.length;

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.onSurface, marginBottom: 8 }}>
          로그인이 필요해요
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
          추천 패키지와 신청 관리를 사용하려면{"\n"}로그인해주세요.
        </Text>
        <Pressable
          onPress={() => router.push("/login")}
          style={{ backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>로그인하기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + layout.tabBarHeight + spacing[6] },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Offline banner */}
      {isOffline && <OfflineBanner forceVisible />}

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <HeroBadge />
        <Text style={styles.heroTitle}>
          부산 청년을 위한{"\n"}지원 패키지
        </Text>
        <Text style={styles.heroSubtitle}>
          현재 상황에 가장 적합한 부산 지역 혜택들을 한데 모았습니다.
          신청 가능성이 높은 항목부터 확인해보세요.
        </Text>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <MatchScoreCard score={overallScore} />
        )}
      </View>

      {/* 장학금 기회 */}
      <View style={styles.section}>
        <SectionHeader
          icon={{ lib: "ionicons", name: "school-outline" }}
          title="장학금 기회"
          badge={`${scholarshipCount}건 발견`}
        />
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          scholarships.map((item) => (
            <ScholarshipCard key={item.id} item={item} />
          ))
        )}
      </View>

      {/* 주거 지원 — will be populated from API recommendations */}

      {/* 교통/생활비 — will be populated from API recommendations */}

      {/* 더 많은 혜택 찾기 */}
      <View style={styles.section}>
        <SectionHeader
          icon={{ lib: "ionicons", name: "search-outline" }}
          title="더 많은 혜택 찾기"
        />
        <View style={styles.toolsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.toolCard,
              pressed && styles.toolCardPressed,
            ]}
            onPress={() => router.push("/stack-calculator")}
            accessibilityRole="button"
            accessibilityLabel="혜택 중복 계산기"
          >
            <MaterialIcons name="calculate" size={28} color={colors.primary} style={styles.toolIcon} />
            <View style={styles.toolTextBlock}>
              <Text style={styles.toolTitle}>혜택 중복 계산기</Text>
              <Text style={styles.toolSubtitle}>
                여러 혜택을 동시에 받을 수 있는지 확인
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.toolCard,
              pressed && styles.toolCardPressed,
            ]}
            onPress={() => router.push("/region-compare")}
            accessibilityRole="button"
            accessibilityLabel="지역 이동 비교"
          >
            <Ionicons name="map-outline" size={28} color={colors.primary} style={styles.toolIcon} />
            <View style={styles.toolTextBlock}>
              <Text style={styles.toolTitle}>지역 이동 비교</Text>
              <Text style={styles.toolSubtitle}>
                이사하면 혜택이 어떻게 바뀔까?
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[8],
  },

  loadingCard: {
    height: 120,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },

  progressLabel: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
  },

  heroSection: {
    marginBottom: spacing[8],
    gap: spacing[3],
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
  },
  heroBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
    letterSpacing: 0.2,
  },
  heroTitle: {
    ...typography.styles.heroTitle,
    marginTop: spacing[1],
  },
  heroSubtitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.lg * 1.65,
    color: colors.onSurfaceVariant,
    marginTop: spacing[2],
  },

  matchCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    marginTop: spacing[3],
    gap: spacing[5],
    overflow: "hidden",
    ...shadows.cardLg,
  },
  matchCardBlob: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.decorativeBlob,
  },
  matchCardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    flexWrap: "wrap",
  },
  matchCardText: {
    flex: 1,
    minWidth: 160,
    gap: spacing[2],
  },
  matchCardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
    lineHeight: typography.fontSize.xl * 1.35,
  },
  matchCardDesc: {
    ...typography.styles.bodyBase,
    color: colors.onSurfaceVariant,
  },
  saveBtnOuter: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.primaryButton,
  },
  saveBtn: {
    height: layout.buttonHeightMd,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
  },
  saveBtnLabel: {
    ...typography.styles.buttonLabel,
    color: colors.onPrimary,
  },

  section: {
    marginBottom: spacing[8],
    gap: spacing[4],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[1],
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  sectionHeaderTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.extrabold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
  },
  sectionHeaderBadge: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },

  matchBadge: {
    alignSelf: "flex-start",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 3,
  },
  matchBadgeHighBg: {
    backgroundColor: colors.primaryFixed,
  },
  matchBadgeLowBg: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  matchBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.2,
  },
  matchBadgeHighText: {
    color: colors.onPrimaryFixedVariant,
  },
  matchBadgeLowText: {
    color: colors.onSurfaceVariant,
  },

  scholarshipCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[4],
    ...shadows.card,
  },
  scholarshipTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  scholarshipLeft: {
    flex: 1,
    gap: spacing[1.5],
  },
  scholarshipRight: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: spacing[1],
  },
  scholarshipTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
    lineHeight: typography.fontSize.xl * 1.35,
  },
  scholarshipOrg: {
    ...typography.styles.bodySm,
    color: colors.onSurfaceVariant,
  },
  scholarshipAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    fontFamily: typography.fontFamily.heading,
    lineHeight: typography.fontSize["2xl"] * 1.2,
  },
  scholarshipDeadline: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
  },
  scholarshipOpen: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  reasonBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
  },
  reasonIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  reasonText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.tertiaryContainer,
    lineHeight: typography.fontSize.sm * 1.65,
  },
  reasonBold: {
    fontWeight: typography.fontWeight.bold,
  },

  housingCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[4],
    ...shadows.card,
  },
  housingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
    lineHeight: typography.fontSize.lg * 1.35,
  },
  housingSubtitle: {
    ...typography.styles.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: -spacing[2],
  },
  housingChecklist: {
    gap: spacing[4],
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}1a`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurface,
  },
  housingReasonBox: {
    backgroundColor: `${colors.primaryFixed}4d`,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[1],
  },
  housingReasonTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },
  housingReasonDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: typography.fontSize.xs * 1.65,
  },

  lifestyleGrid: {
    gap: spacing[4],
  },

  toolsRow: {
    gap: spacing[3],
  },
  toolCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    ...shadows.cardMd,
  },
  toolCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  toolIcon: {
    flexShrink: 0,
  },
  toolTextBlock: {
    flex: 1,
    gap: spacing[1],
  },
  toolTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  toolSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.xs * 1.6,
  },
  lifestyleCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    ...shadows.card,
  },
  lifestyleTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  lifestyleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.secondaryContainer}4d`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  lifestyleMeta: {
    flex: 1,
    gap: spacing[0.5],
  },
  lifestyleTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
  },
  lifestyleSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
  },
  lifestyleDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginBottom: spacing[4],
  },
  lifestyleQuote: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    fontStyle: "italic",
    color: colors.tertiaryContainer,
  },
});
