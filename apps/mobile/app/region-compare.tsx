/**
 * 지역 이동 비교 (Region Hop Comparison)
 *
 * Shows how benefits change when a user moves between cities.
 * Compares programs available in the current region vs a target region,
 * highlighting what is gained, lost, or kept.
 *
 * TODO(API): Replace MOCK_REGION_PROGRAMS with real endpoint.
 *   Suggested: GET /api/v1/programs/region-compare?from=<regionCode>&to=<regionCode>
 *   Should return { from: Program[], to: Program[], both: Program[] }
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useOnboardingStore } from "../store/onboarding";
import {
  borderRadius,
  colors,
  componentStyles,
  layout,
  shadows,
  spacing,
  typography,
} from "../constants/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegionProgram {
  id: string;
  title: string;
  provider: string;
  type: "scholarship" | "support" | "welfare";
  /** Monthly benefit in KRW. null if non-recurring. */
  benefit_monthly: number | null;
  /** One-time or semester benefit in KRW. null if not applicable. */
  benefit_other: number | null;
  regions: string[];
}

type BenefitCategory = "lose" | "gain" | "keep";

interface ClassifiedProgram {
  program: RegionProgram;
  category: BenefitCategory;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REGION_OPTIONS = [
  { label: "서울", value: "seoul" },
  { label: "부산", value: "busan" },
  { label: "대구", value: "daegu" },
  { label: "인천", value: "incheon" },
  { label: "대전", value: "daejeon" },
  { label: "광주", value: "gwangju" },
  { label: "전국", value: "national" },
] as const;

type RegionValue = (typeof REGION_OPTIONS)[number]["value"];

/**
 * Maps onboarding region strings (Korean labels) to RegionValue codes.
 * TODO(API): Remove once onboarding stores region codes directly.
 */
const LABEL_TO_CODE: Record<string, RegionValue> = {
  서울: "seoul",
  부산: "busan",
  대구: "daegu",
  인천: "incheon",
  대전: "daejeon",
  광주: "gwangju",
  전국: "national",
};

// ---------------------------------------------------------------------------
// Mock data
// TODO(API): Replace with real API call to GET /api/v1/programs/region-compare
// ---------------------------------------------------------------------------

const MOCK_REGION_PROGRAMS: RegionProgram[] = [
  // National — available everywhere
  {
    id: "nat-1",
    title: "국가장학금 I유형",
    provider: "한국장학재단",
    type: "scholarship",
    benefit_monthly: null,
    benefit_other: 3500000,
    regions: ["national", "seoul", "busan", "daegu", "incheon", "daejeon", "gwangju"],
  },
  {
    id: "nat-2",
    title: "청년 주거급여 분리지급",
    provider: "국토교통부",
    type: "welfare",
    benefit_monthly: 330000,
    benefit_other: null,
    regions: ["national", "seoul", "busan", "daegu", "incheon", "daejeon", "gwangju"],
  },
  {
    id: "nat-3",
    title: "청년 내일채움공제",
    provider: "고용노동부",
    type: "support",
    benefit_monthly: null,
    benefit_other: 4000000,
    regions: ["national", "seoul", "busan", "daegu", "incheon", "daejeon", "gwangju"],
  },

  // Seoul-specific
  {
    id: "sel-1",
    title: "서울 청년 월세 지원",
    provider: "서울특별시",
    type: "welfare",
    benefit_monthly: 200000,
    benefit_other: null,
    regions: ["seoul"],
  },
  {
    id: "sel-2",
    title: "서울장학재단 장학금",
    provider: "서울장학재단",
    type: "scholarship",
    benefit_monthly: null,
    benefit_other: 2000000,
    regions: ["seoul"],
  },
  {
    id: "sel-3",
    title: "서울 청년 교통비 지원",
    provider: "서울특별시",
    type: "support",
    benefit_monthly: 60000,
    benefit_other: null,
    regions: ["seoul"],
  },

  // Busan-specific
  {
    id: "bus-1",
    title: "부산 청년 월세 지원",
    provider: "부산광역시",
    type: "welfare",
    benefit_monthly: 180000,
    benefit_other: null,
    regions: ["busan"],
  },
  {
    id: "bus-2",
    title: "부산 청년 창업 지원금",
    provider: "부산광역시",
    type: "support",
    benefit_monthly: null,
    benefit_other: 5000000,
    regions: ["busan"],
  },
  {
    id: "bus-3",
    title: "부산인재평생교육진흥원 장학금",
    provider: "부산인재평생교육진흥원",
    type: "scholarship",
    benefit_monthly: null,
    benefit_other: 1500000,
    regions: ["busan"],
  },

  // Daegu-specific
  {
    id: "dgu-1",
    title: "대구 청년 행복주택 지원",
    provider: "대구광역시",
    type: "welfare",
    benefit_monthly: 150000,
    benefit_other: null,
    regions: ["daegu"],
  },
  {
    id: "dgu-2",
    title: "대구 청년 일자리 장려금",
    provider: "대구광역시",
    type: "support",
    benefit_monthly: null,
    benefit_other: 2400000,
    regions: ["daegu"],
  },

  // Incheon-specific
  {
    id: "ich-1",
    title: "인천 청년 보증금 지원",
    provider: "인천광역시",
    type: "welfare",
    benefit_monthly: null,
    benefit_other: 3000000,
    regions: ["incheon"],
  },
  {
    id: "ich-2",
    title: "인천 청년 교통비 지원",
    provider: "인천광역시",
    type: "support",
    benefit_monthly: 50000,
    benefit_other: null,
    regions: ["incheon"],
  },

  // Daejeon-specific
  {
    id: "djo-1",
    title: "대전 청년 월세 지원",
    provider: "대전광역시",
    type: "welfare",
    benefit_monthly: 160000,
    benefit_other: null,
    regions: ["daejeon"],
  },
  {
    id: "djo-2",
    title: "대전 청년 창업 바우처",
    provider: "대전광역시",
    type: "support",
    benefit_monthly: null,
    benefit_other: 3000000,
    regions: ["daejeon"],
  },

  // Gwangju-specific
  {
    id: "gwj-1",
    title: "광주 청년 드림 장학금",
    provider: "광주광역시",
    type: "scholarship",
    benefit_monthly: null,
    benefit_other: 2000000,
    regions: ["gwangju"],
  },
  {
    id: "gwj-2",
    title: "광주 청년 생활비 지원",
    provider: "광주광역시",
    type: "welfare",
    benefit_monthly: 200000,
    benefit_other: null,
    regions: ["gwangju"],
  },
];

// ---------------------------------------------------------------------------
// Data logic
// ---------------------------------------------------------------------------

function getProgramsForRegion(regionCode: RegionValue): RegionProgram[] {
  // A program is available in a region if its regions array contains that code
  // OR contains "national".
  return MOCK_REGION_PROGRAMS.filter(
    (p) =>
      p.regions.includes(regionCode) || p.regions.includes("national")
  );
}

function classifyPrograms(
  fromCode: RegionValue,
  toCode: RegionValue
): ClassifiedProgram[] {
  const fromPrograms = getProgramsForRegion(fromCode);
  const toPrograms = getProgramsForRegion(toCode);

  const toIds = new Set(toPrograms.map((p) => p.id));
  const fromIds = new Set(fromPrograms.map((p) => p.id));

  const result: ClassifiedProgram[] = [];

  // Programs only in fromRegion (will lose)
  for (const p of fromPrograms) {
    if (!toIds.has(p.id)) {
      result.push({ program: p, category: "lose" });
    }
  }

  // Programs only in toRegion (will gain)
  for (const p of toPrograms) {
    if (!fromIds.has(p.id)) {
      result.push({ program: p, category: "gain" });
    }
  }

  // Programs in both (keep)
  for (const p of fromPrograms) {
    if (toIds.has(p.id)) {
      result.push({ program: p, category: "keep" });
    }
  }

  return result;
}

/** Estimate total monthly benefit (KRW) for a list of programs. */
function estimateMonthly(programs: RegionProgram[]): number {
  return programs.reduce((sum, p) => {
    if (p.benefit_monthly) return sum + p.benefit_monthly;
    // Amortise one-time/semester benefits: treat semester as ~4 months, once as ~12 months
    if (p.benefit_other) return sum + Math.round(p.benefit_other / 12);
    return sum;
  }, 0);
}

function formatManwon(krw: number): string {
  const man = Math.round(krw / 10000);
  return `${man}만원`;
}

function typeLabel(type: RegionProgram["type"]): string {
  switch (type) {
    case "scholarship":
      return "장학금";
    case "support":
      return "청년정책";
    case "welfare":
      return "복지/생활";
  }
}

function typeColor(type: RegionProgram["type"]): string {
  switch (type) {
    case "scholarship":
      return colors.primary;
    case "support":
      return colors.tertiary;
    case "welfare":
      return "#6b7280";
  }
}

function typeBackground(type: RegionProgram["type"]): string {
  switch (type) {
    case "scholarship":
      return colors.primaryFixed;
    case "support":
      return colors.tertiaryFixed;
    case "welfare":
      return colors.surfaceContainerHigh;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RegionSelectorProps {
  label: string;
  value: RegionValue | null;
  onChange: (v: RegionValue) => void;
  excludeValue?: RegionValue | null;
}

function RegionSelector({ label, value, onChange, excludeValue }: RegionSelectorProps) {
  const options = REGION_OPTIONS.filter((o) => o.value !== excludeValue);

  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={active ? styles.chipActive : styles.chipInactive}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.chipText,
                  active ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface BenefitCardProps {
  program: RegionProgram;
  category: BenefitCategory;
}

function BenefitCard({ program, category }: BenefitCardProps) {
  const categoryStyle = CATEGORY_STYLES[category];

  const benefitText = program.benefit_monthly
    ? `월 ${formatManwon(program.benefit_monthly)}`
    : program.benefit_other
    ? `최대 ${formatManwon(program.benefit_other)}`
    : "혜택 확인";

  return (
    <View style={[styles.benefitCard, { borderLeftColor: categoryStyle.accent }]}>
      {/* Category badge */}
      <View
        style={[
          styles.categoryBadge,
          { backgroundColor: categoryStyle.badgeBg },
        ]}
      >
        <Text style={[styles.categoryBadgeText, { color: categoryStyle.accent }]}>
          {categoryStyle.label}
        </Text>
      </View>

      <View style={styles.benefitCardBody}>
        {/* Type tag */}
        <View
          style={[
            styles.typeTag,
            { backgroundColor: typeBackground(program.type) },
          ]}
        >
          <Text style={[styles.typeTagText, { color: typeColor(program.type) }]}>
            {typeLabel(program.type)}
          </Text>
        </View>

        <Text style={styles.benefitCardTitle} numberOfLines={2}>
          {program.title}
        </Text>

        <View style={styles.benefitCardFooter}>
          <Text style={styles.providerText}>{program.provider}</Text>
          <Text style={styles.benefitAmountText}>{benefitText}</Text>
        </View>
      </View>
    </View>
  );
}

const CATEGORY_STYLES: Record<
  BenefitCategory,
  { label: string; accent: string; badgeBg: string }
> = {
  lose: {
    label: "이동 후 소멸",
    accent: colors.error,
    badgeBg: colors.errorContainer,
  },
  gain: {
    label: "이동 후 신규",
    accent: "#16a34a",
    badgeBg: "#dcfce7",
  },
  keep: {
    label: "계속 유지",
    accent: colors.outline,
    badgeBg: colors.surfaceContainerHigh,
  },
};

// ---------------------------------------------------------------------------
// Summary banner
// ---------------------------------------------------------------------------

interface SummaryBannerProps {
  fromMonthly: number;
  toMonthly: number;
  fromLabel: string;
  toLabel: string;
}

function SummaryBanner({ fromMonthly, toMonthly, fromLabel, toLabel }: SummaryBannerProps) {
  const diff = toMonthly - fromMonthly;
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  const diffColor = isNeutral
    ? colors.outline
    : isPositive
    ? "#16a34a"
    : colors.error;

  const diffText = isNeutral
    ? "변화 없음"
    : isPositive
    ? `${formatManwon(diff)} 증가`
    : `${formatManwon(Math.abs(diff))} 감소`;

  return (
    <View style={styles.summaryBanner}>
      <Text style={styles.summaryTitle}>월 총 혜택 비교</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryRegionBlock}>
          <Text style={styles.summaryRegionLabel}>{fromLabel}</Text>
          <Text style={styles.summaryAmount}>{formatManwon(fromMonthly)}</Text>
        </View>

        <View style={styles.summaryArrowBlock}>
          <Text style={styles.summaryArrow}>→</Text>
        </View>

        <View style={styles.summaryRegionBlock}>
          <Text style={styles.summaryRegionLabel}>{toLabel}</Text>
          <Text style={styles.summaryAmount}>{formatManwon(toMonthly)}</Text>
        </View>
      </View>

      <View style={[styles.summaryDiffChip, { backgroundColor: diffColor + "1a" }]}>
        <Text style={[styles.summaryDiffText, { color: diffColor }]}>
          {diffText}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Count diff banner
// ---------------------------------------------------------------------------

interface CountDiffBannerProps {
  gainCount: number;
  loseCount: number;
}

function CountDiffBanner({ gainCount, loseCount }: CountDiffBannerProps) {
  const net = gainCount - loseCount;
  const isPositive = net > 0;
  const isNeutral = net === 0;

  let message: string;
  let bgColor: string;
  let textColor: string;

  if (isNeutral) {
    message = "혜택 건수 변화 없어요";
    bgColor = colors.surfaceContainerHigh;
    textColor = colors.textSecondary;
  } else if (isPositive) {
    message = `+${net}건 더 받을 수 있어요`;
    bgColor = "#dcfce7";
    textColor = "#16a34a";
  } else {
    message = `${net}건 줄어들어요`;
    bgColor = colors.errorContainer;
    textColor = colors.error;
  }

  return (
    <View style={[styles.countBanner, { backgroundColor: bgColor }]}>
      <Text style={[styles.countBannerText, { color: textColor }]}>
        {message}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Column header
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  label: string;
  count: number;
  side: "from" | "to";
}

function ColumnHeader({ label, count, side }: ColumnHeaderProps) {
  const bg = side === "from" ? colors.surfaceContainerLow : colors.primaryFixed;
  const textCol = side === "from" ? colors.textSecondary : colors.primary;

  return (
    <View style={[styles.columnHeader, { backgroundColor: bg }]}>
      <Text style={[styles.columnHeaderLabel, { color: textCol }]}>{label}</Text>
      <Text style={[styles.columnHeaderCount, { color: textCol }]}>{count}건</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RegionCompareScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const onboardingRegion = useOnboardingStore((s) => s.region);

  const defaultFrom: RegionValue | null =
    (LABEL_TO_CODE[onboardingRegion] as RegionValue) ?? null;

  const [fromRegion, setFromRegion] = useState<RegionValue | null>(defaultFrom);
  const [toRegion, setToRegion] = useState<RegionValue | null>(null);

  const canCompare = fromRegion !== null && toRegion !== null;

  const classified = useMemo<ClassifiedProgram[]>(() => {
    if (!canCompare) return [];
    return classifyPrograms(fromRegion!, toRegion!);
  }, [fromRegion, toRegion, canCompare]);

  const gainItems = classified.filter((c) => c.category === "gain");
  const loseItems = classified.filter((c) => c.category === "lose");
  const keepItems = classified.filter((c) => c.category === "keep");

  const fromPrograms = useMemo(
    () => (fromRegion ? getProgramsForRegion(fromRegion) : []),
    [fromRegion]
  );
  const toPrograms = useMemo(
    () => (toRegion ? getProgramsForRegion(toRegion) : []),
    [toRegion]
  );

  const fromMonthly = useMemo(() => estimateMonthly(fromPrograms), [fromPrograms]);
  const toMonthly = useMemo(() => estimateMonthly(toPrograms), [toPrograms]);

  const fromLabel =
    REGION_OPTIONS.find((o) => o.value === fromRegion)?.label ?? "현재 지역";
  const toLabel =
    REGION_OPTIONS.find((o) => o.value === toRegion)?.label ?? "이동 지역";

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>지역 이동 비교</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Region selectors */}
        <View style={styles.selectorsCard}>
          <RegionSelector
            label="현재 지역"
            value={fromRegion}
            onChange={setFromRegion}
            excludeValue={toRegion}
          />

          <View style={styles.selectorDivider} />

          <RegionSelector
            label="이동 지역"
            value={toRegion}
            onChange={setToRegion}
            excludeValue={fromRegion}
          />
        </View>

        {!canCompare && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🗺</Text>
            <Text style={styles.emptyStateTitle}>두 지역을 선택해 주세요</Text>
            <Text style={styles.emptyStateBody}>
              현재 지역과 이동할 지역을 선택하면{"\n"}혜택 변화를 바로 확인할 수 있어요
            </Text>
          </View>
        )}

        {canCompare && (
          <>
            {/* Side-by-side count headers */}
            <View style={styles.columnHeaderRow}>
              <View style={styles.columnHeaderCell}>
                <ColumnHeader
                  label={`${fromLabel} 혜택`}
                  count={fromPrograms.length}
                  side="from"
                />
              </View>
              <View style={styles.columnHeaderCell}>
                <ColumnHeader
                  label={`${toLabel} 혜택`}
                  count={toPrograms.length}
                  side="to"
                />
              </View>
            </View>

            {/* Count diff banner */}
            <CountDiffBanner
              gainCount={gainItems.length}
              loseCount={loseItems.length}
            />

            {/* Monthly total summary */}
            <SummaryBanner
              fromMonthly={fromMonthly}
              toMonthly={toMonthly}
              fromLabel={fromLabel}
              toLabel={toLabel}
            />

            {/* Gain section */}
            {gainItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: "#16a34a" }]} />
                  <Text style={styles.sectionTitle}>
                    {toLabel}에서 새로 받을 수 있어요
                  </Text>
                  <View style={[styles.sectionCount, { backgroundColor: "#dcfce7" }]}>
                    <Text style={[styles.sectionCountText, { color: "#16a34a" }]}>
                      +{gainItems.length}
                    </Text>
                  </View>
                </View>
                {gainItems.map(({ program }) => (
                  <BenefitCard
                    key={program.id}
                    program={program}
                    category="gain"
                  />
                ))}
              </View>
            )}

            {/* Lose section */}
            {loseItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.error }]} />
                  <Text style={styles.sectionTitle}>
                    {fromLabel}에서만 받을 수 있어요
                  </Text>
                  <View style={[styles.sectionCount, { backgroundColor: colors.errorContainer }]}>
                    <Text style={[styles.sectionCountText, { color: colors.error }]}>
                      -{loseItems.length}
                    </Text>
                  </View>
                </View>
                {loseItems.map(({ program }) => (
                  <BenefitCard
                    key={program.id}
                    program={program}
                    category="lose"
                  />
                ))}
              </View>
            )}

            {/* Keep section */}
            {keepItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.outline }]} />
                  <Text style={styles.sectionTitle}>두 지역 모두 받을 수 있어요</Text>
                  <View style={[styles.sectionCount, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Text style={[styles.sectionCountText, { color: colors.outline }]}>
                      {keepItems.length}
                    </Text>
                  </View>
                </View>
                {keepItems.map(({ program }) => (
                  <BenefitCard
                    key={program.id}
                    program={program}
                    category="keep"
                  />
                ))}
              </View>
            )}

            {/* API integration note — visible in dev only */}
            {/* TODO(API): Remove this disclaimer once real API is integrated. */}
            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerText}>
                현재 예시 데이터를 기반으로 표시됩니다. 실제 혜택은 신청 조건에 따라 다를 수 있어요.
              </Text>
            </View>
          </>
        )}
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
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: layout.headerHeight,
    paddingHorizontal: layout.pagePadding,
    backgroundColor: "rgba(248,249,250,0.92)",
    ...shadows.header,
  },
  backButton: {
    width: layout.touchTargetMin,
    height: layout.touchTargetMin,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: typography.fontSize.xl,
    color: colors.onSurface,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    ...typography.styles.sectionTitle,
    color: colors.onSurface,
  },
  headerRight: {
    width: layout.touchTargetMin,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[5],
    gap: spacing[4],
  },

  // Selectors card
  selectorsCard: {
    ...componentStyles.cardLg,
    gap: 0,
  },
  selectorContainer: {
    gap: spacing[2],
  },
  selectorLabel: {
    ...typography.styles.label,
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  chipActive: {
    ...componentStyles.chipActive,
  },
  chipInactive: {
    ...componentStyles.chipInactive,
  },
  chipText: {
    ...typography.styles.buttonLabelSm,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  chipTextInactive: {
    color: colors.textSecondary,
  },
  selectorDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginVertical: spacing[3],
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing[16],
    gap: spacing[3],
  },
  emptyStateIcon: {
    fontSize: 48,
  },
  emptyStateTitle: {
    ...typography.styles.sectionTitle,
    color: colors.textPrimary,
  },
  emptyStateBody: {
    ...typography.styles.bodyBase,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Column headers
  columnHeaderRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  columnHeaderCell: {
    flex: 1,
  },
  columnHeader: {
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    alignItems: "center",
    gap: spacing[1],
  },
  columnHeaderLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  columnHeaderCount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },

  // Count banner
  countBanner: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: "center",
  },
  countBannerText: {
    ...typography.styles.label,
    fontWeight: typography.fontWeight.bold,
  },

  // Summary banner
  summaryBanner: {
    ...componentStyles.cardLg,
    gap: spacing[3],
    alignItems: "center",
  },
  summaryTitle: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  summaryRegionBlock: {
    flex: 1,
    alignItems: "center",
    gap: spacing[1],
  },
  summaryRegionLabel: {
    ...typography.styles.caption,
    color: colors.textSecondary,
  },
  summaryAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
  },
  summaryArrowBlock: {
    paddingHorizontal: spacing[3],
  },
  summaryArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.outline,
  },
  summaryDiffChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
  },
  summaryDiffText: {
    ...typography.styles.label,
    fontWeight: typography.fontWeight.bold,
  },

  // Sections
  section: {
    gap: spacing[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    ...typography.styles.sectionTitle,
    flex: 1,
    color: colors.onSurface,
  },
  sectionCount: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    minWidth: 28,
    alignItems: "center",
  },
  sectionCountText: {
    ...typography.styles.badge,
    fontWeight: typography.fontWeight.bold,
  },

  // Benefit card
  benefitCard: {
    ...componentStyles.card,
    borderLeftWidth: 3,
    gap: spacing[2],
  },
  categoryBadge: {
    alignSelf: "flex-start",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
  },
  categoryBadgeText: {
    ...typography.styles.badge,
  },
  benefitCardBody: {
    gap: spacing[1.5],
  },
  typeTag: {
    alignSelf: "flex-start",
    borderRadius: borderRadius.md,
    paddingHorizontal: layout.badgePaddingHorizontal,
    paddingVertical: layout.badgePaddingVertical,
  },
  typeTagText: {
    ...typography.styles.badge,
  },
  benefitCardTitle: {
    ...typography.styles.cardTitle,
    color: colors.onSurface,
  },
  benefitCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing[1],
  },
  providerText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    flex: 1,
  },
  benefitAmountText: {
    ...typography.styles.label,
    color: colors.primary,
  },

  // Disclaimer
  disclaimerCard: {
    ...componentStyles.section,
    marginTop: spacing[2],
  },
  disclaimerText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
});
