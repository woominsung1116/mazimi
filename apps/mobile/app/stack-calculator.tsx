/**
 * 혜택 중복 계산기 + 총 혜택가 시뮬레이션 — Unified Benefit Stack & Simulation Screen
 *
 * Flow:
 *   1. User selects 2+ programs from the list.
 *   2. Taps "계산하기".
 *   3. Results show:
 *      a. 총 예상 수혜액 (animated counters — monthly / annual / 3-year)
 *      b. 카테고리별 분석 (by program_type, with Ionicons)
 *      c. 중복 수혜 분석 (existing conflict detection)
 *      d. 금융 시뮬레이션 (compound interest estimate for 금융상품 programs)
 *
 * Stack-compatibility heuristic (MVP):
 *   - Same provider_name + same program_type  → likely conflict
 *   - Different providers                     → likely stackable
 *   - KOSAF national scholarships (source_id starts with "kosaf") are
 *     treated as exclusive with each other.
 *
 * TODO: Replace heuristic with POST /api/v1/stack-check once backend lands.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import {
  borderRadius,
  colors,
  gradients,
  layout,
  shadows,
  spacing,
  typography,
} from "@/constants/theme";
import { api, type ApiProgram } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StackStatus = "stackable" | "conflict" | "unknown";

interface ProgramStackResult {
  program: ApiProgram;
  status: StackStatus;
  reason: string;
  /** Annualised monthly benefit for display */
  monthlyBenefit: number;
  /** Raw semester benefit */
  semesterBenefit: number;
  /** One-time benefit */
  onceBenefit: number;
  /** Approximate monthly for totalling (semester/6, once/24) */
  effectiveMonthly: number;
}

interface ConflictWarning {
  programA: string;
  programB: string;
  reason: string;
}

// Category definitions for the breakdown section
type CategoryKey = "scholarship" | "youth_policy" | "welfare" | "financial" | "corporate" | "other";

interface CategoryInfo {
  key: CategoryKey;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: "scholarship",
    label: "장학금",
    iconName: "school-outline",
    color: colors.primary,
    bgColor: `${colors.primary}18`,
  },
  {
    key: "youth_policy",
    label: "청년정책",
    iconName: "business-outline",
    color: "#5CB1A7",
    bgColor: "#dbeafe",
  },
  {
    key: "welfare",
    label: "복지/생활",
    iconName: "heart-outline",
    color: "#059669",
    bgColor: "#d1fae5",
  },
  {
    key: "financial",
    label: "금융상품",
    iconName: "card-outline",
    color: "#d97706",
    bgColor: "#fef3c7",
  },
  {
    key: "corporate",
    label: "기업혜택",
    iconName: "briefcase-outline",
    color: "#7c3aed",
    bgColor: "#ede9fe",
  },
  {
    key: "other",
    label: "기타",
    iconName: "ellipsis-horizontal-circle-outline",
    color: colors.textMuted,
    bgColor: colors.surfaceContainerHigh,
  },
];

function programTypeToCategory(type: string): CategoryKey {
  switch (type) {
    case "scholarship": return "scholarship";
    case "support":
    case "youth_policy": return "youth_policy";
    case "welfare": return "welfare";
    case "financial":
    case "savings":
    case "loan": return "financial";
    case "corporate":
    case "company": return "corporate";
    default: return "other";
  }
}

// ---------------------------------------------------------------------------
// MVP stack-compatibility engine
// TODO: Replace with backend rule check (POST /api/v1/stack-check)
// ---------------------------------------------------------------------------

