/**
 * Program Detail Screen — /programs/[id]
 *
 * Korean government welfare app design:
 * - Sticky header: back arrow / "상세내용" / bookmark
 * - Hero info table card (지역, 개요, 지원유형, 신청기간)
 * - Status tracker bar (관심 → 신청예정 → 신청중 → 신청완료 → 결과대기 → 수혜완료)
 * - AI summary card (collapsible, 마지미가 요약해드려요!)
 * - 4-tab navigation: 지원내용 / 선정기준 / 신청방법 / 구비서류
 * - Fixed bottom bar: 자세히 보기 (outline) / 바로 신청하기 (filled blue)
 *
 * Data source: api.getProgram(id) → GET /api/v1/programs/:id
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  api,
  formatBenefit,
  type ApiProgram,
  type ApplicationStatus,
  type ProfileInput,
} from "@/lib/api";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
} from "@/constants/theme";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
import { useAuthStore } from "@/store/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = "support" | "criteria" | "how_to" | "documents";

interface DocumentItem {
  id: string;
  document_name: string;
  is_required: boolean;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Application status config
// ---------------------------------------------------------------------------

interface StatusStep {
  status: ApplicationStatus;
  label: string;
}

const STATUS_STEPS: StatusStep[] = [
  { status: "interested", label: "관심" },
  { status: "planning", label: "신청예정" },
  { status: "applying", label: "신청중" },
  { status: "applied", label: "신청완료" },
  { status: "waiting", label: "결과대기" },
  { status: "received", label: "수혜완료" },
];

function statusIndex(status: ApplicationStatus | null): number {
  if (!status) return -1;
  return STATUS_STEPS.findIndex((s) => s.status === status);
}

interface QuickActionConfig {
  label: string;
  nextStatus: ApplicationStatus | null;
}

function getQuickAction(current: ApplicationStatus | null): QuickActionConfig {
  switch (current) {
    case null:
    case "interested":
      return { label: "신청 준비하기", nextStatus: "planning" };
    case "planning":
      return { label: "신청했어요", nextStatus: "applying" };
    case "applying":
      return { label: "신청 완료!", nextStatus: "applied" };
    case "applied":
      return { label: "결과 나왔어요", nextStatus: "waiting" };
    case "waiting":
      return { label: "수혜 확정!", nextStatus: "received" };
    case "received":
      return { label: "수혜 후기 남기기", nextStatus: null };
    default:
      return { label: "상태 업데이트", nextStatus: null };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatApplicationPeriod(
  startAt: string | null,
  endAt: string | null,
  programStatus: string
): string {
  if (programStatus === "always_open") return "상시신청";
  if (!startAt && !endAt) return "상시신청";
  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
  };
  if (startAt && endAt) return `${fmt(startAt)} ~ ${fmt(endAt)}`;
  if (endAt) return `~ ${fmt(endAt)}`;
  if (startAt) return `${fmt(startAt)} ~`;
  return "상시신청";
}

function regionLabel(regionScope: unknown, regions: string[] | null): string {
  if (regions && regions.length > 0) {
    const map: Record<string, string> = {
      national: "전국",
      seoul: "서울특별시",
      busan: "부산광역시",
      daegu: "대구광역시",
      incheon: "인천광역시",
      gwangju: "광주광역시",
      daejeon: "대전광역시",
      ulsan: "울산광역시",
      sejong: "세종특별자치시",
      gyeonggi: "경기도",
    };
    return regions.map((r) => map[r] ?? r).join(" · ");
  }
  if (!regionScope) return "전국";
  if (typeof regionScope === "string") {
    const map: Record<string, string> = {
      national: "전국",
      seoul: "서울특별시",
      busan: "부산광역시",
      daegu: "대구광역시",
      incheon: "인천광역시",
      gwangju: "광주광역시",
      daejeon: "대전광역시",
      ulsan: "울산광역시",
      sejong: "세종특별자치시",
      gyeonggi: "경기도",
    };
    return map[regionScope] ?? regionScope;
  }
  return "전국";
}

interface ProgramTypeConfig {
  label: string;
  color: string;
  background: string;
}

function getProgramTypeConfig(type: string): ProgramTypeConfig {
  switch (type) {
    case "policy":
    case "youth_policy":
    case "support":
      return { label: "정책 지원", color: colors.primary, background: colors.primaryFixed };
    case "welfare":
      return { label: "복지비 지원", color: colors.primary, background: colors.primaryFixed };
    case "scholarship":
      return { label: "장학금", color: "#1d6b44", background: "#d1fae5" };
    case "corporate_benefit":
      return { label: "기업 혜택", color: "#9a3412", background: "#ffedd5" };
    default:
      return { label: type, color: colors.secondary, background: colors.secondaryFixed };
  }
}

// ---------------------------------------------------------------------------
// Mock/derived content for tab sections
// ---------------------------------------------------------------------------

function buildSupportContent(program: ApiProgram): string {
  const parts: string[] = [];
  const benefit = formatBenefit(program);
  if (benefit !== "혜택 확인") {
    parts.push(`지원금액: ${benefit}`);
  }
  if (program.summary) {
    parts.push(program.summary);
  }
  if (parts.length === 0) {
    parts.push("지원 내용에 대한 자세한 사항은 공식 사이트를 통해 확인하시기 바랍니다.");
  }
  return parts.join("\n\n");
}

function buildCriteriaContent(program: ApiProgram): string {
  const lines: string[] = [];
  if (program.min_age !== null || program.max_age !== null) {
    const min = program.min_age ?? 19;
    const max = program.max_age ?? 39;
    lines.push(`· 연령: 만 ${min}세 이상 ~ 만 ${max}세 이하`);
  } else {
    lines.push("· 연령: 제한 없음 (세부 공고 확인 필요)");
  }
  const region = regionLabel(program.region_scope, program.regions);
  lines.push(`· 거주지: ${region} 거주자`);
  lines.push("· 소득기준: 세부 공고 확인 필요");
  lines.push("· 기타 조건: 담당 기관 문의 또는 공식 사이트 참조");
  return lines.join("\n");
}

function buildHowToContent(program: ApiProgram): string {
  if (program.official_url) {
    return [
      "1. 공식 웹사이트 접속",
      "   " + program.official_url,
      "",
      "2. 회원 가입 / 로그인",
      "   · 공식 사이트에 회원가입 후 로그인합니다.",
      "",
      "3. 서비스 신청",
      "   · 신청서 작성 후 필요 서류를 첨부하여 제출합니다.",
      "",
      "4. 심사 및 결과 확인",
      "   · 신청 후 심사 결과는 문자 또는 공식 사이트에서 확인하세요.",
    ].join("\n");
  }
  return [
    "1. 담당 기관 방문 또는 온라인 신청",
    "",
    "2. 필요 서류 제출",
    "   · 구비서류 탭에서 필요 서류를 확인하세요.",
    "",
    "3. 심사 대기",
    "   · 신청 접수 후 심사 결과를 기다립니다.",
    "",
    "4. 결과 통보",
    "   · 결과는 담당 기관에서 개별 통보합니다.",
  ].join("\n");
}

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  { id: "1", document_name: "주민등록등본", is_required: true, description: "발급일로부터 3개월 이내 서류" },
  { id: "2", document_name: "소득증명원", is_required: true, description: "최근 1년 이내 발급된 서류" },
  { id: "3", document_name: "재학(휴학)증명서", is_required: false, description: "해당자에 한하여 제출" },
  { id: "4", document_name: "건강보험료 납부확인서", is_required: false, description: "소득 기준 확인용 (해당자 제출)" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoTableRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]} numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status tracker bar
// ---------------------------------------------------------------------------

interface StatusTrackerProps {
  currentStatus: ApplicationStatus | null;
  isUpdating: boolean;
  onStepPress: (status: ApplicationStatus) => void;
}

function StatusTracker({ currentStatus, isUpdating, onStepPress }: StatusTrackerProps) {
  const activeIdx = statusIndex(currentStatus);

  return (
    <View style={styles.trackerContainer}>
      <Text style={styles.trackerTitle}>신청 현황</Text>
      <View style={styles.trackerRow}>
        {STATUS_STEPS.map((step, idx) => {
          const isCompleted = idx < activeIdx;
          const isActive = idx === activeIdx;
          const isFuture = idx > activeIdx;

          return (
            <React.Fragment key={step.status}>
              {/* Connector line between dots */}
              {idx > 0 && (
                <View
                  style={[
                    styles.trackerLine,
                    isCompleted || isActive ? styles.trackerLineActive : styles.trackerLineInactive,
                  ]}
                />
              )}

              <TouchableOpacity
                style={styles.trackerStep}
                onPress={() => !isUpdating && onStepPress(step.status)}
                activeOpacity={0.7}
                disabled={isUpdating}
                accessibilityRole="button"
                accessibilityLabel={`${step.label} 상태로 변경`}
                accessibilityState={{ selected: isActive }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View
                  style={[
                    styles.trackerDot,
                    isCompleted && styles.trackerDotCompleted,
                    isActive && styles.trackerDotActive,
                    isFuture && styles.trackerDotFuture,
                  ]}
                >
                  {isCompleted && (
                    <Ionicons name="checkmark" size={8} color={colors.primary} />
                  )}
                  {isActive && isUpdating && (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  )}
                </View>
                <Text
                  style={[
                    styles.trackerLabel,
                    isActive && styles.trackerLabelActive,
                    isCompleted && styles.trackerLabelCompleted,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quick action button
// ---------------------------------------------------------------------------

interface QuickActionButtonProps {
  currentStatus: ApplicationStatus | null;
  isUpdating: boolean;
  onPress: () => void;
}

function QuickActionButton({ currentStatus, isUpdating, onPress }: QuickActionButtonProps) {
  const action = getQuickAction(currentStatus);

  // "수혜 후기 남기기" is a TODO — render a muted outline button
  const isTodo = action.nextStatus === null && currentStatus === "received";

  return (
    <TouchableOpacity
      style={[
        styles.quickActionBtn,
        isTodo ? styles.quickActionBtnOutline : styles.quickActionBtnFilled,
        isUpdating && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={isUpdating || isTodo}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      {isUpdating ? (
        <ActivityIndicator size="small" color={isTodo ? colors.primary : colors.onPrimary} />
      ) : (
        <Text
          style={[
            styles.quickActionBtnText,
            isTodo ? styles.quickActionBtnTextOutline : styles.quickActionBtnTextFilled,
          ]}
        >
          {action.label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// AI summary card
// ---------------------------------------------------------------------------

function AiSummaryCard({ program }: { program: ApiProgram }) {
  const [expanded, setExpanded] = useState(true);

  const benefitLabel = formatBenefit(program);
  const benefitBullets: string[] = [];
  if (benefitLabel !== "혜택 확인") {
    benefitBullets.push(benefitLabel + " 지원");
  }
  if (program.summary) {
    const truncated = program.summary.length > 60
      ? program.summary.substring(0, 60) + "..."
      : program.summary;
    benefitBullets.push(truncated);
  }
  if (benefitBullets.length === 0) {
    benefitBullets.push("공식 사이트에서 혜택을 확인하세요.");
  }

  const eligibilityBullets: string[] = [];
  if (program.min_age !== null || program.max_age !== null) {
    const min = program.min_age ?? 19;
    const max = program.max_age ?? 39;
    eligibilityBullets.push(`만 ${min}세 ~ ${max}세 청년`);
  } else {
    eligibilityBullets.push("연령 조건 없음 (공고 확인 필요)");
  }
  eligibilityBullets.push(`${regionLabel(program.region_scope, program.regions)} 거주자`);

  return (
    <View style={styles.aiCard}>
      <TouchableOpacity
        style={styles.aiCardHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "요약 접기" : "요약 펼치기"}
      >
        <View style={styles.aiCardHeaderLeft}>
          <Ionicons name="sparkles" size={20} color={colors.primary} />
          <Text style={styles.aiCardTitle}>마지미가 요약해드려요!</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.primary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.aiCardBody}>
          <View style={styles.aiSection}>
            <Text style={styles.aiSectionTitle}>혜택</Text>
            {benefitBullets.map((b, i) => (
              <View key={i} style={styles.aiBulletRow}>
                <Text style={styles.aiBulletDot}>•</Text>
                <Text style={styles.aiBulletText}>{b}</Text>
              </View>
            ))}
          </View>
          <View style={styles.aiDivider} />
          <View style={styles.aiSection}>
            <Text style={styles.aiSectionTitle}>대상</Text>
            {eligibilityBullets.map((b, i) => (
              <View key={i} style={styles.aiBulletRow}>
                <Text style={styles.aiBulletDot}>•</Text>
                <Text style={styles.aiBulletText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pre-check Diagnosis card
// ---------------------------------------------------------------------------

/** AsyncStorage key for the document vault */
const DOCUMENT_VAULT_KEY = "document_vault_v1";

/** Prep time (days) per document keyword — used for deadline analysis. */
const DOC_PREP_DAYS: Record<string, number> = {
  "재학증명서": 3,
  "재학(휴학)증명서": 3,
  "건강보험료": 1,
  "건강보험료 납부확인서": 1,
  "소득증명원": 1,
  "주민등록등본": 1,
};

function getDocPrepDays(name: string): number {
  for (const key of Object.keys(DOC_PREP_DAYS)) {
    if (name.includes(key)) return DOC_PREP_DAYS[key];
  }
  return 1;
}

interface ConditionItem {
  label: string;
  status: "ok" | "warn" | "fail";
}

interface UserProfile {
  region: string;
  age: string;
  enrollmentStatus: string;
  employmentStatus: string;
  incomeBracket: number | null;
}

interface PreCheckCardProps {
  program: ApiProgram;
  docChecked: Record<string, boolean>;
  onDocToggle: (id: string) => void;
  matchScore: number | null;
  matchScoreLoading: boolean;
  vaultDocIds: Set<string>;
}

/**
 * Build eligibility conditions by comparing the program's requirements
 * against the user's real profile data from the onboarding store.
 */
function buildConditions(program: ApiProgram, user: UserProfile): ConditionItem[] {
  const items: ConditionItem[] = [];

  // ── Region ──
  const programRegions: string[] = program.regions ?? [];
  const isNational =
    !programRegions.length ||
    programRegions.includes("national") ||
    String(program.region_scope) === "national";

  if (isNational) {
    items.push({ label: "거주지: 전국 가능", status: "ok" });
  } else if (user.region) {
    const userRegionKey = user.region.toLowerCase().replace(/\s/g, "");
    const match = programRegions.some((r) => {
      const regionMap: Record<string, string[]> = {
        seoul: ["서울", "seoul"],
        busan: ["부산", "busan"],
        daegu: ["대구", "daegu"],
        incheon: ["인천", "incheon"],
        gwangju: ["광주", "gwangju"],
        daejeon: ["대전", "daejeon"],
        ulsan: ["울산", "ulsan"],
        sejong: ["세종", "sejong"],
        gyeonggi: ["경기", "gyeonggi"],
      };
      const aliases = regionMap[r] ?? [r];
      return aliases.some((alias) => userRegionKey.includes(alias.toLowerCase()));
    });
    const regionDisplay = regionLabel(program.region_scope, program.regions);
    if (match) {
      items.push({ label: `거주지: ${regionDisplay} 거주 확인`, status: "ok" });
    } else {
      items.push({ label: `거주지: ${regionDisplay} 거주자 대상 (현재 ${user.region})`, status: "fail" });
    }
  } else {
    const regionDisplay = regionLabel(program.region_scope, program.regions);
    items.push({ label: `거주지: ${regionDisplay} 거주 — 미입력`, status: "warn" });
  }

  // ── Age ──
  if (program.min_age !== null || program.max_age !== null) {
    const min = program.min_age ?? 0;
    const max = program.max_age ?? 999;
    const userAge = parseInt(user.age, 10);
    if (user.age && !isNaN(userAge)) {
      const inRange = userAge >= min && userAge <= max;
      if (inRange) {
        items.push({ label: `나이: 만 ${min}~${max}세 조건 충족 (현재 ${userAge}세)`, status: "ok" });
      } else {
        items.push({ label: `나이: 만 ${min}~${max}세 대상 (현재 ${userAge}세)`, status: "fail" });
      }
    } else {
      items.push({ label: `나이: 만 ${min}세 ~ ${max}세 — 미입력`, status: "warn" });
    }
  }

  // ── Enrollment ──
  if (
    program.program_type === "scholarship" ||
    program.program_type === "welfare"
  ) {
    const enrolled = user.enrollmentStatus;
    if (!enrolled) {
      items.push({ label: "재학 여부: 미입력 — 확인 필요", status: "warn" });
    } else if (
      enrolled === "enrolled" ||
      enrolled === "재학중" ||
      enrolled === "university"
    ) {
      items.push({ label: "재학 여부: 대학 재학 확인", status: "ok" });
    } else {
      items.push({ label: `재학 여부: 재학 조건 (현재 ${enrolled})`, status: "warn" });
    }
  }

  // ── Income ──
  if (user.incomeBracket !== null && user.incomeBracket !== undefined) {
    items.push({ label: `소득 구간: ${user.incomeBracket}분위 입력됨`, status: "ok" });
  } else {
    items.push({ label: "소득 구간 미입력 — 입력하면 적합도가 올라가요", status: "warn" });
  }

  return items;
}

function PreCheckCard({
  program,
  docChecked,
  onDocToggle,
  matchScore,
  matchScoreLoading,
  vaultDocIds,
}: PreCheckCardProps) {
  const [expanded, setExpanded] = useState(true);

  // Read user profile from onboarding store
  const { region, age, enrollmentStatus, employmentStatus, incomeBracket } =
    useOnboardingStore();
  const userProfile: UserProfile = { region, age, enrollmentStatus, employmentStatus, incomeBracket };

  const conditions = useMemo(
    () => buildConditions(program, userProfile),
    [program, region, age, enrollmentStatus, employmentStatus, incomeBracket]
  );
  const conditionsMet = conditions.filter((c) => c.status === "ok").length;
  const conditionsTotal = conditions.length;

  const docs = DEFAULT_DOCUMENTS;
  const docsMet = docs.filter((d) => docChecked[d.id]).length;
  const docsTotal = docs.length;
  const docsProgress = docsTotal > 0 ? docsMet / docsTotal : 0;

  // Deadline analysis
  const deadlineStr = program.deadline_at ?? program.application_end_at;
  const daysToDeadline = deadlineStr
    ? Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const unpreparedDocs = docs.filter((d) => !docChecked[d.id]);
  const totalPrepDays = unpreparedDocs.reduce(
    (sum, d) => sum + getDocPrepDays(d.document_name),
    0
  );
  const maxPrepDays = unpreparedDocs.reduce(
    (max, d) => Math.max(max, getDocPrepDays(d.document_name)),
    0
  );
  // Docs that need 2+ days and are not yet checked — flag specifically
  const urgentDocs = unpreparedDocs.filter(
    (d) => getDocPrepDays(d.document_name) >= 2
  );

  let timeStatus: "ok" | "warn" | "na" = "na";
  let timeWarningDetail: string | null = null;
  if (daysToDeadline !== null && daysToDeadline > 0) {
    if (daysToDeadline > totalPrepDays + 1) {
      timeStatus = "ok";
    } else {
      timeStatus = "warn";
      // Build specific warning: list the bottleneck document
      if (urgentDocs.length > 0) {
        const bottleneck = urgentDocs[0];
        const prepDays = getDocPrepDays(bottleneck.document_name);
        timeWarningDetail = `${bottleneck.document_name} 발급에 ${prepDays}일 필요, 마감까지 ${daysToDeadline}일`;
      } else {
        timeWarningDetail = `서류 준비 ${totalPrepDays}일 필요, 마감까지 ${daysToDeadline}일`;
      }
    }
  }

  // Overall verdict
  const hasWarnCondition = conditions.some((c) => c.status === "warn");
  const hasFailCondition = conditions.some((c) => c.status === "fail");
  const docIncomplete = docsMet < docsTotal;
  const timeRisk = timeStatus === "warn";

  type Verdict = "pass" | "warn" | "fail";
  let verdict: Verdict = "pass";
  if (hasFailCondition || (timeRisk && docIncomplete)) verdict = "fail";
  else if (hasWarnCondition || docIncomplete || timeRisk) verdict = "warn";

  const verdictConfig: Record<
    Verdict,
    { label: string; icon: string; cardBg: string; headerBg: string; textColor: string; iconColor: string }
  > = {
    pass: {
      label: "신청 가능",
      icon: "checkmark-circle",
      cardBg: "#f0fdf4",
      headerBg: "#dcfce7",
      textColor: "#16a34a",
      iconColor: "#16a34a",
    },
    warn: {
      label: "보완 필요",
      icon: "warning",
      cardBg: "#fffbeb",
      headerBg: "#fef3c7",
      textColor: "#d97706",
      iconColor: "#d97706",
    },
    fail: {
      label: "신청 어려움",
      icon: "close-circle",
      cardBg: "#fff1f2",
      headerBg: "#ffe4e6",
      textColor: "#e11d48",
      iconColor: "#e11d48",
    },
  };
  const vc = verdictConfig[verdict];

  return (
    <View style={[styles.preCheckCard, { backgroundColor: vc.cardBg }]}>
      {/* Header row — tappable to collapse */}
      <TouchableOpacity
        style={[styles.preCheckHeader, { backgroundColor: vc.headerBg }]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "사전진단 접기" : "사전진단 펼치기"}
      >
        <View style={styles.preCheckHeaderLeft}>
          <Ionicons name="medkit-outline" size={18} color={vc.iconColor} />
          <Text style={[styles.preCheckHeaderTitle, { color: vc.textColor }]}>
            신청 사전진단
          </Text>
        </View>
        <View style={styles.preCheckHeaderRight}>
          {/* Match score badge */}
          {matchScoreLoading ? (
            <ActivityIndicator size="small" color={vc.textColor} style={{ marginRight: spacing[2] }} />
          ) : matchScore !== null ? (
            <View style={[styles.matchScoreBadge, { backgroundColor: vc.iconColor }]}>
              <Text style={styles.matchScoreBadgeText}>{matchScore}% 일치</Text>
            </View>
          ) : null}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={vc.textColor}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.preCheckBody}>
          {/* Overall verdict row with match score */}
          <View style={styles.preCheckVerdictRow}>
            <Ionicons name={vc.icon as any} size={22} color={vc.iconColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.preCheckVerdictLabel, { color: vc.textColor }]}>
                종합 판정: {vc.label}
              </Text>
              {matchScore !== null && (
                <Text style={[styles.preCheckMatchSubtext, { color: vc.textColor }]}>
                  룰엔진 매칭 점수 {matchScore}점 / 100
                </Text>
              )}
            </View>
          </View>

          <View style={styles.preCheckDivider} />

          {/* Section 1: Conditions */}
          <View style={styles.preCheckSection}>
            <View style={styles.preCheckSectionHeader}>
              <Text style={styles.preCheckSectionTitle}>자격 조건</Text>
              <Text style={styles.preCheckSectionCount}>
                {conditionsMet}/{conditionsTotal} 충족
              </Text>
            </View>
            {conditions.map((c, i) => (
              <View key={i} style={styles.preCheckItemRow}>
                <Ionicons
                  name={
                    c.status === "ok"
                      ? "checkmark-circle"
                      : c.status === "warn"
                      ? "warning"
                      : "close-circle"
                  }
                  size={15}
                  color={
                    c.status === "ok"
                      ? "#16a34a"
                      : c.status === "warn"
                      ? "#d97706"
                      : "#e11d48"
                  }
                  style={styles.preCheckItemIcon}
                />
                <Text style={styles.preCheckItemText}>{c.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.preCheckDivider} />

          {/* Section 2: Documents — interactive checklist with vault badges */}
          <View style={styles.preCheckSection}>
            <View style={styles.preCheckSectionHeader}>
              <Text style={styles.preCheckSectionTitle}>서류 준비</Text>
              <Text style={styles.preCheckSectionCount}>
                {docsMet}/{docsTotal} 완료
              </Text>
            </View>
            {/* Progress bar */}
            <View style={styles.preCheckProgressTrack}>
              <View
                style={[
                  styles.preCheckProgressFill,
                  {
                    width: `${Math.round(docsProgress * 100)}%` as any,
                    backgroundColor:
                      docsProgress >= 1
                        ? "#16a34a"
                        : docsProgress >= 0.5
                        ? "#d97706"
                        : "#e11d48",
                  },
                ]}
              />
            </View>
            {/* Document rows — tappable checkboxes */}
            {docs.map((d) => {
              const isChecked = docChecked[d.id] ?? false;
              const fromVault = vaultDocIds.has(d.id) || vaultDocIds.has(d.document_name);
              return (
                <Pressable
                  key={d.id}
                  style={styles.preCheckDocRow}
                  onPress={() => onDocToggle(d.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  accessibilityLabel={d.document_name}
                >
                  <View style={[styles.preCheckCheckbox, isChecked && styles.preCheckCheckboxChecked]}>
                    {isChecked && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.preCheckDocTitleRow}>
                      <Text style={[styles.preCheckDocName, isChecked && styles.preCheckDocNameChecked]}>
                        {d.document_name}
                      </Text>
                      {fromVault && (
                        <View style={styles.vaultBadge}>
                          <Ionicons name="folder-open-outline" size={10} color="#5CB1A7" />
                          <Text style={styles.vaultBadgeText}>보관함에서 가져옴</Text>
                        </View>
                      )}
                    </View>
                    {!isChecked && getDocPrepDays(d.document_name) >= 2 && (
                      <Text style={styles.preCheckDocPrepHint}>
                        발급 {getDocPrepDays(d.document_name)}~{getDocPrepDays(d.document_name) + 1}일 소요
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
            {docsMet >= docsTotal && (
              <View style={styles.preCheckItemRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color="#16a34a"
                  style={styles.preCheckItemIcon}
                />
                <Text style={styles.preCheckItemText}>모든 서류 준비 완료</Text>
              </View>
            )}
          </View>

          <View style={styles.preCheckDivider} />

          {/* Section 3: Deadline analysis */}
          <View style={styles.preCheckSection}>
            <Text style={styles.preCheckSectionTitle}>마감 분석</Text>
            {daysToDeadline === null ? (
              <View style={styles.preCheckItemRow}>
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={colors.onSurfaceVariant}
                  style={styles.preCheckItemIcon}
                />
                <Text style={styles.preCheckItemText}>마감일 정보 없음</Text>
              </View>
            ) : daysToDeadline <= 0 ? (
              <View style={styles.preCheckItemRow}>
                <Ionicons
                  name="close-circle"
                  size={15}
                  color="#e11d48"
                  style={styles.preCheckItemIcon}
                />
                <Text style={styles.preCheckItemText}>신청 기간 종료</Text>
              </View>
            ) : (
              <>
                <View style={styles.preCheckItemRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={colors.onSurfaceVariant}
                    style={styles.preCheckItemIcon}
                  />
                  <Text style={styles.preCheckItemText}>
                    마감까지 {daysToDeadline}일 / 서류 준비 예상 {totalPrepDays}일
                  </Text>
                </View>
                {timeWarningDetail ? (
                  <View style={styles.preCheckItemRow}>
                    <Ionicons
                      name="warning"
                      size={15}
                      color="#d97706"
                      style={styles.preCheckItemIcon}
                    />
                    <Text style={[styles.preCheckItemText, { color: "#d97706" }]}>
                      {timeWarningDetail}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.preCheckItemRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={15}
                      color="#16a34a"
                      style={styles.preCheckItemIcon}
                    />
                    <Text style={styles.preCheckItemText}>시간 여유 있음</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "support", label: "지원내용" },
  { key: "criteria", label: "선정기준" },
  { key: "how_to", label: "신청방법" },
  { key: "documents", label: "구비서류" },
];

function TabBar({ active, onPress }: { active: TabKey; onPress: (key: TabKey) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onPress(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isActive && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RichTextContent({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        const isStep = /^[1-4]\./.test(line);
        return (
          <Text key={i} style={[styles.richTextLine, isStep && styles.richTextStep]}>
            {line || " "}
          </Text>
        );
      })}
    </View>
  );
}

interface DocumentRowProps {
  item: DocumentItem;
  checked: boolean;
  onToggle: (id: string) => void;
}

function DocumentRow({ item, checked, onToggle }: DocumentRowProps) {
  return (
    <Pressable
      style={[styles.documentRow, checked && styles.documentRowChecked]}
      onPress={() => onToggle(item.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={item.document_name}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={13} color={colors.onPrimary} />}
      </View>
      <View style={styles.documentContent}>
        <View style={styles.documentTitleRow}>
          <Text style={[styles.documentName, checked && styles.documentNameChecked]}>
            {item.document_name}
          </Text>
          <View style={[styles.documentBadge, item.is_required ? styles.documentBadgeRequired : styles.documentBadgeOptional]}>
            <Text style={[styles.documentBadgeText, item.is_required ? styles.documentBadgeTextRequired : styles.documentBadgeTextOptional]}>
              {item.is_required ? "필수" : "선택"}
            </Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.documentDesc}>{item.description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error states
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function ErrorScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>프로그램 정보를 불러오지 못했어요</Text>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
      >
        <Text style={styles.backBtnText}>뒤로 가기</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { user } = useAuthStore();
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("support");

  // Document vault: IDs or names of documents the user already has
  const [vaultDocIds, setVaultDocIds] = useState<Set<string>>(new Set());

  // Document checked state — initialized with vault contents, then user-editable
  const [docChecked, setDocChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DEFAULT_DOCUMENTS.map((d) => [d.id, false]))
  );
  const handleDocToggle = (docId: string) =>
    setDocChecked((prev) => ({ ...prev, [docId]: !prev[docId] }));

  // Load document vault from AsyncStorage and auto-check matching docs
  useEffect(() => {
    AsyncStorage.getItem(DOCUMENT_VAULT_KEY)
      .then((raw) => {
        if (!raw) return;
        const vault: Record<string, boolean> = JSON.parse(raw);
        const vaultSet = new Set(Object.keys(vault).filter((k) => vault[k]));
        setVaultDocIds(vaultSet);

        // Auto-check any DEFAULT_DOCUMENTS whose id or name is in the vault
        setDocChecked((prev) => {
          const next = { ...prev };
          for (const doc of DEFAULT_DOCUMENTS) {
            if (vaultSet.has(doc.id) || vaultSet.has(doc.document_name)) {
              next[doc.id] = true;
            }
          }
          return next;
        });
      })
      .catch(() => {
        // Vault not available — proceed with all unchecked
      });
  }, []);

  // User profile from onboarding store — used to build the ProfileInput for match score
  const { region, age, enrollmentStatus, employmentStatus, incomeBracket } =
    useOnboardingStore();

  // Fetch program detail
  const { data: program, isLoading, error } = useQuery({
    queryKey: ["program", id],
    queryFn: () => api.getProgram(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Build ProfileInput from onboarding store for the match-score request
  const profileInput: ProfileInput | null = useMemo(() => {
    const birthYear = getBirthYear(age);
    if (!birthYear) return null;
    return {
      birth_year: birthYear,
      region_code: region || "national",
      enrollment_status: enrollmentStatus || null,
      employment_status: employmentStatus || null,
      income_bracket: incomeBracket,
    };
  }, [region, age, enrollmentStatus, employmentStatus, incomeBracket]);

  // Fetch match score via getRecommendPreview — extract the score for this program
  const { data: matchScoreData, isLoading: matchScoreLoading } = useQuery({
    queryKey: ["matchScore", id, profileInput],
    queryFn: async (): Promise<number | null> => {
      if (!profileInput || !id) return null;
      const result = await api.getRecommendPreview(profileInput);
      const item = result.items.find((i) => i.program_id === id);
      return item?.match_score ?? null;
    },
    enabled: !!id && !!profileInput,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const matchScore: number | null = matchScoreData ?? null;

  // Fetch current application status (null = not tracked yet)
  const { data: applicationDetail } = useQuery({
    queryKey: ["applicationStatus", id],
    queryFn: () => api.getApplicationStatus(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const currentStatus: ApplicationStatus | null =
    applicationDetail?.current_status ?? null;

  // Mutation to update status
  const { mutate: updateStatus, isPending: isUpdating } = useMutation({
    mutationFn: (nextStatus: ApplicationStatus) =>
      api.updateApplicationStatus(id!, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicationStatus", id] });
    },
  });

  function handleStepPress(status: ApplicationStatus) {
    if (status === currentStatus) return;
    updateStatus(status);
  }

  function handleQuickAction() {
    const action = getQuickAction(currentStatus);
    if (action.nextStatus) {
      updateStatus(action.nextStatus);
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (error || !program) return <ErrorScreen onBack={() => router.back()} />;

  const typeConfig = getProgramTypeConfig(program.program_type);
  const applicationPeriod = formatApplicationPeriod(
    program.application_start_at,
    program.application_end_at,
    program.program_status
  );
  const programRegionLabel = regionLabel(program.region_scope, program.regions);
  const bottomBarHeight = 80 + (insets.bottom > 0 ? insets.bottom : spacing[4]);

  async function handleBookmark() {
    if (!user) {
      Alert.alert("로그인 필요", "북마크를 사용하려면 로그인이 필요합니다.", [
        { text: "취소" },
        { text: "로그인", onPress: () => router.push("/login") },
      ]);
      return;
    }
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const result = await api.toggleBookmark(program!.id);
      setBookmarked(result.bookmarked);
    } catch {
      setBookmarked((v) => !v);
    } finally {
      setBookmarkLoading(false);
    }
  }

  function handleViewDetail() {
    if (program?.official_url) Linking.openURL(program.official_url);
  }

  function handleApply() {
    if (!user) {
      Alert.alert("로그인 필요", "신청 도우미를 사용하려면 로그인이 필요합니다.", [
        { text: "취소" },
        { text: "로그인", onPress: () => router.push("/login") },
      ]);
      return;
    }
    router.push(`/apply-assistant?programId=${program!.id}`);
  }

  function handleAutoFill() {
    if (!user) {
      Alert.alert("로그인 필요", "신청 정보 자동 입력을 사용하려면 로그인이 필요합니다.", [
        { text: "취소" },
        { text: "로그인", onPress: () => router.push("/login") },
      ]);
      return;
    }
    router.push(`/auto-fill?programId=${program!.id}`);
  }

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : spacing[5] }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>상세내용</Text>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleBookmark}
            disabled={bookmarkLoading}
            accessibilityRole="button"
            accessibilityLabel={bookmarked ? "북마크 취소" : "북마크"}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {bookmarkLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={bookmarked ? "bookmark" : "bookmark-outline"}
                size={22}
                color={bookmarked ? colors.primary : colors.onSurfaceVariant}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomBarHeight + spacing[6] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          {program.provider_name ? (
            <Text style={styles.heroProvider}>{program.provider_name}</Text>
          ) : null}
          <Text style={styles.heroTitle}>{program.title}</Text>

          {/* Info table */}
          <View style={styles.infoTable}>
            <InfoTableRow label="지역" value={programRegionLabel} />
            <View style={styles.infoRowDivider} />

            {program.summary ? (
              <>
                <InfoTableRow label="개요" value={program.summary} />
                <View style={styles.infoRowDivider} />
              </>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>지원유형</Text>
              <Text style={[styles.infoValue, { color: typeConfig.color }]}>
                {typeConfig.label}
              </Text>
            </View>
            <View style={styles.infoRowDivider} />

            <InfoTableRow label="신청기간" value={applicationPeriod} />
          </View>
        </View>

        {/* Gray strip — section divider (No-Line Rule) */}
        <View style={styles.sectionStrip} />

        {/* ── Status tracker ── */}
        <View style={styles.sectionPad}>
          <StatusTracker
            currentStatus={currentStatus}
            isUpdating={isUpdating}
            onStepPress={handleStepPress}
          />
          <QuickActionButton
            currentStatus={currentStatus}
            isUpdating={isUpdating}
            onPress={handleQuickAction}
          />
        </View>

        {/* Gray strip */}
        <View style={styles.sectionStrip} />

        {/* ── Pre-check Diagnosis ── */}
        <View style={styles.sectionPad}>
          <PreCheckCard
            program={program}
            docChecked={docChecked}
            onDocToggle={handleDocToggle}
            matchScore={matchScore}
            matchScoreLoading={matchScoreLoading}
            vaultDocIds={vaultDocIds}
          />
        </View>

        {/* Gray strip */}
        <View style={styles.sectionStrip} />

        {/* ── AI Summary ── */}
        <View style={styles.sectionPad}>
          <AiSummaryCard program={program} />
        </View>

        {/* Gray strip */}
        <View style={styles.sectionStrip} />

        {/* ── Tab navigation + content ── */}
        <View style={styles.tabSection}>
          <TabBar active={activeTab} onPress={setActiveTab} />
          <View style={styles.tabContentDivider} />

          <View style={styles.tabContent}>
            {activeTab === "support" && (
              <RichTextContent text={buildSupportContent(program)} />
            )}
            {activeTab === "criteria" && (
              <RichTextContent text={buildCriteriaContent(program)} />
            )}
            {activeTab === "how_to" && (
              <RichTextContent text={buildHowToContent(program)} />
            )}
            {activeTab === "documents" && (
              <View style={styles.documentsList}>
                {DEFAULT_DOCUMENTS.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    item={doc}
                    checked={docChecked[doc.id] ?? false}
                    onToggle={handleDocToggle}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Fixed bottom bar ── */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing[4] },
        ]}
      >
        {/* Row 1: 신청 정보 준비 — full width */}
        <TouchableOpacity
          style={styles.autoFillBtn}
          onPress={handleAutoFill}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="신청 정보 준비"
        >
          <Text style={styles.autoFillBtnText}>신청 정보 준비</Text>
        </TouchableOpacity>

        {/* Row 2: 자세히 보기 + 바로 신청하기 */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.detailBtn, !program.official_url && styles.btnDisabled]}
            onPress={handleViewDetail}
            activeOpacity={0.8}
            disabled={!program.official_url}
            accessibilityRole="link"
            accessibilityLabel="자세히 보기"
          >
            <Text style={styles.detailBtnText}>자세히 보기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={handleApply}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="바로 신청하기"
          >
            <Text style={styles.applyBtnText}>바로 신청하기</Text>
          </TouchableOpacity>
        </View>
      </View>
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

  // ── Header ──
  header: {
    backgroundColor: colors.surfaceContainerLowest,
    zIndex: 50,
    ...Platform.select({
      ios: {
        shadowColor: colors.secondaryFixedDim,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  headerIconBtn: {
    minWidth: layout.touchTargetMin,
    minHeight: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  scroll: {
    flex: 1,
  },

  // ── Hero card ──
  heroCard: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  heroProvider: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  heroTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    lineHeight: 32,
    letterSpacing: typography.letterSpacing.tight,
  },

  // Info table inside hero card
  infoTable: {
    marginTop: spacing[2],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing[3],
    gap: spacing[4],
  },
  infoLabel: {
    width: 58,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    paddingTop: 2,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    lineHeight: 20,
  },
  infoRowDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginHorizontal: -spacing[4],
  },

  // ── Section strip divider (background color shift, no 1px line) ──
  sectionStrip: {
    height: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
  },

  sectionPad: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    gap: spacing[4],
  },

  // ── Status tracker ──
  trackerContainer: {
    gap: spacing[3],
  },
  trackerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  trackerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  trackerStep: {
    alignItems: "center",
    gap: spacing[1],
    // Each step shrinks/grows equally; flex:1 is set on the connector lines
  },
  trackerLine: {
    flex: 1,
    height: 2,
    marginTop: (layout.progressDotSizeActive / 2) - 1, // vertically center on dot
    alignSelf: "flex-start",
  },
  trackerLineActive: {
    backgroundColor: colors.primary,
  },
  trackerLineInactive: {
    backgroundColor: colors.outlineVariant,
  },
  trackerDot: {
    width: layout.progressDotSizeActive,
    height: layout.progressDotSizeActive,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  trackerDotActive: {
    backgroundColor: colors.primary,
    width: 16,
    height: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  trackerDotCompleted: {
    backgroundColor: colors.primaryFixed,
  },
  trackerDotFuture: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  trackerLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    maxWidth: 44,
  },
  trackerLabelActive: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  trackerLabelCompleted: {
    color: colors.onPrimaryFixedVariant,
  },

  // ── Quick action button ──
  quickActionBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.lg,
    minHeight: layout.buttonHeightMd,
    paddingHorizontal: spacing[5],
  },
  quickActionBtnFilled: {
    backgroundColor: colors.primary,
    ...shadows.primaryButton,
  },
  quickActionBtnOutline: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  quickActionBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
  },
  quickActionBtnTextFilled: {
    color: colors.onPrimary,
  },
  quickActionBtnTextOutline: {
    color: colors.onSurfaceVariant,
  },

  // ── AI Summary card ──
  aiCard: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  aiCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  aiCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  aiCardBody: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[5],
    gap: spacing[3],
  },
  aiSection: {
    gap: spacing[2],
  },
  aiSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },
  aiBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
  },
  aiBulletDot: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    marginTop: 1,
    lineHeight: 20,
  },
  aiBulletText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onPrimaryFixed,
    lineHeight: 20,
  },
  aiDivider: {
    height: 1,
    backgroundColor: colors.primaryFixedDim,
    opacity: 0.6,
    marginVertical: spacing[1],
  },

  // ── Pre-check Diagnosis card ──
  preCheckCard: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  preCheckHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  preCheckHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  preCheckHeaderTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  preCheckBody: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[5],
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  preCheckVerdictRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  preCheckVerdictLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.extrabold,
  },
  preCheckDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.07)",
    marginVertical: spacing[1],
  },
  preCheckSection: {
    gap: spacing[2],
  },
  preCheckSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preCheckSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  preCheckSectionCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  preCheckItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
  },
  preCheckItemIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  preCheckItemText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurface,
    lineHeight: 20,
  },
  preCheckProgressTrack: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  preCheckProgressFill: {
    height: "100%",
    borderRadius: borderRadius.full,
  },
  preCheckHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  matchScoreBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  matchScoreBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  preCheckMatchSubtext: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    opacity: 0.75,
    marginTop: 2,
  },
  preCheckDocRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    paddingVertical: spacing[2],
    minHeight: layout.touchTargetMin,
  },
  preCheckCheckbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLowest,
    marginTop: 2,
    flexShrink: 0,
  },
  preCheckCheckboxChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  preCheckDocTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  preCheckDocName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurface,
  },
  preCheckDocNameChecked: {
    color: "#16a34a",
    textDecorationLine: "line-through",
    opacity: 0.75,
  },
  preCheckDocPrepHint: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: "#d97706",
    marginTop: 2,
  },
  vaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: "#dbeafe",
  },
  vaultBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.semibold,
    color: "#5CB1A7",
  },

  // ── Tab navigation ──
  tabSection: {
    backgroundColor: colors.surfaceContainerLowest,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing[2],
    backgroundColor: colors.surfaceContainerLowest,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing[4],
    position: "relative",
    minHeight: layout.touchTargetMin,
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  tabLabelActive: {
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: spacing[2],
    right: spacing[2],
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  tabContentDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
  },
  tabContent: {
    padding: spacing[5],
    backgroundColor: colors.surfaceContainerLowest,
    minHeight: 180,
  },

  // Rich text in tabs
  richTextLine: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurface,
    lineHeight: 22,
  },
  richTextStep: {
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing[3],
  },

  // ── Documents list (구비서류 tab) ──
  documentsList: {
    gap: spacing[3],
  },
  documentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    minHeight: layout.touchTargetMin,
  },
  documentRowChecked: {
    backgroundColor: "#f0fdf4",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLowest,
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  documentContent: {
    flex: 1,
    gap: spacing[1],
  },
  documentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  documentName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  documentNameChecked: {
    color: "#16a34a",
  },
  documentBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  documentBadgeRequired: {
    backgroundColor: colors.primaryFixed,
  },
  documentBadgeOptional: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  documentBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  documentBadgeTextRequired: {
    color: colors.onPrimaryFixedVariant,
  },
  documentBadgeTextOptional: {
    color: colors.onSurfaceVariant,
  },
  documentDesc: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
  },

  // ── Fixed bottom bar ──
  bottomBar: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    flexDirection: "column",
    gap: spacing[3],
    ...Platform.select({
      ios: {
        shadowColor: colors.secondaryFixedDim,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 8, shadowColor: colors.secondaryFixedDim },
    }),
  },
  bottomRow: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "center",
  },
  autoFillBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minHeight: layout.buttonHeightSm,
    backgroundColor: colors.primaryFixed,
  },
  autoFillBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  detailBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minHeight: layout.buttonHeightMd,
    backgroundColor: colors.surfaceContainerLowest,
  },
  detailBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  applyBtn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    minHeight: layout.buttonHeightMd,
    backgroundColor: colors.primary,
    ...shadows.primaryButton,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },

  // ── Loading / Error ──
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing[6],
    gap: spacing[3],
  },
  errorTitle: {
    fontSize: typography.fontSize.base,
    color: colors.onSurfaceVariant,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },
  backBtn: {
    marginTop: spacing[2],
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[7],
    paddingVertical: spacing[3],
    minHeight: layout.touchTargetMin,
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
    fontWeight: typography.fontWeight.medium,
  },
});
