/**
 * 조건 시뮬레이터 (What-If Simulator)
 *
 * Lets users change any profile condition (region, enrollment status,
 * employment status, age, income bracket) and see how benefits change.
 *
 * Architecture:
 *  - "current" profile comes from useOnboardingStore
 *  - "simulated" profile is a local override state layered on top
 *  - Both profiles are fed to api.getRecommendPreview() with separate query keys
 *  - Gain / lose / keep classification is derived by diffing the two result sets
 *    by program_id
 *  - Region section retains the existing chip-based region selector (backward compat)
 *
 * Fallback: if the recommendation API is unavailable, the region-program mock
 * data set is used (same as before) so the screen is always useful offline.
 */

import React, { useMemo, useState, useCallback } from "react";
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
import { useQuery } from "@tanstack/react-query";

import { useOnboardingStore, getBirthYear } from "../store/onboarding";
import { api, type ProfileInput, type RecommendationItem } from "../lib/api";
import OfflineBanner from "../components/OfflineBanner";
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
// Constants / option sets
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

const LABEL_TO_CODE: Record<string, RegionValue> = {
  서울: "seoul",
  부산: "busan",
  대구: "daegu",
  인천: "incheon",
  대전: "daejeon",
  광주: "gwangju",
  전국: "national",
};

const ENROLLMENT_OPTIONS = [
  { label: "재학", value: "enrolled" },
  { label: "휴학", value: "leave_of_absence" },
  { label: "졸업", value: "graduated" },
  { label: "해당없음", value: "none" },
] as const;

const EMPLOYMENT_OPTIONS = [
  { label: "미취업", value: "unemployed" },
  { label: "재직", value: "employed" },
  { label: "프리랜서", value: "freelancer" },
] as const;

const INCOME_OPTIONS = [
  { label: "미입력", value: null },
  { label: "3분위", value: 3 },
  { label: "5분위", value: 5 },
  { label: "8분위", value: 8 },
] as const;

// Age delta presets — applied on top of current age
const AGE_OPTIONS = [
  { label: "현재", value: 0 },
  { label: "+1년", value: 1 },
  { label: "+2년", value: 2 },
  { label: "+3년", value: 3 },
  { label: "+5년", value: 5 },
] as const satisfies readonly { label: string; value: number }[];

// ---------------------------------------------------------------------------
// Scenario presets
// ---------------------------------------------------------------------------

interface Scenario {
  label: string;
  description: string;
  overrides: Partial<SimOverrides>;
}

const SCENARIOS: Scenario[] = [
  {
    label: "졸업하면?",
    description: "학적: 재학 → 졸업",
    overrides: { enrollmentStatus: "graduated" },
  },
  {
    label: "취업하면?",
    description: "취업: 미취업 → 재직",
    overrides: { employmentStatus: "employed" },
  },
  {
    label: "서울로 이사하면?",
    description: "지역: 현재 → 서울",
    overrides: { regionCode: "seoul" },
  },
  {
    label: "대구로 이사하면?",
    description: "지역: 현재 → 대구",
    overrides: { regionCode: "daegu" },
  },
  {
    label: "소득이 생기면?",
    description: "소득: 미입력 → 5분위",
    overrides: { incomeBracket: 5 },
  },
];

// ---------------------------------------------------------------------------
// Sim override type (all optional — only changed fields)
// ---------------------------------------------------------------------------

interface SimOverrides {
  regionCode: RegionValue | null;
  enrollmentStatus: string | null;
  employmentStatus: string | null;
  ageDelta: number;
  incomeBracket: number | null;
}

const DEFAULT_OVERRIDES: SimOverrides = {
  regionCode: null,
  enrollmentStatus: null,
  employmentStatus: null,
  ageDelta: 0,
  incomeBracket: null,
};

// ---------------------------------------------------------------------------
// Benefit change classification
// ---------------------------------------------------------------------------

type BenefitCategory = "lose" | "gain" | "keep";

interface ClassifiedItem {
  item: RecommendationItem;
  category: BenefitCategory;
}