function analyzeStack(programs: ApiProgram[]): {
  results: ProgramStackResult[];
  conflicts: ConflictWarning[];
  totalMonthly: number;
  totalAnnual: number;
} {
  const results: ProgramStackResult[] = [];
  const conflicts: ConflictWarning[] = [];

  const conflictSet = new Set<string>();

  for (let i = 0; i < programs.length; i++) {
    for (let j = i + 1; j < programs.length; j++) {
      const a = programs[i];
      const b = programs[j];

      const sameProvider =
        a.provider_name &&
        b.provider_name &&
        a.provider_name.trim() === b.provider_name.trim();

      const sameType = a.program_type === b.program_type;

      const bothKosaf =
        (a.source_id?.startsWith("kosaf") ?? false) &&
        (b.source_id?.startsWith("kosaf") ?? false);

      if (bothKosaf || (sameProvider && sameType)) {
        conflictSet.add(a.id);
        conflictSet.add(b.id);
        conflicts.push({
          programA: a.title,
          programB: b.title,
          reason: bothKosaf
            ? "한국장학재단 지원은 동일 유형 중복 수혜가 불가합니다."
            : `동일 기관(${a.provider_name ?? "미상"})의 같은 유형 혜택은 중복 수령이 제한될 수 있습니다.`,
        });
      }
    }
  }

  let totalMonthly = 0;

  for (const p of programs) {
    const isConflict = conflictSet.has(p.id);

    const monthly = p.benefit_amount_monthly ?? 0;
    const semester = p.benefit_amount_semester ?? 0;
    const once = p.benefit_amount_once ?? 0;

    // Approximate effective monthly: semester → /6, once → /24 (2-year horizon)
    const effectiveMonthly =
      monthly + Math.round(semester / 6) + Math.round(once / 24);

    if (!isConflict) {
      totalMonthly += effectiveMonthly;
    }

    results.push({
      program: p,
      status: isConflict ? "conflict" : "stackable",
      reason: isConflict
        ? "다른 선택 프로그램과 중복 수령이 제한될 수 있습니다."
        : "다른 선택 프로그램과 동시에 수령할 수 있습니다.",
      monthlyBenefit: monthly,
      semesterBenefit: semester,
      onceBenefit: once,
      effectiveMonthly,
    });
  }

  return {
    results,
    conflicts,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
  };
}

// ---------------------------------------------------------------------------
// Financial simulation (청년도약계좌 / savings products)
// ---------------------------------------------------------------------------

interface FinancialSimResult {
  programTitle: string;
  monthlyContribution: number;
  months: number;
  govContributionMonthly: number;
  /** Simple compound estimate at annualRate */
  maturityTotal: number;
  annualRate: number;
}

/**
 * For 금융상품 type programs, compute a rough 3-year compound maturity estimate.
 * Uses the program's monthly benefit as the government contribution top-up.
 * User monthly principal is assumed to match government contribution (matching scheme).
 */
function simulateFinancialProducts(results: ProgramStackResult[]): FinancialSimResult[] {
  const sims: FinancialSimResult[] = [];
  const MONTHS = 36;
  const ANNUAL_RATE = 0.06; // 6% blended (market + government subsidy)
  const MONTHLY_RATE = ANNUAL_RATE / 12;

  for (const r of results) {
    const cat = programTypeToCategory(r.program.program_type);
    if (cat !== "financial") continue;
    if (r.status === "conflict") continue;

    const govMonthly = r.effectiveMonthly;
    if (govMonthly <= 0) continue;

    // User contributes same amount (matching — conservative estimate)
    const totalMonthlyIn = govMonthly * 2;

    // Future value of an annuity: FV = PMT * [((1+r)^n - 1) / r]
    const fv =
      totalMonthlyIn *
      ((Math.pow(1 + MONTHLY_RATE, MONTHS) - 1) / MONTHLY_RATE);

    sims.push({
      programTitle: r.program.title,
      monthlyContribution: govMonthly,
      months: MONTHS,
      govContributionMonthly: govMonthly,
      maturityTotal: Math.round(fv),
      annualRate: ANNUAL_RATE,
    });
  }

  return sims;
}

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useAnimatedCounter(target: number, duration = 900) {
  const animRef = useRef(new Animated.Value(0));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    animRef.current.setValue(0);
    const listener = animRef.current.addListener(({ value }) => {
      setDisplay(Math.round(value));
    });
    Animated.timing(animRef.current, {
      toValue: target,
      duration,
      useNativeDriver: false,
    }).start();
    return () => animRef.current.removeListener(listener);
  }, [target, duration]);

  return display;
}

// No mock programs — always use real API data

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatKRW(amount: number): string {
  if (amount === 0) return "0원";
  const man = Math.round(amount / 10000);
  if (man >= 10000) {
    const eok = (man / 10000).toFixed(1).replace(/\.0$/, "");
    return `${eok}억원`;
  }
  if (man >= 100) return `${man.toLocaleString()}만원`;
  if (man > 0) return `${man}만원`;
  return `${amount.toLocaleString()}원`;
}

