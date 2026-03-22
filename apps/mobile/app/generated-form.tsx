/**
 * Generated Form Screen — /generated-form?programId=xxx
 *
 * Shows a preview of the application data that will be included in the PDF,
 * then allows the user to:
 *   1. Generate the PDF (full version or simple form)
 *   2. Share via expo-sharing
 *   3. Print via expo-print (future; deferred to system share sheet for now)
 *
 * Route: /generated-form?programId=xxx
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";

import { api, formatBenefit, programStatusLabel, type ApiProgram } from "@/lib/api";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
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
  generateApplicationPDF,
  generateSimpleFormPDF,
  type PdfProfile,
  type PdfProgram,
  type PdfDocument,
  type ApplicationStep,
} from "@/lib/pdf-generator";

// ---------------------------------------------------------------------------
// Label maps (same as auto-fill.tsx)
// ---------------------------------------------------------------------------

const ENROLLMENT_LABELS: Record<string, string> = {
  enrolled: "재학",
  on_leave: "휴학",
  graduated: "졸업",
  prospective: "입학예정",
  dropped_out: "자퇴/제적",
};

const INCOME_LABELS: Record<number, string> = {
  1: "1구간 (소득 하위 10%)",
  2: "2구간 (소득 하위 20%)",
  3: "3구간 (소득 하위 30%)",
  4: "4구간 (소득 하위 40%)",
  5: "5구간 (소득 하위 50%)",
  6: "6구간 (소득 하위 60%)",
  7: "7구간 (소득 하위 70%)",
  8: "8구간 (소득 하위 80%)",
  9: "9구간 (소득 하위 90%)",
  10: "10구간 (소득 상위)",
};

const REGION_LABELS: Record<string, string> = {
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
  gangwon: "강원도",
  chungbuk: "충청북도",
  chungnam: "충청남도",
  jeonbuk: "전라북도",
  jeonnam: "전라남도",
  gyeongbuk: "경상북도",
  gyeongnam: "경상남도",
  jeju: "제주특별자치도",
};

// ---------------------------------------------------------------------------
// Profile builder
// ---------------------------------------------------------------------------

function buildPdfProfile(
  local: ReturnType<typeof useOnboardingStore.getState>,
  server: import("@/lib/api").UserProfile | null
): PdfProfile {
  const birthYear =
    server?.birth_year
      ? `${server.birth_year}년`
      : local.age
      ? `${getBirthYear(local.age)}년`
      : null;

  const rawRegion = server?.region_code ?? local.region ?? null;
  const region = rawRegion ? (REGION_LABELS[rawRegion] ?? rawRegion) : null;

  const rawSchool = server?.school_name ?? local.schoolName ?? null;
  const rawSchoolYear = server?.school_year;
  const schoolYear = rawSchoolYear ? `${rawSchoolYear}학년` : null;

  const rawEnrollment = server?.enrollment_status ?? local.enrollmentStatus ?? null;
  const enrollmentStatus = rawEnrollment
    ? (ENROLLMENT_LABELS[rawEnrollment] ?? rawEnrollment)
    : null;

  const rawIncome = server?.income_bracket ?? local.incomeBracket ?? null;
  const incomeBracket =
    rawIncome !== null ? (INCOME_LABELS[rawIncome] ?? `${rawIncome}구간`) : null;

  const rawHousehold = server?.household_size ?? null;
  const householdSize = rawHousehold ? `${rawHousehold}인 가구` : null;

  return {
    name: null,
    birthYear,
    region,
    contact: null,
    schoolName: rawSchool,
    schoolYear,
    enrollmentStatus,
    incomeBracket,
    householdSize,
  };
}

function buildPdfProgram(program: ApiProgram): PdfProgram {
  const benefitLabel = formatBenefit(program);

  let deadline: string | null = null;
  if (program.deadline_at) {
    const d = new Date(program.deadline_at);
    deadline = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  } else if (program.application_end_at) {
    const d = new Date(program.application_end_at);
    deadline = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  return {
    id: program.id,
    title: program.title,
    providerName: program.provider_name,
    deadline,
    benefitLabel,
    officialUrl: program.official_url,
    programType: program.program_type,
  };
}

// ---------------------------------------------------------------------------
// Default documents list for common government forms
// ---------------------------------------------------------------------------

function buildDefaultDocuments(program: ApiProgram): PdfDocument[] {
  const base: PdfDocument[] = [
    { name: "신분증 (주민등록증 또는 여권)", required: true, prepared: false },
    { name: "주민등록등본 (최근 3개월 이내)", required: true, prepared: false },
    { name: "재학증명서 또는 졸업증명서", required: true, prepared: false },
    { name: "소득증빙서류 (가족관계증명서, 건강보험료 납부확인서)", required: true, prepared: false },
    { name: "통장 사본 (입금 계좌)", required: true, prepared: false },
  ];

  if (program.program_type === "scholarship") {
    base.push({ name: "성적증명서 (최근 학기)", required: true, prepared: false });
    base.push({ name: "장학금 신청서 (기관 양식)", required: true, prepared: false });
  }

  if (program.program_type === "youth_policy" || program.program_type === "support") {
    base.push({ name: "사업계획서 또는 활동계획서", required: false, prepared: false });
  }

  return base;
}

// ---------------------------------------------------------------------------
// Default application steps
// ---------------------------------------------------------------------------

function buildDefaultSteps(program: ApiProgram): ApplicationStep[] {
  return [
    {
      step: 1,
      label: "자격 확인",
      detail: "나이, 소득, 학적 등 기본 자격 요건을 확인하세요.",
    },
    {
      step: 2,
      label: "서류 준비",
      detail: "위 체크리스트의 필요 서류를 미리 준비하세요.",
    },
    {
      step: 3,
      label: "공식 사이트 접속 및 신청서 작성",
      detail: program.official_url
        ? `${program.official_url} 에 접속하여 신청서를 작성하세요.`
        : "공식 기관 사이트에서 신청서를 작성하세요.",
    },
    {
      step: 4,
      label: "서류 업로드 또는 제출",
      detail: "준비한 서류를 온라인으로 업로드하거나 우편으로 발송하세요.",
    },
    {
      step: 5,
      label: "결과 확인",
      detail: "신청 후 2~4주 이내에 이메일 또는 공식 사이트에서 결과를 확인하세요.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(message);
      setVisible(true);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    },
    [anim]
  );

  return { visible, msg, anim, show };
}

// ---------------------------------------------------------------------------
// Info row component
// ---------------------------------------------------------------------------

function InfoRow({ label, value, highlight = false }: { label: string; value: string | null; highlight?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text
        style={[
          rowStyles.value,
          !value && rowStyles.valueMuted,
          highlight && value && rowStyles.valueHighlight,
        ]}
        numberOfLines={2}
      >
        {value ?? "미입력"}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing[3],
    gap: spacing[3],
    minHeight: 40,
  },
  label: {
    width: 100,
    flexShrink: 0,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
  },
  value: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    lineHeight: 19,
  },
  valueMuted: {
    color: colors.textMuted,
    fontWeight: typography.fontWeight.regular,
  },
  valueHighlight: {
    color: colors.primary,
  },
});

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionCard.container}>
      <View style={sectionCard.header}>
        <Text style={sectionCard.icon}>{icon}</Text>
        <Text style={sectionCard.title}>{title}</Text>
      </View>
      <View style={sectionCard.body}>{children}</View>
    </View>
  );
}

const sectionCard = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    overflow: "hidden",
    ...shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  icon: {
    fontSize: 14,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },
  body: {
    paddingHorizontal: spacing[4],
  },
});

// ---------------------------------------------------------------------------
// Document checklist item
// ---------------------------------------------------------------------------

function DocItem({
  doc,
  onToggle,
}: {
  doc: PdfDocument;
  onToggle: (name: string) => void;
}) {
  return (
    <TouchableOpacity
      style={docStyles.row}
      onPress={() => onToggle(doc.name)}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityLabel={doc.name}
      accessibilityState={{ checked: doc.prepared }}
    >
      <View style={[docStyles.checkbox, doc.prepared && docStyles.checkboxChecked]}>
        {doc.prepared && <Text style={docStyles.checkmark}>✓</Text>}
      </View>
      <Text style={[docStyles.label, doc.prepared && docStyles.labelChecked]} numberOfLines={2}>
        {doc.name}
      </Text>
      <View style={[docStyles.badge, doc.prepared ? docStyles.badgeReady : doc.required ? docStyles.badgeRequired : docStyles.badgeOptional]}>
        <Text style={[docStyles.badgeText, doc.prepared ? docStyles.badgeTextReady : doc.required ? docStyles.badgeTextRequired : docStyles.badgeTextOptional]}>
          {doc.prepared ? "준비완료" : doc.required ? "필수" : "선택"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const docStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: "#1d6b44",
    borderColor: "#1d6b44",
  },
  checkmark: {
    fontSize: 13,
    color: colors.onPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  label: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.onSurface,
    lineHeight: 18,
  },
  labelChecked: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  badgeReady: { backgroundColor: "#d1fae5" },
  badgeRequired: { backgroundColor: colors.errorContainer },
  badgeOptional: { backgroundColor: colors.surfaceContainerHigh },
  badgeText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  badgeTextReady: { color: "#1d6b44" },
  badgeTextRequired: { color: colors.onErrorContainer },
  badgeTextOptional: { color: colors.textMuted },
});

// ---------------------------------------------------------------------------
// Step item
// ---------------------------------------------------------------------------

function StepItem({ step }: { step: ApplicationStep }) {
  return (
    <View style={stepStyles.row}>
      <View style={stepStyles.circle}>
        <Text style={stepStyles.circleNum}>{step.step}</Text>
      </View>
      <View style={stepStyles.content}>
        <Text style={stepStyles.label}>{step.label}</Text>
        {step.detail ? (
          <Text style={stepStyles.detail} numberOfLines={3}>
            {step.detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing[3],
    gap: spacing[3],
    minHeight: 44,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  circleNum: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  content: {
    flex: 1,
    gap: spacing[0.5],
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    lineHeight: 19,
  },
  detail: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
  },
});

// ---------------------------------------------------------------------------
// PDF action button
// ---------------------------------------------------------------------------

type PdfState = "idle" | "generating" | "done" | "error";

interface PdfActionButtonProps {
  label: string;
  sublabel: string;
  icon: string;
  onPress: () => void;
  state: PdfState;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

function PdfActionButton({
  label,
  sublabel,
  icon,
  onPress,
  state,
  disabled,
  variant = "primary",
}: PdfActionButtonProps) {
  const isLoading = state === "generating";
  const isDone = state === "done";

  if (variant === "primary") {
    return (
      <TouchableOpacity
        style={[btnStyles.primaryWrap, (disabled || isLoading) && btnStyles.disabled]}
        onPress={onPress}
        disabled={disabled || isLoading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <LinearGradient
          colors={isDone ? ["#1d6b44", "#2d9c64"] : [colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={btnStyles.primaryGradient}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={btnStyles.primaryIcon}>{isDone ? "✓" : icon}</Text>
          )}
          <View style={btnStyles.primaryTextGroup}>
            <Text style={btnStyles.primaryLabel}>
              {isLoading ? "생성 중..." : isDone ? "생성 완료" : label}
            </Text>
            <Text style={btnStyles.primarySublabel}>{sublabel}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[btnStyles.secondaryWrap, (disabled || isLoading) && btnStyles.disabled]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Text style={btnStyles.secondaryIcon}>{icon}</Text>
      )}
      <Text style={btnStyles.secondaryLabel}>{isLoading ? "처리 중..." : label}</Text>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  primaryWrap: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightLg,
    ...shadows.primaryButton,
  },
  primaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    gap: spacing[3],
    minHeight: layout.buttonHeightLg,
  },
  primaryIcon: {
    fontSize: 22,
    flexShrink: 0,
  },
  primaryTextGroup: {
    flex: 1,
    gap: spacing[0.5],
  },
  primaryLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  primarySublabel: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.75)",
  },
  disabled: {
    opacity: 0.5,
  },
  secondaryWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLowest,
    minHeight: layout.buttonHeightMd,
  },
  secondaryIcon: {
    fontSize: 16,
  },
  secondaryLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GeneratedFormScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  // Zustand store
  const localStore = useOnboardingStore();

  // Server profile
  const { data: profileResponse } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.getProfile(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  // Program data
  const { data: program, isLoading: programLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => api.getProgram(programId!),
    enabled: !!programId,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Build profile + program objects
  const pdfProfile = buildPdfProfile(localStore, profileResponse?.profile ?? null);
  const pdfProgram: PdfProgram | null = program ? buildPdfProgram(program) : null;

  // Editable document checklist (user can toggle prepared status)
  const [docs, setDocs] = React.useState<PdfDocument[]>([]);
  const docsInitialized = React.useRef(false);

  React.useEffect(() => {
    if (program && !docsInitialized.current) {
      setDocs(buildDefaultDocuments(program));
      docsInitialized.current = true;
    }
  }, [program]);

  const steps = program ? buildDefaultSteps(program) : [];

  // Toggle document prepared state
  const toggleDoc = useCallback((name: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.name === name ? { ...d, prepared: !d.prepared } : d))
    );
  }, []);

  // PDF generation state
  const [fullPdfState, setFullPdfState] = useState<PdfState>("idle");
  const [simplePdfState, setSimplePdfState] = useState<PdfState>("idle");
  const [lastFileUri, setLastFileUri] = useState<string | null>(null);

  // ── Generate full PDF ──
  const handleGenerateFull = useCallback(async () => {
    if (!pdfProgram) return;
    setFullPdfState("generating");
    try {
      const uri = await generateApplicationPDF(pdfProfile, pdfProgram, docs, steps);
      setLastFileUri(uri);
      setFullPdfState("done");
      toast.show("PDF가 생성되었어요.");
    } catch (err) {
      console.error("[PDF] generateApplicationPDF failed:", err);
      setFullPdfState("error");
      toast.show("PDF 생성에 실패했어요. 다시 시도해주세요.");
    }
  }, [pdfProfile, pdfProgram, docs, steps, toast]);

  // ── Generate simple form PDF ──
  const handleGenerateSimple = useCallback(async () => {
    if (!pdfProgram) return;
    setSimplePdfState("generating");
    try {
      const uri = await generateSimpleFormPDF(pdfProfile, pdfProgram);
      setLastFileUri(uri);
      setSimplePdfState("done");
      toast.show("간편 서식이 생성되었어요.");
    } catch (err) {
      console.error("[PDF] generateSimpleFormPDF failed:", err);
      setSimplePdfState("error");
      toast.show("생성에 실패했어요. 다시 시도해주세요.");
    }
  }, [pdfProfile, pdfProgram, toast]);

  // ── Share ──
  const handleShare = useCallback(async () => {
    if (!lastFileUri) {
      toast.show("먼저 PDF를 생성해주세요.");
      return;
    }
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("공유 불가", "이 기기에서는 공유 기능을 사용할 수 없습니다.");
        return;
      }
      await Sharing.shareAsync(lastFileUri, {
        mimeType: "application/pdf",
        dialogTitle: pdfProgram ? `${pdfProgram.title} 신청서` : "신청서 공유",
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      console.error("[Share] failed:", err);
      toast.show("공유에 실패했어요.");
    }
  }, [lastFileUri, pdfProgram, toast]);

  // ── Print (iOS: expo-print would be ideal; for now redirect to share sheet) ──
  const handlePrint = useCallback(async () => {
    if (!lastFileUri) {
      toast.show("먼저 PDF를 생성해주세요.");
      return;
    }
    // expo-print is not in the current package.json; we use the share sheet
    // which on iOS shows AirPrint as a target automatically.
    handleShare();
  }, [lastFileUri, handleShare]);

  const hasPdf = fullPdfState === "done" || simplePdfState === "done";
  const bottomBarH = 80 + (insets.bottom > 0 ? insets.bottom : spacing[4]);

  // ── Loading state ──
  if (programLoading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>프로그램 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + spacing[2] : spacing[8] }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>신청서 PDF 생성</Text>
            {program?.title ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {program.title}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerHint}>
          <Text style={styles.headerHintText}>
            입력된 프로필로 신청서를 자동 작성하고 PDF로 저장하세요
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomBarH + spacing[6] }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Program info ── */}
        <View style={styles.spacer} />
        <SectionCard title="프로그램 정보" icon="📋">
          <InfoRow label="프로그램명" value={program?.title ?? null} highlight />
          <View style={styles.rowDivider} />
          <InfoRow label="제공 기관" value={program?.provider_name ?? null} />
          <View style={styles.rowDivider} />
          <InfoRow label="지원 유형" value={program?.program_type ?? null} />
          <View style={styles.rowDivider} />
          <InfoRow label="지원 금액" value={program ? formatBenefit(program) : null} />
          <View style={styles.rowDivider} />
          <InfoRow
            label="신청 마감"
            value={
              program?.deadline_at
                ? new Date(program.deadline_at).toLocaleDateString("ko-KR")
                : program?.application_end_at
                ? new Date(program.application_end_at).toLocaleDateString("ko-KR")
                : "마감일 미정"
            }
          />
          <View style={styles.rowDivider} />
          <InfoRow label="공식 URL" value={program?.official_url ?? null} />
        </SectionCard>

        {/* ── Applicant info ── */}
        <SectionCard title="신청인 정보 (내 프로필)" icon="👤">
          <InfoRow label="이름" value={pdfProfile.name} />
          <View style={styles.rowDivider} />
          <InfoRow label="생년월일" value={pdfProfile.birthYear} />
          <View style={styles.rowDivider} />
          <InfoRow label="주소 (지역)" value={pdfProfile.region} />
          <View style={styles.rowDivider} />
          <InfoRow label="연락처" value={pdfProfile.contact} />
          <View style={styles.rowDivider} />
          <InfoRow label="학교명" value={pdfProfile.schoolName} />
          <View style={styles.rowDivider} />
          <InfoRow label="학년" value={pdfProfile.schoolYear} />
          <View style={styles.rowDivider} />
          <InfoRow label="학적 상태" value={pdfProfile.enrollmentStatus} />
          <View style={styles.rowDivider} />
          <InfoRow label="소득 구간" value={pdfProfile.incomeBracket} />
          <View style={styles.rowDivider} />
          <InfoRow label="가구원수" value={pdfProfile.householdSize} />

          {(!pdfProfile.name || !pdfProfile.contact) && (
            <View style={styles.noteBox}>
              <Text style={styles.noteIcon}>ⓘ</Text>
              <Text style={styles.noteText}>
                이름과 연락처는 개인정보 보호를 위해 저장되지 않아요. PDF에 "(직접 입력)" 으로 표시됩니다.
              </Text>
            </View>
          )}
        </SectionCard>

        {/* ── Document checklist ── */}
        <SectionCard title="필요 서류 체크리스트" icon="📄">
          {docs.length === 0 ? (
            <View style={styles.emptyDocs}>
              <Text style={styles.emptyDocsText}>프로그램 정보를 불러오는 중...</Text>
            </View>
          ) : (
            docs.map((doc_, idx) => (
              <React.Fragment key={doc_.name}>
                {idx > 0 && <View style={styles.rowDivider} />}
                <DocItem doc={doc_} onToggle={toggleDoc} />
              </React.Fragment>
            ))
          )}
          <View style={styles.docHint}>
            <Text style={styles.docHintText}>
              항목을 탭하면 준비 상태를 표시할 수 있어요. PDF에 체크 여부가 반영됩니다.
            </Text>
          </View>
        </SectionCard>

        {/* ── Application steps ── */}
        <SectionCard title="신청 절차 가이드" icon="🗺">
          {steps.map((step, idx) => (
            <React.Fragment key={step.step}>
              {idx > 0 && <View style={styles.rowDivider} />}
              <StepItem step={step} />
            </React.Fragment>
          ))}
        </SectionCard>

        {/* ── PDF generation actions ── */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsSectionTitle}>PDF 생성하기</Text>
          <Text style={styles.actionsSectionSubtitle}>
            두 가지 버전으로 생성할 수 있어요. 생성된 PDF는 기기에 저장됩니다.
          </Text>

          <View style={styles.actionsGap} />

          <PdfActionButton
            label="신청서 PDF 생성"
            sublabel="전체 정보 · 서류 체크리스트 · 단계별 가이드 포함"
            icon="📑"
            onPress={handleGenerateFull}
            state={fullPdfState}
            disabled={!pdfProgram}
          />

          <View style={{ height: spacing[3] }} />

          <PdfActionButton
            label="간편 서식 생성"
            sublabel="핵심 항목만 담은 한 장짜리 서식"
            icon="📝"
            onPress={handleGenerateSimple}
            state={simplePdfState}
            disabled={!pdfProgram}
            variant="primary"
          />

          {/* Share / Print row */}
          {hasPdf && (
            <View style={styles.shareRow}>
              <PdfActionButton
                label="공유하기"
                sublabel=""
                icon="↑"
                onPress={handleShare}
                state="idle"
                variant="secondary"
              />
              <View style={{ width: spacing[3] }} />
              <PdfActionButton
                label="인쇄하기"
                sublabel=""
                icon="🖨"
                onPress={handlePrint}
                state="idle"
                variant="secondary"
              />
            </View>
          )}
        </View>

        {/* Error retry note */}
        {(fullPdfState === "error" || simplePdfState === "error") && (
          <View style={styles.errorNote}>
            <Text style={styles.errorNoteText}>
              PDF 생성 중 오류가 발생했어요. 저장 공간을 확인하고 다시 시도해주세요.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed bottom bar: quick generate + share */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : spacing[4] }]}>
        <TouchableOpacity
          style={[styles.bottomShareBtn, !hasPdf && styles.bottomBtnDisabled]}
          onPress={handleShare}
          disabled={!hasPdf}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="공유하기"
        >
          <Text style={[styles.bottomShareText, !hasPdf && styles.bottomBtnTextDisabled]}>
            공유하기
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomGenBtn, !pdfProgram && styles.bottomBtnDisabled]}
          onPress={handleGenerateFull}
          disabled={!pdfProgram || fullPdfState === "generating"}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="신청서 PDF 생성"
        >
          <LinearGradient
            colors={
              fullPdfState === "done"
                ? ["#1d6b44", "#2d9c64"]
                : [colors.primary, colors.primaryContainer]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomGenGradient}
          >
            {fullPdfState === "generating" ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.bottomGenText}>
                {fullPdfState === "done" ? "PDF 재생성" : "신청서 PDF 생성"}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Toast */}
      {toast.visible && (
        <Animated.View style={[toastStyles.wrap, { opacity: toast.anim }]}>
          <View style={toastStyles.pill}>
            <Text style={toastStyles.text}>{toast.msg}</Text>
          </View>
        </Animated.View>
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
    backgroundColor: colors.surfaceContainerLow,
  },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
    backgroundColor: colors.surfaceContainerLow,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
  },

  // Header
  header: {
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  backBtn: {
    minWidth: layout.touchTargetMin,
    minHeight: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backArrow: {
    fontSize: 22,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  headerText: {
    flex: 1,
    gap: spacing[0.5],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
    letterSpacing: typography.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 18,
  },
  headerHint: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerHintText: {
    fontSize: typography.fontSize.sm,
    color: "rgba(255,255,255,0.90)",
    lineHeight: 19,
    textAlign: "center",
  },

  // Scroll
  scroll: { flex: 1 },
  spacer: { height: spacing[4] },

  // Row divider (tonal, no hard border)
  rowDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginLeft: 0,
  },

  // Note box
  noteBox: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "flex-start",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  noteIcon: { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 1, flexShrink: 0 },
  noteText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
  },

  // Empty docs state
  emptyDocs: {
    paddingVertical: spacing[6],
    alignItems: "center",
  },
  emptyDocsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },

  // Doc hint
  docHint: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[2],
    marginBottom: spacing[2],
  },
  docHintText: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
    textAlign: "center",
  },

  // Actions section
  actionsSection: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[5],
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    ...shadows.cardMd,
  },
  actionsSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    letterSpacing: typography.letterSpacing.tight,
  },
  actionsSectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
    lineHeight: 19,
    marginTop: spacing[1],
  },
  actionsGap: { height: spacing[4] },
  shareRow: {
    flexDirection: "row",
    marginTop: spacing[4],
  },

  // Error note
  errorNote: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  errorNoteText: {
    fontSize: typography.fontSize.sm,
    color: colors.onErrorContainer,
    lineHeight: 19,
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "center",
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
  bottomShareBtn: {
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
  bottomShareText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  bottomGenBtn: {
    flex: 2,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
  },
  bottomGenGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    minHeight: layout.buttonHeightMd,
  },
  bottomGenText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  bottomBtnDisabled: { opacity: 0.45 },
  bottomBtnTextDisabled: { color: colors.textMuted },
});

const toastStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  } as any,
  pill: {
    backgroundColor: colors.inverseSurface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    ...shadows.floating,
  },
  text: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.inverseOnSurface,
  },
});