function classifyItems(
  currentItems: RecommendationItem[],
  simItems: RecommendationItem[]
): ClassifiedItem[] {
  const simIds = new Set(simItems.map((i) => i.program_id));
  const currentIds = new Set(currentItems.map((i) => i.program_id));
  const result: ClassifiedItem[] = [];

  for (const item of currentItems) {
    if (!simIds.has(item.program_id)) {
      result.push({ item, category: "lose" });
    }
  }
  for (const item of simItems) {
    if (!currentIds.has(item.program_id)) {
      result.push({ item, category: "gain" });
    }
  }
  for (const item of currentItems) {
    if (simIds.has(item.program_id)) {
      result.push({ item, category: "keep" });
    }
  }

  return result;
}

function estimateMonthlyFromItems(items: RecommendationItem[]): number {
  return items.reduce((sum, item) => {
    if (item.benefit_amount_monthly) return sum + item.benefit_amount_monthly;
    if (item.benefit_amount_semester)
      return sum + Math.round(item.benefit_amount_semester / 4);
    return sum;
  }, 0);
}

function formatManwon(krw: number): string {
  const man = Math.round(krw / 10000);
  return `${man}만원`;
}

// No mock fallback — always use real API data

// ---------------------------------------------------------------------------
// Profile builder helpers
// ---------------------------------------------------------------------------

function buildCurrentProfile(
  region: string,
  age: string,
  enrollmentStatus: string,
  employmentStatus: string,
  incomeBracket: number | null
): ProfileInput {
  const regionCode = (LABEL_TO_CODE[region] as RegionValue) ?? "national";
  const parsedAge = parseInt(age, 10);
  const birthYear = isNaN(parsedAge) ? 2001 : new Date().getFullYear() - parsedAge;

  return {
    birth_year: birthYear,
    region_code: regionCode,
    enrollment_status: enrollmentStatus || null,
    employment_status: employmentStatus || null,
    income_bracket: incomeBracket,
  };
}

function applyOverrides(
  base: ProfileInput,
  overrides: SimOverrides
): ProfileInput {
  const result = { ...base };

  if (overrides.regionCode !== null) {
    result.region_code = overrides.regionCode;
  }
  if (overrides.enrollmentStatus !== null) {
    result.enrollment_status = overrides.enrollmentStatus;
  }
  if (overrides.employmentStatus !== null) {
    result.employment_status = overrides.employmentStatus;
  }
  if (overrides.ageDelta !== 0) {
    result.birth_year = base.birth_year - overrides.ageDelta;
  }
  if (overrides.incomeBracket !== null) {
    result.income_bracket = overrides.incomeBracket;
  }

  return result;
}

function hasAnyOverride(ov: SimOverrides): boolean {
  return (
    ov.regionCode !== null ||
    ov.enrollmentStatus !== null ||
    ov.employmentStatus !== null ||
    ov.ageDelta !== 0 ||
    ov.incomeBracket !== null
  );
}

// ---------------------------------------------------------------------------
// Category style map
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<
  BenefitCategory,
  { label: string; accent: string; badgeBg: string }