function benefitSummary(result: ProgramStackResult): string {
  if (result.monthlyBenefit > 0) return `월 ${formatKRW(result.monthlyBenefit)}`;
  if (result.semesterBenefit > 0) return `학기 ${formatKRW(result.semesterBenefit)}`;
  if (result.onceBenefit > 0) return `최대 ${formatKRW(result.onceBenefit)}`;
  return "혜택 확인";
}

function programTypeLabel(type: string): string {
  switch (type) {
    case "scholarship": return "장학금";
    case "support":
    case "youth_policy": return "청년정책";
    case "welfare": return "복지/생활";
    case "financial": return "금융상품";
    case "corporate": return "기업혜택";
    default: return type;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
      accessibilityLabel="뒤로 가기"
      accessibilityRole="button"
      hitSlop={12}
    >
      <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
    </Pressable>
  );
}

function ProgramCheckRow({
  program,
  selected,
  onToggle,
}: {
  program: ApiProgram;
  selected: boolean;
  onToggle: () => void;
}) {
  const benefitLabel = (() => {
    if (program.benefit_amount_monthly) return `월 ${formatKRW(program.benefit_amount_monthly)}`;
    if (program.benefit_amount_semester) return `학기 ${formatKRW(program.benefit_amount_semester)}`;
    if (program.benefit_amount_once) return `최대 ${formatKRW(program.benefit_amount_once)}`;
    return "혜택 확인";
  })();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.programRow,
        selected && styles.programRowSelected,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${program.title} 선택`}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && (
          <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
        )}
      </View>

      <View style={styles.programRowContent}>
        <View style={styles.programRowTop}>
          <View style={[styles.typePill, { backgroundColor: colors.surfaceContainerHigh }]}>
            <Text style={styles.typePillText}>{programTypeLabel(program.program_type)}</Text>
          </View>
        </View>
        <Text style={styles.programRowTitle} numberOfLines={2}>
          {program.title}
        </Text>
        <Text style={styles.programRowMeta}>
          {program.provider_name ?? "제공처 미상"}
        </Text>
      </View>

      <Text style={[styles.programRowAmount, selected && { color: colors.primary }]}>
        {benefitLabel}
      </Text>
    </Pressable>
  );
}

function StackStatusBadge({ status }: { status: StackStatus }) {
  if (status === "stackable") {
    return (
      <View style={styles.badgeStackable}>
        <Text style={styles.badgeStackableText}>중복 가능</Text>
      </View>
    );
  }
  if (status === "conflict") {
    return (
      <View style={styles.badgeConflict}>
        <Text style={styles.badgeConflictText}>중복 불가</Text>
      </View>
    );
  }
  return (
    <View style={styles.badgeUnknown}>
      <Text style={styles.badgeUnknownText}>확인 필요</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Total Summary Card — animated monthly / annual / 3-year counters
// ---------------------------------------------------------------------------

function TotalSummaryCard({
  totalMonthly,
  totalAnnual,
  stackableCount,
  conflictCount,
}: {
  totalMonthly: number;
  totalAnnual: number;
  stackableCount: number;
  conflictCount: number;
}) {
  const total3Year = totalAnnual * 3;
  const displayMonthlyMan = useAnimatedCounter(Math.round(totalMonthly / 10000));
  const displayAnnualMan = useAnimatedCounter(Math.round(totalAnnual / 10000));
  const display3YearMan = useAnimatedCounter(Math.round(total3Year / 10000), 1200);

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryBlob} pointerEvents="none" />

      <Text style={styles.summaryLabel}>총 예상 수혜액</Text>

      {/* Annual — hero number */}
      <View style={styles.summaryHeroRow}>
        <Text style={styles.summaryHeroAmount}>
          {displayAnnualMan.toLocaleString()}
        </Text>
        <Text style={styles.summaryHeroUnit}>만원/년</Text>
      </View>

      {/* Monthly */}
      <Text style={styles.summarySubLine}>
        월 {displayMonthlyMan.toLocaleString()}만원
      </Text>

      {/* 3-year accumulation */}
      <View style={styles.summaryAccumRow}>
        <Ionicons name="trending-up-outline" size={15} color={colors.primary} />
        <Text style={styles.summaryAccumText}>
          3년 누적 예상{" "}
          <Text style={styles.summaryAccumHighlight}>
            {display3YearMan.toLocaleString()}만원
          </Text>
        </Text>
      </View>

      {/* Status pills */}
      <View style={styles.summaryPills}>
        <View style={styles.summaryPillStackable}>
          <Text style={styles.summaryPillText}>중복 가능 {stackableCount}건</Text>
        </View>
        {conflictCount > 0 && (
          <View style={styles.summaryPillConflict}>
            <Text style={[styles.summaryPillText, { color: colors.onErrorContainer }]}>
              중복 불가 {conflictCount}건
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.summaryDisclaimer}>
        중복 가능 프로그램 기준 추정치입니다. 실제 수령액은 자격 심사 결과에 따라 달라질 수 있습니다.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Category Breakdown Card
// ---------------------------------------------------------------------------

interface CategoryGroup {
  info: CategoryInfo;
  count: number;
  monthlyTotal: number;
}

function CategoryBreakdownCard({ results }: { results: ProgramStackResult[] }) {
  const groups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<CategoryKey, CategoryGroup>();

    for (const r of results) {
      if (r.status === "conflict") continue;
      const cat = programTypeToCategory(r.program.program_type);
      const info = CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[CATEGORIES.length - 1];
      if (!map.has(cat)) {
        map.set(cat, { info, count: 0, monthlyTotal: 0 });
      }
      const g = map.get(cat)!;
      g.count += 1;
      g.monthlyTotal += r.effectiveMonthly;
    }

    return Array.from(map.values()).filter((g) => g.count > 0);
  }, [results]);

  if (groups.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>카테고리별 분석</Text>
      <View style={styles.categoryList}>
        {groups.map((g) => (
          <View key={g.info.key} style={styles.categoryRow}>
            <View style={[styles.categoryIconWrap, { backgroundColor: g.info.bgColor }]}>
              <Ionicons name={g.info.iconName} size={18} color={g.info.color} />
            </View>
            <Text style={styles.categoryLabel}>{g.info.label}</Text>
            <View style={styles.categoryCountPill}>
              <Text style={styles.categoryCountText}>{g.count}건</Text>
            </View>
            <Text style={styles.categoryAmount}>
              {g.monthlyTotal > 0 ? `월 ${formatKRW(g.monthlyTotal)}` : "혜택 확인"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Conflict Analysis Card — shows per-pair conflict warnings + per-program status
// ---------------------------------------------------------------------------

function ConflictAnalysisCard({
  results,
  conflicts,
}: {
  results: ProgramStackResult[];
  conflicts: ConflictWarning[];
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>중복 수혜 분석</Text>
      <View style={styles.conflictList}>
        {/* Stackable programs first */}
        {results
          .filter((r) => r.status === "stackable")
          .map((r) => (
            <View key={r.program.id} style={styles.conflictRow}>
              <View style={styles.conflictIconWrap}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.conflictRowContent}>
                <Text style={styles.conflictRowTitle} numberOfLines={1}>
                  {r.program.title}
                </Text>
                <Text style={styles.conflictRowSub}>중복 수령 가능</Text>
              </View>
              <StackStatusBadge status={r.status} />
            </View>
          ))}

        {/* Conflicting programs */}
        {results
          .filter((r) => r.status === "conflict")
          .map((r) => (
            <View key={r.program.id} style={styles.conflictRow}>
              <View style={styles.conflictIconWrap}>
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={colors.error}
                />
              </View>
              <View style={styles.conflictRowContent}>
                <Text style={[styles.conflictRowTitle, { color: colors.error }]} numberOfLines={1}>
                  {r.program.title}
                </Text>
                <Text style={styles.conflictRowSub}>중복 수령 제한</Text>
              </View>
              <StackStatusBadge status={r.status} />
            </View>
          ))}

        {/* Detailed conflict warnings */}
        {conflicts.map((w, i) => (
          <View key={i} style={styles.conflictWarningBox}>
            <Ionicons name="warning-outline" size={15} color={colors.onErrorContainer} />
            <View style={styles.conflictWarningContent}>
              <Text style={styles.conflictWarningText}>
                <Text style={styles.conflictWarningBold}>{w.programA}</Text>
                {" + "}
                <Text style={styles.conflictWarningBold}>{w.programB}</Text>
                {" → 중복 불가\n"}
                <Text style={styles.conflictWarningReason}>{w.reason}</Text>
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Financial Simulation Card
// ---------------------------------------------------------------------------

function FinancialSimCard({ sims }: { sims: FinancialSimResult[] }) {
  if (sims.length === 0) return null;

  return (
    <View style={[styles.card, styles.financialCard]}>
      <View style={styles.financialCardHeader}>
        <View style={styles.financialIconWrap}>
          <Ionicons name="calculator-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>금융 시뮬레이션</Text>
      </View>
      {sims.map((sim, i) => {
        const maturityMan = Math.round(sim.maturityTotal / 10000);
        const govTotalMan = Math.round((sim.govContributionMonthly * sim.months) / 10000);
        return (
          <View key={i} style={styles.financialSimItem}>
            <Text style={styles.financialSimTitle}>{sim.programTitle}</Text>
            <View style={styles.financialSimRow}>
              <Ionicons name="time-outline" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.financialSimDesc}>
                {sim.months}개월 만기 시 약{" "}
                <Text style={styles.financialSimHighlight}>
                  {maturityMan.toLocaleString()}만원
                </Text>
              </Text>
            </View>
            <View style={styles.financialSimRow}>
              <Ionicons name="gift-outline" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.financialSimDesc}>
                정부 기여금 총{" "}
                <Text style={styles.financialSimHighlight}>
                  {govTotalMan.toLocaleString()}만원
                </Text>{" "}
                포함
              </Text>
            </View>
            <View style={styles.financialSimRow}>
              <Ionicons name="stats-chart-outline" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.financialSimDesc}>
                가정 연이율 {(sim.annualRate * 100).toFixed(0)}%,
                월 본인 납입액 {formatKRW(sim.monthlyContribution)} 기준 추정
              </Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.financialDisclaimer}>
        복리 추정치이며 실제 이자율 및 정부 기여금은 소득 구간에 따라 달라집니다.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function StackCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);

  const programsQuery = useQuery({
    queryKey: ["programs-stack"],
    queryFn: () => api.getPrograms(),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  const programs: ApiProgram[] = useMemo(() => {
    const items = programsQuery.data?.items;
    if (items && items.length > 0) return items.slice(0, 20);
    return [];
  }, [programsQuery.data]);

  const isOffline = programsQuery.isError && !programsQuery.isLoading;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowResults(false);
  }, []);

  const selectedPrograms = useMemo(
    () => programs.filter((p) => selectedIds.has(p.id)),
    [programs, selectedIds]
  );

  const analysisResult = useMemo(() => {
    if (!showResults || selectedPrograms.length === 0) return null;
    return analyzeStack(selectedPrograms);
  }, [showResults, selectedPrograms]);

  const financialSims = useMemo(() => {
    if (!analysisResult) return [];
    return simulateFinancialProducts(analysisResult.results);
  }, [analysisResult]);

  const canCalculate = selectedIds.size >= 2;

  const handleCalculate = useCallback(() => {
    if (!canCalculate) return;
    setShowResults(true);
  }, [canCalculate]);

  const handleReset = useCallback(() => {
    setSelectedIds(new Set());
    setShowResults(false);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>혜택 중복 계산기</Text>
        {selectedIds.size > 0 ? (
          <Pressable
            onPress={handleReset}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            accessibilityLabel="선택 초기화"
            accessibilityRole="button"
          >
            <Text style={styles.headerResetText}>초기화</Text>
          </Pressable>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + layout.tabBarHeight + spacing[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              오프라인 모드 — 예시 데이터를 표시합니다
            </Text>
          </View>
        )}

        {/* Intro card — visible only before first calculation */}
        {!showResults && (
          <View style={styles.introCard}>
            <View style={styles.introIconWrap}>
              <Ionicons name="calculator-outline" size={28} color={colors.primary} />
            </View>
            <View style={styles.introText}>
              <Text style={styles.introTitle}>여러 혜택, 동시에 받을 수 있을까요?</Text>
              <Text style={styles.introDesc}>
                관심 있는 프로그램을 2개 이상 선택하면 중복 수령 가능 여부와 총 혜택가 시뮬레이션을 계산해 드립니다.
              </Text>
            </View>
          </View>
        )}

        {/* ── Results section ── */}
        {showResults && analysisResult && (
          <>
            {/* 1. Total summary with animated counters */}
            <TotalSummaryCard
              totalMonthly={analysisResult.totalMonthly}
              totalAnnual={analysisResult.totalAnnual}
              stackableCount={analysisResult.results.filter((r) => r.status === "stackable").length}
              conflictCount={analysisResult.results.filter((r) => r.status === "conflict").length}
            />

            {/* 2. Category breakdown */}
            <CategoryBreakdownCard results={analysisResult.results} />

            {/* 3. Conflict analysis */}
            <ConflictAnalysisCard
              results={analysisResult.results}
              conflicts={analysisResult.conflicts}
            />

            {/* 4. Financial simulation */}
            <FinancialSimCard sims={financialSims} />
          </>
        )}

        {/* Program selection list */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {showResults ? "선택 변경하기" : "프로그램 선택"}
            </Text>
            {selectedIds.size > 0 && (
              <View style={styles.selectedCountPill}>
                <Text style={styles.selectedCountText}>{selectedIds.size}개 선택됨</Text>
              </View>
            )}
          </View>

          {programsQuery.isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>프로그램 목록 불러오는 중...</Text>
            </View>
          ) : (
            <View style={styles.programList}>
              {programs.map((p) => (
                <ProgramCheckRow
                  key={p.id}
                  program={p}
                  selected={selectedIds.has(p.id)}
                  onToggle={() => toggleSelect(p.id)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Hint when only one is selected */}
        {selectedIds.size === 1 && !showResults && (
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
            <Text style={styles.hintText}>1개 더 선택하면 중복 계산이 가능합니다.</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={[
          styles.ctaContainer,
          { paddingBottom: Math.max(insets.bottom, spacing[4]) },
        ]}
      >
        <Pressable
          onPress={handleCalculate}
          disabled={!canCalculate}
          style={({ pressed }) => [
            styles.ctaOuter,
            pressed && canCalculate && { opacity: 0.88 },
          ]}
          accessibilityLabel="계산하기"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canCalculate }}
        >
          {canCalculate ? (
            <LinearGradient
              colors={gradients.primaryCta.colors as [string, string]}
              start={gradients.primaryCta.start}
              end={gradients.primaryCta.end}
              style={styles.ctaBtn}
            >
              <Text style={styles.ctaBtnLabel}>
                {showResults
                  ? `${selectedIds.size}개 프로그램 다시 계산`
                  : `${selectedIds.size}개 프로그램 계산하기`}
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.ctaBtnDisabled}>
              <Text style={styles.ctaBtnDisabledLabel}>
                2개 이상 선택 후 계산할 수 있습니다
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.pagePadding,
    paddingVertical: spacing[3],
    backgroundColor: colors.background,
    ...shadows.header,
  },
  backBtn: {
    width: layout.touchTargetMin,
    height: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.styles.pageTitle,
    fontSize: typography.fontSize.lg,
    flex: 1,
    textAlign: "center",
  },
  headerResetText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    width: layout.touchTargetMin,
    textAlign: "right",
  },
  headerPlaceholder: {
    width: layout.touchTargetMin,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[5],
    gap: spacing[5],
  },

  // Offline
  offlineBanner: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    alignItems: "center",
  },
  offlineBannerText: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    fontWeight: typography.fontWeight.medium,
  },

  // Intro card
  introCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    gap: spacing[4],
  },
  introIconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  introText: {
    flex: 1,
    gap: spacing[1],
  },
  introTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
    lineHeight: typography.fontSize.base * 1.4,
  },
  introDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.onPrimaryFixedVariant,
    lineHeight: typography.fontSize.sm * 1.65,
    opacity: 0.85,
  },

  // ── Total Summary Card ────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    gap: spacing[3],
    overflow: "hidden",
    ...shadows.cardLg,
  },
  summaryBlob: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.decorativeBlob,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  summaryHeroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing[2],
  },
  summaryHeroAmount: {
    fontSize: 44,
    fontWeight: typography.fontWeight.black,
    fontFamily: typography.fontFamily.heading,
    color: colors.primary,
    letterSpacing: -1,
    lineHeight: 52,
  },
  summaryHeroUnit: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  summarySubLine: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    marginTop: -spacing[1],
  },
  summaryAccumRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
    backgroundColor: `${colors.primary}0d`,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  summaryAccumText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
    fontWeight: typography.fontWeight.medium,
  },
  summaryAccumHighlight: {
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    fontFamily: typography.fontFamily.heading,
  },
  summaryPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    marginTop: spacing[1],
  },
  summaryPillStackable: {
    backgroundColor: `${colors.primary}1a`,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  summaryPillConflict: {
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  summaryPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  summaryDisclaimer: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    lineHeight: typography.fontSize.xs * 1.65,
    marginTop: spacing[1],
  },

  // ── Generic card shell ────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    gap: spacing[4],
    ...shadows.card,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
  },

  // ── Category breakdown ────────────────────────────────────────────────────
  categoryList: {
    gap: spacing[3],
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
  },
  categoryCountPill: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[0.5],
  },
  categoryCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
  },
  categoryAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.extrabold,
    fontFamily: typography.fontFamily.heading,
    color: colors.primary,
    minWidth: 72,
    textAlign: "right",
  },

  // ── Conflict analysis ─────────────────────────────────────────────────────
  conflictList: {
    gap: spacing[2],
  },
  conflictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  conflictIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  conflictRowContent: {
    flex: 1,
    gap: spacing[0.5],
  },
  conflictRowTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: typography.fontSize.sm * 1.35,
  },
  conflictRowSub: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
  },
  conflictWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[1],
  },
  conflictWarningContent: {
    flex: 1,
  },
  conflictWarningText: {
    fontSize: typography.fontSize.xs,
    color: colors.onErrorContainer,
    lineHeight: typography.fontSize.xs * 1.65,
  },
  conflictWarningBold: {
    fontWeight: typography.fontWeight.bold,
  },
  conflictWarningReason: {
    opacity: 0.85,
  },

  // ── Financial simulation card ─────────────────────────────────────────────
  financialCard: {
    backgroundColor: `${colors.primaryFixed}cc`,
  },
  financialCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  financialIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  financialSimItem: {
    gap: spacing[2],
  },
  financialSimTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },
  financialSimRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[1.5],
  },
  financialSimDesc: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: typography.fontSize.xs * 1.65,
  },
  financialSimHighlight: {
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    fontFamily: typography.fontFamily.heading,
  },
  financialDisclaimer: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    lineHeight: typography.fontSize.xs * 1.65,
  },

  // Status badges
  badgeStackable: {
    backgroundColor: `${colors.primary}1a`,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    flexShrink: 0,
  },
  badgeStackableText: {
    ...typography.styles.badge,
    color: colors.primary,
  },
  badgeConflict: {
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    flexShrink: 0,
  },
  badgeConflictText: {
    ...typography.styles.badge,
    color: colors.onErrorContainer,
  },
  badgeUnknown: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    flexShrink: 0,
  },
  badgeUnknownText: {
    ...typography.styles.badge,
    color: colors.onSurfaceVariant,
  },

  // Section wrapper for program list
  section: {
    gap: spacing[3],
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
  },
  selectedCountPill: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  selectedCountText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },

  // Program list
  programList: {
    gap: spacing[2],
  },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    minHeight: layout.touchTargetMin + 16,
    ...shadows.card,
  },
  programRowSelected: {
    backgroundColor: `${colors.primaryFixed}99`,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
  },
  programRowContent: {
    flex: 1,
    gap: spacing[1],
  },
  programRowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
  },
  typePill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  typePillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  programRowTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: typography.fontSize.sm * 1.4,
  },
  programRowMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
  },
  programRowAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.extrabold,
    fontFamily: typography.fontFamily.heading,
    color: colors.onSurface,
    flexShrink: 0,
    textAlign: "right",
    maxWidth: 80,
  },

  // Loading
  loadingBox: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    ...shadows.card,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
  },

  // Hint
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1.5],
    paddingVertical: spacing[2],
  },
  hintText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },

  // Sticky CTA
  ctaContainer: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[3],
    backgroundColor: colors.background,
    ...shadows.floating,
  },
  ctaOuter: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.primaryButton,
  },
  ctaBtn: {
    height: layout.buttonHeightLg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
  },
  ctaBtnLabel: {
    ...typography.styles.buttonLabel,
    color: colors.onPrimary,
  },
  ctaBtnDisabled: {
    height: layout.buttonHeightLg,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
  },
  ctaBtnDisabledLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textMuted,
  },
});
