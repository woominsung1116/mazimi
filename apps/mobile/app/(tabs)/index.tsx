/**
 * 홈 탭 — 개인화 대시보드
 *
 * Data sources:
 *   - api.getDashboard()         → summary counts + upcoming deadlines (JWT auth)
 *   - api.getRecommendPreview()  → recommendation cards
 *
 * On API failure the screen falls back to static mock data and shows an
 * "오프라인 모드" banner so the user always sees something useful.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  gradients,
} from "@/constants/theme";
import {
  api,
  formatBenefit,
  programTypeLabel,
  programStatusLabel,
  type DashboardData,
  type RecommendationResult,
  type ApiProgram,
} from "@/lib/api";
import OfflineBanner from "@/components/OfflineBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeVariant = "recommended" | "available" | "deadline";

type SummaryIconName =
  | { lib: "ionicons"; name: keyof typeof Ionicons.glyphMap }
  | { lib: "material"; name: string };

interface SummaryCard {
  label: string;
  count: number;
  icon: SummaryIconName;
  iconBg: string;
  iconColor: string;
}

interface RecommendationCard {
  id: string;
  badge: BadgeVariant;
  locationLabel: string;
  locationIconName: keyof typeof Ionicons.glyphMap;
  title: string;
  amountLabel: string;
  tags: string[];
}

interface DocumentItem {
  id: string;
  status: "missing" | "done";
  title: string;
  subtitle: string;
}

// ---------------------------------------------------------------------------
// Mock fallback data — shown when API is unreachable
// ---------------------------------------------------------------------------

const MOCK_SUMMARY_CARDS: SummaryCard[] = [
  {
    label: "장학금",
    count: 3,
    icon: { lib: "ionicons", name: "school-outline" },
    iconBg: colors.primaryFixed,
    iconColor: colors.primary,
  },
  {
    label: "부산 청년 정책",
    count: 5,
    icon: { lib: "ionicons", name: "location-outline" },
    iconBg: colors.secondaryFixedDim,
    iconColor: colors.onSecondaryContainer,
  },
  {
    label: "복지/생활",
    count: 2,
    icon: { lib: "ionicons", name: "heart-outline" },
    iconBg: colors.tertiaryFixed,
    iconColor: colors.tertiary,
  },
];

const MOCK_RECOMMENDATION_CARDS: RecommendationCard[] = [
  {
    id: "r1",
    badge: "recommended",
    locationLabel: "부산광역시",
    locationIconName: "map-outline",
    title: "청년 희망 날개 장학금 (2024 하반기)",
    amountLabel: "최대 240만원",
    tags: ["등록금 지원", "성적 우수"],
  },
  {
    id: "r2",
    badge: "available",
    locationLabel: "국가장학금",
    locationIconName: "globe-outline",
    title: "한국장학재단 다자녀 국가장학금",
    amountLabel: "전액 지원",
    tags: ["가구원수 기준"],
  },
];

const MOCK_DOCUMENT_ITEMS: DocumentItem[] = [
  {
    id: "d1",
    status: "missing",
    title: "성적증명서 누락",
    subtitle: "청년 희망 날개 장학금",
  },
  {
    id: "d2",
    status: "done",
    title: "주민등록등본 확인 완료",
    subtitle: "국가장학금 신청",
  },
];

// ---------------------------------------------------------------------------
// Data adapters — convert API shapes to view-layer shapes
// ---------------------------------------------------------------------------

function buildSummaryCards(dashboard: DashboardData): SummaryCard[] {
  return [
    {
      label: "스크랩",
      count: dashboard.bookmarked_count,
      icon: { lib: "ionicons", name: "bookmark-outline" },
      iconBg: colors.primaryFixed,
      iconColor: colors.primary,
    },
    {
      label: "신청 중",
      count: dashboard.applying_count,
      icon: { lib: "ionicons", name: "document-text-outline" },
      iconBg: colors.secondaryFixedDim,
      iconColor: colors.onSecondaryContainer,
    },
    {
      label: "마감 임박",
      count: dashboard.upcoming_deadlines.length,
      icon: { lib: "ionicons", name: "time-outline" },
      iconBg: colors.tertiaryFixed,
      iconColor: colors.tertiary,
    },
  ];
}

function recommendationToBadge(score: number, deadline: string | null): BadgeVariant {
  if (deadline) {
    const days = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 7) return "deadline";
  }
  if (score >= 80) return "recommended";
  return "available";
}

function regionCodeToIconName(regionCode: string): keyof typeof Ionicons.glyphMap {
  if (regionCode === "busan") return "map-outline";
  if (regionCode === "daegu") return "business-outline";
  return "globe-outline";
}

function regionCodeToLabel(regions: string[] | null): string {
  if (!regions || regions.length === 0) return "전국";
  const map: Record<string, string> = {
    busan: "부산광역시",
    daegu: "대구광역시",
    seoul: "서울특별시",
    incheon: "인천광역시",
    gwangju: "광주광역시",
    daejeon: "대전광역시",
    ulsan: "울산광역시",
    sejong: "세종특별자치시",
    gyeonggi: "경기도",
  };
  return map[regions[0]] ?? regions[0];
}

function buildRecommendationCards(
  result: RecommendationResult
): RecommendationCard[] {
  return result.items.slice(0, 5).map((item) => ({
    id: item.program_id,
    badge: recommendationToBadge(item.match_score, item.deadline),
    locationLabel: "추천",
    locationIconName: "star-outline" as keyof typeof Ionicons.glyphMap,
    title: item.title,
    amountLabel: item.benefit_amount_monthly
      ? `월 ${Math.round(item.benefit_amount_monthly / 10000)}만원`
      : item.benefit_amount_semester
      ? `학기 ${Math.round(item.benefit_amount_semester / 10000)}만원`
      : "혜택 확인",
    tags: item.reasons.slice(0, 2).map((r) => r.replace(/[.!]/g, "")),
  }));
}

function buildDocumentItems(dashboard: DashboardData): DocumentItem[] {
  const items: DocumentItem[] = dashboard.todo_items.map((todo, i) => ({
    id: `todo-${i}`,
    status: "missing" as const,
    title: todo,
    subtitle: "프로필 설정",
  }));

  // Add upcoming deadlines as items
  dashboard.upcoming_deadlines.slice(0, 2).forEach((p) => {
    const days = p.deadline_at
      ? Math.ceil(
          (new Date(p.deadline_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;
    items.push({
      id: p.id,
      status: "missing",
      title: days !== null ? `마감 D-${days}` : "마감 임박",
      subtitle: p.title,
    });
  });

  return items.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Badge config
// ---------------------------------------------------------------------------

const BADGE_CONFIG: Record<
  BadgeVariant,
  { label: string; bg: string; textColor: string }
> = {
  recommended: {
    label: "추천",
    bg: colors.primaryFixed,
    textColor: colors.primary,
  },
  available: {
    label: "신청 가능",
    bg: "#e8f5e9",
    textColor: "#2e7d32",
  },
  deadline: {
    label: "마감 임박",
    bg: "#fff3e0",
    textColor: "#ef6c00",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryIconView({ icon, color }: { icon: SummaryIconName; color: string }) {
  if (icon.lib === "ionicons") {
    return <Ionicons name={icon.name} size={20} color={color} />;
  }
  return <MaterialIcons name={icon.name as any} size={20} color={color} />;
}

const SummaryCardItem = React.memo(function SummaryCardItem({ card }: { card: SummaryCard }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.summaryCard,
        pressed && styles.summaryCardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${card.label} ${card.count}건`}
    >
      <View style={styles.summaryCardLeft}>
        <Text style={styles.summaryLabel}>{card.label}</Text>
        <Text style={styles.summaryCount}>{card.count}건</Text>
      </View>
      <View
        style={[styles.summaryIconCircle, { backgroundColor: card.iconBg }]}
      >
        <SummaryIconView icon={card.icon} color={card.iconColor} />
      </View>
    </Pressable>
  );
});

const RecommendationCardItem = React.memo(function RecommendationCardItem({ card }: { card: RecommendationCard }) {
  const badge = BADGE_CONFIG[card.badge];
  const router = useRouter();

  const handlePress = useCallback(() => {
    router.push(`/programs/${card.id}`);
  }, [card.id, router]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.recommendCard,
        pressed && styles.recommendCardPressed,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}, ${card.amountLabel}`}
    >
      <View style={[styles.recommendBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.recommendBadgeText, { color: badge.textColor }]}>
          {badge.label}
        </Text>
      </View>

      <View style={styles.recommendLocationRow}>
        <Ionicons
          name={card.locationIconName}
          size={15}
          color={colors.tertiary}
        />
        <Text style={styles.recommendLocationLabel}>{card.locationLabel}</Text>
      </View>

      <Text style={styles.recommendTitle}>{card.title}</Text>
      <Text style={styles.recommendAmount}>{card.amountLabel}</Text>

      <View style={styles.recommendTagsRow}>
        {card.tags.map((tag) => (
          <View key={tag} style={styles.recommendTag}>
            <Text style={styles.recommendTagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
});

const DocumentItemRow = React.memo(function DocumentItemRow({ item }: { item: DocumentItem }) {
  const isMissing = item.status === "missing";
  return (
    <View style={[styles.docItem, !isMissing && styles.docItemDone]}>
      <View
        style={[
          styles.docIconBox,
          { backgroundColor: isMissing ? "#ffebee" : colors.surfaceContainer },
        ]}
      >
        {isMissing ? (
          <Ionicons name="document-text-outline" size={22} color="#c62828" />
        ) : (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        )}
      </View>
      <View style={styles.docTextBlock}>
        <Text style={styles.docTitle}>{item.title}</Text>
        <Text style={styles.docSubtitle}>{item.subtitle}</Text>
      </View>
      {isMissing && (
        <TouchableOpacity
          style={styles.docSubmitBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${item.subtitle} 서류 제출하기`}
        >
          <Text style={styles.docSubmitText}>확인</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Default profile for recommendation preview — will use real profile once
  // auth + profile store is wired; for now use a sensible default.
  const defaultProfile = {
    birth_year: 2001,
    region_code: "busan",
    enrollment_status: "enrolled",
  };

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "me"],
    queryFn: () => api.getDashboard(),
    staleTime: 5 * 60 * 1000,   // 5 min
    gcTime: 30 * 60 * 1000,     // 30 min cache
    retry: 1,
  });

  const recommendQuery = useQuery({
    queryKey: ["recommend-preview", defaultProfile],
    queryFn: () => api.getRecommendPreview(defaultProfile),
    staleTime: 10 * 60 * 1000,  // 10 min
    gcTime: 60 * 60 * 1000,     // 1 hr cache
    retry: 1,
  });

  const isOffline =
    (dashboardQuery.isError || recommendQuery.isError) &&
    !dashboardQuery.isLoading &&
    !recommendQuery.isLoading;

  const isLoading = dashboardQuery.isLoading || recommendQuery.isLoading;

  // Resolve display data — prefer API, fall back to mocks
  const summaryCards: SummaryCard[] =
    dashboardQuery.data
      ? buildSummaryCards(dashboardQuery.data)
      : MOCK_SUMMARY_CARDS;

  const recommendationCards: RecommendationCard[] =
    recommendQuery.data
      ? buildRecommendationCards(recommendQuery.data)
      : MOCK_RECOMMENDATION_CARDS;

  const documentItems: DocumentItem[] =
    dashboardQuery.data
      ? buildDocumentItems(dashboardQuery.data)
      : MOCK_DOCUMENT_ITEMS;

  const handleAllRecommendations = useCallback(() => {
    router.push("/(tabs)/explore");
  }, [router]);

  const handleFindMoreBenefits = useCallback(() => {
    router.push("/onboarding");
  }, [router]);

  const handleFAB = useCallback(() => {
    router.push("/onboarding");
  }, [router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Glass header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
          <Text style={styles.headerLogo}>마지미</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBell}
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="알림"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      {/* Offline banner */}
      {isOffline && <OfflineBanner />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1 — Hero ── */}
        <View style={styles.section}>
          <Text style={styles.heroTitle}>이번 달 내가{"\n"}받을 수 있는 지원</Text>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.summaryRow}>
              {summaryCards.map((card) => (
                <SummaryCardItem key={card.label} card={card} />
              ))}
            </View>
          )}
        </View>

        {/* ── Section 2 — Recommendations ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>나에게 맞는 추천</Text>
            <TouchableOpacity
              onPress={handleAllRecommendations}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="추천 전체보기"
            >
              <Text style={styles.seeAllText}>전체보기 ›</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.recommendList}>
              {recommendationCards.map((card) => (
                <RecommendationCardItem key={card.id} card={card} />
              ))}
            </View>
          )}
        </View>

        {/* ── Section 2.5 — 유용한 도구 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>유용한 도구</Text>
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
              <MaterialIcons name="calculate" size={28} color={colors.primary} />
              <Text style={styles.toolTitle}>혜택 중복{"\n"}계산기</Text>
              <Text style={styles.toolSubtitle}>
                여러 혜택을 동시에 받을 수 있는지 확인
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.toolCard,
                pressed && styles.toolCardPressed,
              ]}
              onPress={() => router.push("/region-compare")}
              accessibilityRole="button"
              accessibilityLabel="조건 시뮬레이터"
            >
              <Ionicons name="options-outline" size={28} color={colors.primary} />
              <Text style={styles.toolTitle}>조건{"\n"}시뮬레이터</Text>
              <Text style={styles.toolSubtitle}>
                조건을 바꿔보면 혜택이 어떻게 바뀔까?
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Section 3 — Deadlines & Documents + CTA ── */}
        <View style={styles.section}>
          <View style={styles.docCard}>
            <View style={styles.docCardHeader}>
              <Text style={styles.sectionTitle}>마감 및 서류 확인</Text>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            </View>
            <View style={styles.docList}>
              {documentItems.length > 0 ? (
                documentItems.map((item) => (
                  <DocumentItemRow key={item.id} item={item} />
                ))
              ) : (
                <Text style={styles.docEmptyText}>
                  확인할 항목이 없습니다.
                </Text>
              )}
            </View>
          </View>

          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaCard}
          >
            <View>
              <Text style={styles.ctaTitle}>
                지원금 신청,{"\n"}아직 망설여지나요?
              </Text>
              <Text style={styles.ctaSubtitle}>
                나와 비슷한 조건의 다른 학생들은{"\n"}평균 3.5개의 혜택을 받고 있어요.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleFindMoreBenefits}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="내 맞춤 혜택 더 찾아보기"
            >
              <Text style={styles.ctaButtonText}>내 맞춤 혜택 더 찾아보기 →</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + layout.tabBarHeight + spacing[4] }]}
        onPress={handleFAB}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="새 혜택 추가"
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.pagePadding,
    paddingVertical: spacing[4],
    backgroundColor: "rgba(255,255,255,0.88)",
    ...shadows.header,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  headerBell: {
    width: layout.touchTargetMin,
    height: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing[8],
    paddingHorizontal: layout.pagePadding,
    gap: layout.sectionGapLg,
  },

  // Section
  section: {
    gap: layout.cardGapMd,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    letterSpacing: typography.letterSpacing.tight,
  },
  seeAllText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },

  // Hero
  heroTitle: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: typography.fontSize["3xl"] * 1.2,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing[1],
  },

  // Loading states
  loadingRow: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCard: {
    height: 120,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },

  // Summary cards row
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
  summaryCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  summaryCardLeft: {
    gap: spacing[0.5],
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  summaryCount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
  },
  summaryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  // Recommendation cards
  recommendList: {
    gap: layout.cardGapLg,
  },
  recommendCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[4],
    ...shadows.cardMd,
  },
  recommendCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  recommendBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: layout.badgePaddingHorizontal + 4,
    paddingVertical: layout.badgePaddingVertical,
    borderRadius: borderRadius.full,
  },
  recommendBadgeText: {
    ...typography.styles.badge,
  },
  recommendLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
  },
  recommendLocationLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.tertiary,
  },
  recommendTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: typography.fontSize.lg * 1.35,
  },
  recommendAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
  },
  recommendTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  recommendTag: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  recommendTagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Tools row
  toolsRow: {
    flexDirection: "row",
    gap: layout.cardGap,
  },
  toolCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    gap: spacing[2],
    ...shadows.cardMd,
  },
  toolCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  toolTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: typography.fontSize.base * 1.35,
  },
  toolSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: typography.fontSize.xs * 1.6,
  },

  // Document section
  docCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[5],
    ...shadows.card,
  },
  docCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  docList: {
    gap: spacing[3],
  },
  docEmptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    paddingVertical: spacing[4],
  },
  docItem: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    ...shadows.card,
  },
  docItemDone: {
    opacity: 0.7,
  },
  docIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  docTextBlock: {
    flex: 1,
  },
  docTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    marginBottom: spacing[0.5],
  },
  docSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  docSubmitBtn: {
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  docSubmitText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onErrorContainer,
  },

  // Gradient CTA
  ctaCard: {
    borderRadius: borderRadius.lg,
    padding: spacing[8],
    gap: spacing[8],
    ...shadows.cardLg,
  },
  ctaTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
    lineHeight: typography.fontSize["2xl"] * 1.3,
    marginBottom: spacing[2],
  },
  ctaSubtitle: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.82)",
    lineHeight: typography.fontSize.sm * 1.6,
  },
  ctaButton: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    height: layout.buttonHeightLg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  ctaButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },

  // FAB
  fab: {
    position: "absolute",
    right: layout.pagePadding,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.floating,
  },
});