> = {
  lose: {
    label: "변경 후 소멸",
    accent: colors.error,
    badgeBg: colors.errorContainer,
  },
  gain: {
    label: "변경 후 신규",
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
// Sub-components
// ---------------------------------------------------------------------------

/** Single-row chip selector — generic over option type */
function ChipSelector<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.conditionRow}>
      <Text style={styles.conditionLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScrollContent}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={String(opt.value)}
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

/** Expandable condition section card */
function ConditionSection({
  icon,
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.conditionCard}>
      <Pressable
        style={styles.conditionHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={4}
      >
        <Text style={styles.conditionIcon}>{icon}</Text>
        <View style={styles.conditionHeaderText}>
          <Text style={styles.conditionTitle}>{title}</Text>
          <Text style={styles.conditionSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.conditionChevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded && <View style={styles.conditionBody}>{children}</View>}
    </View>
  );
}

/** A single result item card with gain/lose/keep coloring */
function ResultItemCard({ classified }: { classified: ClassifiedItem }) {
  const { item, category } = classified;
  const catStyle = CATEGORY_STYLES[category];

  const benefitText = item.benefit_amount_monthly
    ? `월 ${formatManwon(item.benefit_amount_monthly)}`
    : item.benefit_amount_semester
    ? `학기 ${formatManwon(item.benefit_amount_semester)}`
    : "혜택 확인";

  return (
    <View style={[styles.resultCard, { borderLeftColor: catStyle.accent }]}>
      <View
        style={[styles.resultBadge, { backgroundColor: catStyle.badgeBg }]}
      >
        <Text style={[styles.resultBadgeText, { color: catStyle.accent }]}>
          {catStyle.label}
        </Text>
      </View>
      <Text style={styles.resultTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.resultFooter}>
        <Text style={styles.resultType}>{item.program_type}</Text>
        <Text style={[styles.resultAmount, { color: catStyle.accent }]}>
          {benefitText}
        </Text>
      </View>
    </View>
  );
}

/** Monthly benefit comparison banner */
function MonthlyCompareBanner({
  currentMonthly,
  simMonthly,
  currentLabel,
  simLabel,
}: {
  currentMonthly: number;
  simMonthly: number;
  currentLabel: string;
  simLabel: string;
}) {
  const diff = simMonthly - currentMonthly;
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
    ? `+${formatManwon(diff)}`
    : `-${formatManwon(Math.abs(diff))}`;

  return (
    <View style={styles.monthlyBanner}>
      <Text style={styles.monthlyBannerTitle}>월간 혜택 금액 비교</Text>
      <View style={styles.monthlyBannerRow}>
        <View style={styles.monthlyBlock}>
          <Text style={styles.monthlyBlockLabel}>{currentLabel}</Text>
          <Text style={styles.monthlyBlockAmount}>
            {formatManwon(currentMonthly)}
          </Text>
        </View>
        <Text style={styles.monthlyArrow}>→</Text>
        <View style={styles.monthlyBlock}>
          <Text style={styles.monthlyBlockLabel}>{simLabel}</Text>
          <Text style={styles.monthlyBlockAmount}>
            {formatManwon(simMonthly)}
          </Text>
        </View>
        <View
          style={[
            styles.monthlyDiffChip,
            { backgroundColor: diffColor + "1a" },
          ]}
        >
          <Text style={[styles.monthlyDiffText, { color: diffColor }]}>
            {diffText}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Inline OfflineBanner removed — using shared @/components/OfflineBanner

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export default function ConditionSimulatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Profile from onboarding store
  const storeRegion = useOnboardingStore((s) => s.region);
  const storeAge = useOnboardingStore((s) => s.age);
  const storeEnrollment = useOnboardingStore((s) => s.enrollmentStatus);
  const storeEmployment = useOnboardingStore((s) => s.employmentStatus);
  const storeIncomeBracket = useOnboardingStore((s) => s.incomeBracket);

  // Expanded section state
  const [expandedSection, setExpandedSection] = useState<string | null>("region");

  // Simulation overrides (null = unchanged = use store value)
  const [overrides, setOverrides] = useState<SimOverrides>(DEFAULT_OVERRIDES);

  const toggleSection = useCallback((key: string) => {
    setExpandedSection((prev) => (prev === key ? null : key));
  }, []);

  // Region chips — the "current" region is the store value mapped to a code
  const currentRegionCode: RegionValue =
    (LABEL_TO_CODE[storeRegion] as RegionValue) ?? "national";

  const simRegionCode: RegionValue = overrides.regionCode ?? currentRegionCode;

  // Current profile
  const currentProfile = useMemo<ProfileInput>(
    () =>
      buildCurrentProfile(
        storeRegion,
        storeAge,
        storeEnrollment,
        storeEmployment,
        storeIncomeBracket
      ),
    [storeRegion, storeAge, storeEnrollment, storeEmployment, storeIncomeBracket]
  );

  // Simulated profile
  const simProfile = useMemo<ProfileInput>(
    () => applyOverrides(currentProfile, overrides),
    [currentProfile, overrides]
  );

  const simActive = hasAnyOverride(overrides);

  // ── Queries ──────────────────────────────────────────────────────────────

  const currentQuery = useQuery({
    queryKey: ["sim", "current", currentProfile],
    queryFn: () => api.getRecommendPreview(currentProfile),
    staleTime: STALE_TIME,
  });

  const simQuery = useQuery({
    queryKey: ["sim", "override", simProfile],
    queryFn: () => api.getRecommendPreview(simProfile),
    staleTime: STALE_TIME,
    enabled: simActive,
  });

  const isLoading = currentQuery.isLoading || (simActive && simQuery.isLoading);
  const hasError = currentQuery.isError || (simActive && simQuery.isError);

  // ── Resolve data ─────────────────────────────────────────────────────────

  const currentItems: RecommendationItem[] =
    currentQuery.data?.items ?? [];

  const simItems: RecommendationItem[] = simActive
    ? simQuery.data?.items ?? []
    : currentItems;

  const classified = useMemo<ClassifiedItem[]>(() => {
    if (!simActive) return [];
    return classifyItems(currentItems, simItems);
  }, [currentItems, simItems, simActive]);

  const gainItems = classified.filter((c) => c.category === "gain");
  const loseItems = classified.filter((c) => c.category === "lose");
  const keepItems = classified.filter((c) => c.category === "keep");

  const currentMonthly = useMemo(
    () => estimateMonthlyFromItems(currentItems),
    [currentItems]
  );
  const simMonthly = useMemo(
    () => estimateMonthlyFromItems(simItems),
    [simItems]
  );

  // ── Override setters ─────────────────────────────────────────────────────

  const applyScenario = useCallback((scenario: Scenario) => {
    setOverrides((prev) => ({ ...prev, ...scenario.overrides }));
  }, []);

  const resetOverrides = useCallback(() => {
    setOverrides(DEFAULT_OVERRIDES);
  }, []);

  // ── Label helpers ────────────────────────────────────────────────────────

  const currentLabel = "현재 조건";
  const simLabel = "변경된 조건";

  // Age display helpers
  const currentAge = parseInt(storeAge, 10) || 24;
  const simAge = currentAge + overrides.ageDelta;

  const enrollmentLabel = (v: string | null): string =>
    ENROLLMENT_OPTIONS.find((o) => o.value === (v ?? storeEnrollment))?.label ??
    storeEnrollment ??
    "미설정";

  const employmentLabel = (v: string | null): string =>
    EMPLOYMENT_OPTIONS.find((o) => o.value === (v ?? storeEmployment))?.label ??
    storeEmployment ??
    "미설정";

  const incomeLabel = (v: number | null): string =>
    v === null
      ? storeIncomeBracket !== null
        ? `${storeIncomeBracket}분위`
        : "미입력"
      : `${v}분위`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
        >
          <Text style={styles.backButtonText}>{"←"}</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>조건 시뮬레이터</Text>
          <Text style={styles.headerSubtitle}>
            조건을 바꿔보고 혜택 변화를 확인하세요
          </Text>
        </View>
        {simActive ? (
          <Pressable
            style={styles.resetButton}
            onPress={resetOverrides}
            hitSlop={8}
            accessibilityLabel="초기화"
          >
            <Text style={styles.resetButtonText}>초기화</Text>
          </Pressable>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Scenario preset pills ── */}
        <View style={styles.scenariosSection}>
          <Text style={styles.scenariosSectionLabel}>시나리오 프리셋</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scenariosScrollContent}
          >
            {SCENARIOS.map((scenario) => (
              <Pressable
                key={scenario.label}
                style={({ pressed }) => [
                  styles.scenarioChip,
                  pressed && styles.scenarioChipPressed,
                ]}
                onPress={() => applyScenario(scenario)}
                accessibilityRole="button"
                accessibilityLabel={`시나리오: ${scenario.label}`}
              >
                <Text style={styles.scenarioChipLabel}>{scenario.label}</Text>
                <Text style={styles.scenarioChipDesc}>{scenario.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Condition change cards ── */}

        {/* 1. Region */}
        <ConditionSection
          icon="🗺️"
          title="거주 지역"
          subtitle={
            overrides.regionCode
              ? `${REGION_OPTIONS.find((o) => o.value === currentRegionCode)?.label ?? "현재"} → ${REGION_OPTIONS.find((o) => o.value === overrides.regionCode)?.label}`
              : REGION_OPTIONS.find((o) => o.value === currentRegionCode)?.label ?? "미설정"
          }
          expanded={expandedSection === "region"}
          onToggle={() => toggleSection("region")}
        >
          <Text style={styles.conditionCurrentNote}>
            현재: {(REGION_OPTIONS.find((o) => o.value === currentRegionCode)?.label ?? storeRegion) || "미설정"}
          </Text>
          <ChipSelector
            label="변경할 지역"
            options={REGION_OPTIONS}
            value={simRegionCode}
            onChange={(v) =>
              setOverrides((prev) => ({
                ...prev,
                regionCode: v === currentRegionCode ? null : v,
              }))
            }
          />
        </ConditionSection>

        {/* 2. Enrollment status */}
        <ConditionSection
          icon="🎓"
          title="학적 상태"
          subtitle={
            overrides.enrollmentStatus
              ? `${ENROLLMENT_OPTIONS.find((o) => o.value === storeEnrollment)?.label ?? storeEnrollment} → ${ENROLLMENT_OPTIONS.find((o) => o.value === overrides.enrollmentStatus)?.label}`
              : enrollmentLabel(null)
          }
          expanded={expandedSection === "enrollment"}
          onToggle={() => toggleSection("enrollment")}
        >
          <Text style={styles.conditionCurrentNote}>
            현재: {(ENROLLMENT_OPTIONS.find((o) => o.value === storeEnrollment)?.label ?? storeEnrollment) || "미설정"}
          </Text>
          <ChipSelector
            label="변경할 학적 상태"
            options={ENROLLMENT_OPTIONS}
            value={(overrides.enrollmentStatus ?? storeEnrollment) as string}
            onChange={(v) =>
              setOverrides((prev) => ({
                ...prev,
                enrollmentStatus: v === storeEnrollment ? null : v,
              }))
            }
          />
        </ConditionSection>

        {/* 3. Employment status */}
        <ConditionSection
          icon="💼"
          title="취업 상태"
          subtitle={
            overrides.employmentStatus
              ? `${EMPLOYMENT_OPTIONS.find((o) => o.value === storeEmployment)?.label ?? storeEmployment} → ${EMPLOYMENT_OPTIONS.find((o) => o.value === overrides.employmentStatus)?.label}`
              : employmentLabel(null)
          }
          expanded={expandedSection === "employment"}
          onToggle={() => toggleSection("employment")}
        >
          <Text style={styles.conditionCurrentNote}>
            현재: {(EMPLOYMENT_OPTIONS.find((o) => o.value === storeEmployment)?.label ?? storeEmployment) || "미설정"}
          </Text>
          <ChipSelector
            label="변경할 취업 상태"
            options={EMPLOYMENT_OPTIONS}
            value={(overrides.employmentStatus ?? storeEmployment) as string}
            onChange={(v) =>
              setOverrides((prev) => ({
                ...prev,
                employmentStatus: v === storeEmployment ? null : v,
              }))
            }
          />
        </ConditionSection>

        {/* 4. Age */}
        <ConditionSection
          icon="🎂"
          title="나이 변경"
          subtitle={
            overrides.ageDelta !== 0
              ? `${currentAge}세 → ${simAge}세 (+${overrides.ageDelta}년 후)`
              : `${currentAge}세 (현재)`
          }
          expanded={expandedSection === "age"}
          onToggle={() => toggleSection("age")}
        >
          <Text style={styles.conditionCurrentNote}>
            현재: {currentAge}세
          </Text>
          <ChipSelector
            label="나이 변경 (미래 시점)"
            options={AGE_OPTIONS}
            value={overrides.ageDelta}
            onChange={(v) =>
              setOverrides((prev) => ({ ...prev, ageDelta: v }))
            }
          />
        </ConditionSection>

        {/* 5. Income bracket */}
        <ConditionSection
          icon="💰"
          title="소득 분위"
          subtitle={
            overrides.incomeBracket !== null
              ? `${storeIncomeBracket !== null ? `${storeIncomeBracket}분위` : "미입력"} → ${overrides.incomeBracket}분위`
              : incomeLabel(null)
          }
          expanded={expandedSection === "income"}
          onToggle={() => toggleSection("income")}
        >
          <Text style={styles.conditionCurrentNote}>
            현재:{" "}
            {storeIncomeBracket !== null
              ? `${storeIncomeBracket}분위`
              : "미입력"}
          </Text>
          <ChipSelector
            label="변경할 소득 분위"
            options={INCOME_OPTIONS}
            value={overrides.incomeBracket ?? storeIncomeBracket}
            onChange={(v) =>
              setOverrides((prev) => ({
                ...prev,
                incomeBracket:
                  v === storeIncomeBracket ? null : (v as number | null),
              }))
            }
          />
        </ConditionSection>

        {/* ── Offline / error fallback ── */}
        {hasError && <OfflineBanner />}

        {/* ── Prompt when no sim active ── */}
        {!simActive && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>✨</Text>
            <Text style={styles.emptyStateTitle}>조건을 바꿔보세요</Text>
            <Text style={styles.emptyStateBody}>
              위 카드에서 조건을 변경하거나{"\n"}
              시나리오 프리셋을 눌러보세요
            </Text>
          </View>
        )}

        {/* ── Loading ── */}
        {simActive && isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>혜택 변화를 계산하는 중...</Text>
          </View>
        )}

        {/* ── Simulation results ── */}
        {simActive && !isLoading && (
          <>
            {/* Monthly comparison banner */}
            <MonthlyCompareBanner
              currentMonthly={currentMonthly}
              simMonthly={simMonthly}
              currentLabel={currentLabel}
              simLabel={simLabel}
            />

            {/* Count summary row */}
            <View style={styles.countSummaryRow}>
              <View style={[styles.countChip, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.countChipText, { color: "#16a34a" }]}>
                  +{gainItems.length} 신규
                </Text>
              </View>
              <View
                style={[
                  styles.countChip,
                  { backgroundColor: colors.errorContainer },
                ]}
              >
                <Text
                  style={[styles.countChipText, { color: colors.error }]}
                >
                  -{loseItems.length} 소멸
                </Text>
              </View>
              <View
                style={[
                  styles.countChip,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                <Text
                  style={[
                    styles.countChipText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {keepItems.length} 유지
                </Text>
              </View>
            </View>

            {/* Gain section */}
            {gainItems.length > 0 && (
              <View style={styles.resultSection}>
                <View style={styles.resultSectionHeader}>
                  <View
                    style={[styles.resultDot, { backgroundColor: "#16a34a" }]}
                  />
                  <Text style={styles.resultSectionTitle}>
                    변경 후 새로 받을 수 있어요
                  </Text>
                  <View
                    style={[
                      styles.resultCount,
                      { backgroundColor: "#dcfce7" },
                    ]}
                  >
                    <Text
                      style={[styles.resultCountText, { color: "#16a34a" }]}
                    >
                      +{gainItems.length}
                    </Text>
                  </View>
                </View>
                {gainItems.map(({ item }) => (
                  <ResultItemCard
                    key={item.program_id}
                    classified={{ item, category: "gain" }}
                  />
                ))}
              </View>
            )}

            {/* Lose section */}
            {loseItems.length > 0 && (
              <View style={styles.resultSection}>
                <View style={styles.resultSectionHeader}>
                  <View
                    style={[
                      styles.resultDot,
                      { backgroundColor: colors.error },
                    ]}
                  />
                  <Text style={styles.resultSectionTitle}>
                    변경 후 잃는 혜택이에요
                  </Text>
                  <View
                    style={[
                      styles.resultCount,
                      { backgroundColor: colors.errorContainer },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultCountText,
                        { color: colors.error },
                      ]}
                    >
                      -{loseItems.length}
                    </Text>
                  </View>
                </View>
                {loseItems.map(({ item }) => (
                  <ResultItemCard
                    key={item.program_id}
                    classified={{ item, category: "lose" }}
                  />
                ))}
              </View>
            )}

            {/* Keep section */}
            {keepItems.length > 0 && (
              <View style={styles.resultSection}>
                <View style={styles.resultSectionHeader}>
                  <View
                    style={[
                      styles.resultDot,
                      { backgroundColor: colors.outline },
                    ]}
                  />
                  <Text style={styles.resultSectionTitle}>
                    어떤 조건이든 계속 받을 수 있어요
                  </Text>
                  <View
                    style={[
                      styles.resultCount,
                      { backgroundColor: colors.surfaceContainerHigh },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultCountText,
                        { color: colors.outline },
                      ]}
                    >
                      {keepItems.length}
                    </Text>
                  </View>
                </View>
                {keepItems.map(({ item }) => (
                  <ResultItemCard
                    key={item.program_id}
                    classified={{ item, category: "keep" }}
                  />
                ))}
              </View>
            )}

            <View style={styles.disclaimerCard}>
              <Text style={styles.disclaimerText}>
                실제 혜택은 신청 조건 및 예산에 따라 다를 수 있어요.
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
    minHeight: layout.headerHeight,
    paddingHorizontal: layout.pagePadding,
    paddingVertical: spacing[3],
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: spacing[0.5],
  },
  headerTitle: {
    ...typography.styles.sectionTitle,
    color: colors.onSurface,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.regular,
  },
  headerRight: {
    width: layout.touchTargetMin,
  },
  resetButton: {
    width: layout.touchTargetMin,
    height: layout.touchTargetMin,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  resetButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    fontWeight: typography.fontWeight.semibold,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[5],
    gap: spacing[3],
  },

  // Scenario presets
  scenariosSection: {
    gap: spacing[2],
  },
  scenariosSectionLabel: {
    ...typography.styles.label,
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  scenariosScrollContent: {
    flexDirection: "row",
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  scenarioChip: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    gap: spacing[0.5],
    ...shadows.card,
    minWidth: 110,
  },
  scenarioChipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  scenarioChipLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  scenarioChipDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },

  // Condition section card
  conditionCard: {
    ...componentStyles.cardLg,
    gap: 0,
    padding: 0,
    overflow: "hidden",
  },
  conditionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: layout.cardPaddingLg,
    gap: spacing[3],
  },
  conditionIcon: {
    fontSize: 22,
  },
  conditionHeaderText: {
    flex: 1,
    gap: spacing[0.5],
  },
  conditionTitle: {
    ...typography.styles.label,
    color: colors.onSurface,
  },
  conditionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.regular,
  },
  conditionChevron: {
    fontSize: typography.fontSize.xs,
    color: colors.outline,
  },
  conditionBody: {
    paddingHorizontal: layout.cardPaddingLg,
    paddingBottom: layout.cardPaddingLg,
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
  },
  conditionCurrentNote: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.regular,
  },

  // Chip row (inside condition body)
  conditionRow: {
    gap: spacing[2],
  },
  conditionLabel: {
    ...typography.styles.label,
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  chipScrollContent: {
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

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing[12],
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

  // Loading
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing[12],
    gap: spacing[3],
  },
  loadingText: {
    ...typography.styles.bodyBase,
    color: colors.textSecondary,
  },

  // Monthly compare banner
  monthlyBanner: {
    ...componentStyles.cardLg,
    gap: spacing[4],
  },
  monthlyBannerTitle: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  monthlyBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    flexWrap: "wrap",
  },
  monthlyBlock: {
    alignItems: "center",
    gap: spacing[0.5],
  },
  monthlyBlockLabel: {
    ...typography.styles.caption,
    color: colors.textSecondary,
  },
  monthlyBlockAmount: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
  },
  monthlyArrow: {
    fontSize: typography.fontSize.xl,
    color: colors.outline,
  },
  monthlyDiffChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
  },
  monthlyDiffText: {
    ...typography.styles.label,
    fontWeight: typography.fontWeight.bold,
  },

  // Count summary row
  countSummaryRow: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
  },
  countChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  countChipText: {
    ...typography.styles.label,
    fontWeight: typography.fontWeight.bold,
  },

  // Result sections
  resultSection: {
    gap: spacing[3],
  },
  resultSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultSectionTitle: {
    ...typography.styles.sectionTitle,
    flex: 1,
    color: colors.onSurface,
  },
  resultCount: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
    minWidth: 28,
    alignItems: "center",
  },
  resultCountText: {
    ...typography.styles.badge,
    fontWeight: typography.fontWeight.bold,
  },

  // Result item card
  resultCard: {
    ...componentStyles.card,
    borderLeftWidth: 3,
    gap: spacing[2],
  },
  resultBadge: {
    alignSelf: "flex-start",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
  },
  resultBadgeText: {
    ...typography.styles.badge,
  },
  resultTitle: {
    ...typography.styles.cardTitle,
    color: colors.onSurface,
  },
  resultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing[1],
  },
  resultType: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  resultAmount: {
    ...typography.styles.label,
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
