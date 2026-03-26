/**
 * Explore / Search Page
 *
 * Data source: api.getPrograms({ program_type?, region? })
 *
 * On API failure the list falls back to static mock data and shows an
 * "오프라인 모드" banner. Client-side search/tab filtering is applied on top
 * of whatever data is available (live or mock).
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
} from "@/constants/theme";
import {
  api,
  formatBenefit,
  programTypeLabel,
  programStatusLabel,
  type ApiProgram,
} from "@/lib/api";
import OfflineBanner from "@/components/OfflineBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = "장학금" | "청년정책" | "복지/생활";
type TabOption = "전체" | Category;
type FilterChipKey = "지역" | "대학생/취준생" | "연령" | "소득" | "분류";

interface ExploreCard {
  id: string;
  category: string;
  status: string;
  title: string;
  location: string;
  amount: string;
}

// No mock fallback — always use real API data

// ---------------------------------------------------------------------------
// Adapter — ApiProgram → ExploreCard
// ---------------------------------------------------------------------------

const REGION_LABEL: Record<string, string> = {
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

function apiProgramToCard(p: ApiProgram): ExploreCard {
  const regionLabels =
    p.regions && p.regions.length > 0
      ? p.regions.map((r) => REGION_LABEL[r] ?? r).join(", ")
      : "전국";

  return {
    id: p.id,
    category: programTypeLabel(p.program_type),
    status: programStatusLabel(p.program_status, p.deadline_at),
    title: p.title,
    location: regionLabels,
    amount: formatBenefit(p),
  };
}

// ---------------------------------------------------------------------------
// Segmented control tabs & filter chips
// ---------------------------------------------------------------------------

const TABS: TabOption[] = ["전체", "장학금", "청년정책", "복지/생활"];
const FILTER_CHIPS: FilterChipKey[] = ["지역", "대학생/취준생", "연령", "소득", "분류"];
const DEFAULT_ACTIVE_CHIP: FilterChipKey = "대학생/취준생";

// ---------------------------------------------------------------------------
// Badge color helpers
// ---------------------------------------------------------------------------

function getCategoryBadgeColors(category: string): { bg: string; text: string } {
  switch (category) {
    case "장학금":
      return { bg: colors.primaryFixed, text: colors.primary };
    case "청년정책":
      return { bg: colors.secondaryContainer, text: colors.onSecondaryContainer };
    case "복지/생활":
      return { bg: colors.tertiaryFixed, text: colors.tertiary };
    default:
      return { bg: colors.surfaceContainerHighest, text: colors.onSurfaceVariant };
  }
}

function getStatusBadgeColors(status: string): { bg: string; text: string } {
  if (status === "신청 중" || status === "상시") {
    return { bg: colors.tertiaryFixed, text: colors.tertiary };
  }
  return { bg: colors.surfaceContainerHighest, text: colors.onSurfaceVariant };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

function SearchBar({ value, onChangeText }: SearchBarProps) {
  return (
    <View style={styles.searchWrapper}>
      <Ionicons name="search" size={20} color={colors.outline} />
      <TextInput
        style={styles.searchInput}
        placeholder="관심 있는 지원금을 검색해보세요"
        placeholderTextColor={colors.outline}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        accessibilityLabel="지원금 검색"
        accessibilityHint="검색어를 입력하세요"
      />
    </View>
  );
}

interface FilterChipProps {
  label: FilterChipKey;
  isActive: boolean;
  onPress: () => void;
}

function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={
        isActive ? `${label} 필터 선택됨, 제거하려면 탭` : `${label} 필터`
      }
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Text
        style={[
          styles.chipLabel,
          isActive ? styles.chipLabelActive : styles.chipLabelInactive,
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name={isActive ? "close" : "chevron-down"}
        size={14}
        color={isActive ? colors.onPrimary : colors.onSurfaceVariant}
      />
    </TouchableOpacity>
  );
}

interface SegmentedControlProps {
  tabs: TabOption[];
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
}

function SegmentedControl({
  tabs,
  activeTab,
  onTabChange,
}: SegmentedControlProps) {
  return (
    <View style={styles.segmentedControl} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.segmentItem, isActive && styles.segmentItemActive]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab}
          >
            <Text
              style={[
                styles.segmentText,
                isActive
                  ? styles.segmentTextActive
                  : styles.segmentTextInactive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface ProgramCardProps {
  item: ExploreCard;
  onPress: () => void;
}

const ProgramCard = React.memo(function ProgramCard({ item, onPress }: ProgramCardProps) {
  const catColors = getCategoryBadgeColors(item.category);
  const statusColors = getStatusBadgeColors(item.status);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${item.category}, ${item.title}, ${item.amount}`}
      accessibilityHint="프로그램 상세 보기"
    >
      <View style={styles.cardBadgeRow}>
        <View style={[styles.badge, { backgroundColor: catColors.bg }]}>
          <Text style={[styles.badgeText, { color: catColors.text }]}>
            {item.category}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.badgeText, { color: statusColors.text }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={styles.cardLocationRow}>
        <Ionicons name="location-outline" size={14} color={colors.onSurfaceVariant} />
        <Text style={styles.cardLocation}>{item.location}</Text>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardFooter}>
        <Text style={styles.cardAmount}>{item.amount}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.outlineVariant} />
      </View>
    </TouchableOpacity>
  );
});

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="search-outline" size={36} color={colors.outlineVariant} />
      </View>
      <Text style={styles.emptyText}>
        검색 결과가 없습니다.{"\n"}다른 키워드로 검색해보세요.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeChip, setActiveChip] =
    useState<FilterChipKey>(DEFAULT_ACTIVE_CHIP);
  const [activeTab, setActiveTab] = useState<TabOption>("전체");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["programs"],
    queryFn: () => api.getPrograms(),
    staleTime: 5 * 60 * 1000,   // 5 min
    gcTime: 30 * 60 * 1000,     // 30 min cache
    retry: 1,
  });

  // Build card list from API data only
  const allCards = useMemo<ExploreCard[]>(() => {
    if (data?.items) return data.items.map(apiProgramToCard);
    return [];
  }, [data]);

  // Client-side filtering on top of the fetched list
  const filteredPrograms = useMemo<ExploreCard[]>(() => {
    let list = allCards;

    if (activeTab !== "전체") {
      list = list.filter((p) => p.category === activeTab);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.amount.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allCards, searchQuery, activeTab]);

  const handleChipPress = useCallback((chip: FilterChipKey) => {
    setActiveChip((prev) => (prev === chip ? "지역" : chip));
  }, []);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/programs/${id}`);
    },
    [router]
  );

  const renderCard = useCallback(
    ({ item }: { item: ExploreCard }) => (
      <ProgramCard item={item} onPress={() => handleCardPress(item.id)} />
    ),
    [handleCardPress]
  );

  const keyExtractor = useCallback((item: ExploreCard) => item.id, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {isError && <OfflineBanner />}

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>프로그램 목록을 불러오는 중...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPrograms}
          keyExtractor={keyExtractor}
          renderItem={renderCard}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: insets.bottom + layout.tabBarHeight + spacing[4],
            },
          ]}
          ListHeaderComponent={
            <>
              <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContent}
              >
                {FILTER_CHIPS.map((chip) => (
                  <FilterChip
                    key={chip}
                    label={chip}
                    isActive={chip === activeChip}
                    onPress={() => handleChipPress(chip)}
                  />
                ))}
              </ScrollView>

              <SegmentedControl
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />

              <Text style={styles.resultsCount}>
                {filteredPrograms.length}개의 프로그램
              </Text>
            </>
          }
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
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

  // Loading center
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
  },

  // FlatList content
  listContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[5],
    gap: spacing[4],
  },

  // Search bar
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    height: 64,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    ...shadows.cardMd,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.body,
    color: colors.onSurface,
    paddingVertical: 0,
    margin: 0,
  },

  // Filter chips
  chipsScroll: {
    marginHorizontal: -layout.pagePadding,
  },
  chipsContent: {
    paddingHorizontal: layout.pagePadding,
    gap: spacing[2],
    paddingBottom: spacing[1],
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.full,
    minHeight: layout.touchTargetMin,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipInactive: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  chipLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.body,
  },
  chipLabelActive: {
    color: colors.onPrimary,
  },
  chipLabelInactive: {
    color: colors.onSurfaceVariant,
  },

  // Segmented control
  segmentedControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing[1.5],
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.lg,
    minHeight: layout.touchTargetMin,
  },
  segmentItemActive: {
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.card,
  },
  segmentText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.body,
  },
  segmentTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  segmentTextInactive: {
    color: colors.onSurfaceVariant,
    fontWeight: typography.fontWeight.semibold,
  },

  // Results count
  resultsCount: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.fontWeight.medium,
    marginBottom: -spacing[1],
  },

  // Program card
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    gap: spacing[3],
    ...shadows.cardMd,
  },
  cardBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.body,
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
    lineHeight: typography.fontSize.lg * 1.35,
  },
  cardLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
  },
  cardLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.fontWeight.regular,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: -spacing[6],
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    color: colors.primary,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[20],
    gap: spacing[4],
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.body,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: typography.fontSize.base * 1.5,
  },
});
