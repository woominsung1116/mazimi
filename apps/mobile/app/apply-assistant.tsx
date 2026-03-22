/**
 * Apply Assistant Screen — /apply-assistant?programId=xxx
 *
 * "정책계의 삼쩜삼" — A 5-step guided application wizard that walks the user
 * through the entire process from eligibility check to submission.
 *
 * Flow:
 *   Step 1: 자격 확인   — eligibility checklist + application probability %
 *   Step 2: 서류 확인   — required documents checklist with issuance tips
 *   Step 3: 정보 확인   — personal info preview + per-field editing
 *   Step 4: 신청 실행   — WebView with JS auto-fill injection
 *   Step 5: 완료        — celebration + status update to "applying"
 *
 * Navigation: router.push('/apply-assistant?programId=xxx')
 * Entry:      programs/[id].tsx 하단 "바로 신청하기" 버튼
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type ApiProgram, type ApplicationStatus } from "@/lib/api";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
import {
  borderRadius,
  colors,
  gradients,
  layout,
  shadows,
  spacing,
  typography,
} from "@/constants/theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 5;

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

// ---------------------------------------------------------------------------
// Profile helpers (mirror auto-fill.tsx logic)
// ---------------------------------------------------------------------------

interface MergedProfile {
  name: string;
  birthYear: string;
  region: string;
  contact: string;
  schoolName: string;
  schoolYear: string;
  enrollmentStatus: string;
  incomeBracket: string;
  householdSize: string;
}

function buildProfile(
  local: ReturnType<typeof useOnboardingStore.getState>,
  server: any | null
): MergedProfile {
  const birthYear = server?.birth_year
    ? `${server.birth_year}년`
    : local.age
    ? `${getBirthYear(local.age)}년`
    : "";

  const rawRegion = server?.region_code ?? local.region ?? "";
  const region = rawRegion ? (REGION_LABELS[rawRegion] ?? rawRegion) : "";

  const rawSchool = server?.school_name ?? local.schoolName ?? "";

  const rawSchoolYear = server?.school_year;
  const schoolYear = rawSchoolYear ? `${rawSchoolYear}학년` : "";

  const rawEnrollment = server?.enrollment_status ?? local.enrollmentStatus ?? "";
  const enrollmentStatus = rawEnrollment
    ? (ENROLLMENT_LABELS[rawEnrollment] ?? rawEnrollment)
    : "";

  const rawIncome = server?.income_bracket ?? local.incomeBracket ?? null;
  const incomeBracket =
    rawIncome !== null ? (INCOME_LABELS[rawIncome] ?? `${rawIncome}구간`) : "";

  const rawHousehold = server?.household_size ?? null;
  const householdSize = rawHousehold ? `${rawHousehold}인 가구` : "";

  return {
    name: "",
    birthYear,
    region,
    contact: "",
    schoolName: rawSchool,
    schoolYear,
    enrollmentStatus,
    incomeBracket,
    householdSize,
  };
}

// ---------------------------------------------------------------------------
// Eligibility condition builder
// ---------------------------------------------------------------------------

interface ConditionItem {
  label: string;
  sublabel?: string;
  status: "ok" | "warn" | "unknown";
}

function buildConditions(program: ApiProgram): ConditionItem[] {
  const items: ConditionItem[] = [];

  const regions: string[] = Array.isArray((program as any).regions)
    ? (program as any).regions
    : [];
  const regionScope = (program as any).region_scope ?? "national";
  const regionDisplay =
    regions.length > 0
      ? regions.map((r) => REGION_LABELS[r] ?? r).join(" · ")
      : (REGION_LABELS[regionScope] ?? "전국");

  items.push({ label: `${regionDisplay} 거주`, status: "ok" });

  if (program.min_age !== null || program.max_age !== null) {
    const min = program.min_age ?? 19;
    const max = program.max_age ?? 39;
    items.push({ label: `만 ${min}세 ~ ${max}세`, sublabel: "연령 조건", status: "ok" });
  }

  if (
    program.program_type === "scholarship" ||
    program.program_type === "welfare"
  ) {
    items.push({ label: "대학 재학 중", sublabel: "학적 조건", status: "ok" });
  }

  items.push({
    label: "소득 구간",
    sublabel: "입력 시 정확한 확인 가능",
    status: "warn",
  });

  return items;
}

/** Maps condition array to a rough probability percentage. */
function calcProbability(conditions: ConditionItem[]): number {
  const okCount = conditions.filter((c) => c.status === "ok").length;
  const warnCount = conditions.filter((c) => c.status === "warn").length;
  const total = conditions.length;
  if (total === 0) return 70;
  const base = Math.round((okCount / total) * 100);
  const warnPenalty = warnCount * 5;
  return Math.max(50, Math.min(98, base - warnPenalty));
}

// ---------------------------------------------------------------------------
// Document definitions
// ---------------------------------------------------------------------------

interface DocumentItem {
  id: string;
  name: string;
  required: boolean;
  issuer: string;
  daysNeeded: number;
  issueUrl?: string;
}

const DEFAULT_DOCS: DocumentItem[] = [
  {
    id: "doc_1",
    name: "주민등록등본",
    required: true,
    issuer: "정부24 또는 주민센터",
    daysNeeded: 1,
    issueUrl: "https://www.gov.kr",
  },
  {
    id: "doc_2",
    name: "소득증명원",
    required: true,
    issuer: "국세청 홈택스",
    daysNeeded: 1,
    issueUrl: "https://www.hometax.go.kr",
  },
  {
    id: "doc_3",
    name: "재학(휴학)증명서",
    required: false,
    issuer: "학교 포털 또는 학생처",
    daysNeeded: 3,
  },
  {
    id: "doc_4",
    name: "건강보험료 납부확인서",
    required: false,
    issuer: "국민건강보험공단",
    daysNeeded: 1,
    issueUrl: "https://www.nhis.or.kr",
  },
];

// ---------------------------------------------------------------------------
// WebView JS injection (reused from auto-fill.tsx)
// ---------------------------------------------------------------------------

function buildFillScript(profile: MergedProfile): string {
  const data = {
    name: profile.name,
    birth: profile.birthYear,
    phone: profile.contact,
    address: profile.region,
  };
  return `
(function() {
  var data = ${JSON.stringify(data)};
  var fields = {
    name: ['#name','#userName','#user_name','input[name="name"]','input[name="userName"]','input[name="user_name"]'],
    birth: ['#birth','#birthDay','#birth_day','input[name="birth"]','input[name="birthDay"]','input[name="birth_day"]'],
    phone: ['#phone','#tel','#mobile','input[name="phone"]','input[name="tel"]','input[name="mobile"]'],
    addr: ['#addr','#address','#addr1','input[name="addr"]','input[name="address"]','input[name="addr1"]'],
  };
  var filled = [], missed = [];
  function fillField(key, selectors, value) {
    if (!value) { missed.push(key); return; }
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled.push(key);
        return;
      }
    }
    missed.push(key);
  }
  fillField('name', fields.name, data.name);
  fillField('birth', fields.birth, data.birth);
  fillField('phone', fields.phone, data.phone);
  fillField('addr', fields.addr, data.address);
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
    JSON.stringify({ type: 'FILL_RESULT', filled: filled, missed: missed })
  );
})();
true;
`;
}

// ---------------------------------------------------------------------------
// Toast hook
// ---------------------------------------------------------------------------

function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(message);
      setVisible(true);
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    },
    [fade]
  );

  return { visible, msg, fade, show };
}

// ---------------------------------------------------------------------------
// Step progress bar
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  current: number; // 1-based
  total: number;
}

function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = ((current - 1) / (total - 1)) * 100;

  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.track}>
        <View style={[progressStyles.fill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={progressStyles.label}>
        {current} / {total}
      </Text>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
    minWidth: 32,
    textAlign: "right",
  },
});

// ---------------------------------------------------------------------------
// Step 1 — 자격 확인
// ---------------------------------------------------------------------------

interface Step1Props {
  program: ApiProgram;
  onNext: () => void;
  onNextForced: () => void;
}

function Step1({ program, onNext, onNextForced }: Step1Props) {
  const conditions = buildConditions(program);
  const probability = calcProbability(conditions);
  const hasIssues = conditions.some((c) => c.status !== "ok");

  const probColor =
    probability >= 85 ? "#16a34a" : probability >= 65 ? "#d97706" : "#e11d48";

  return (
    <ScrollView
      style={stepStyles.scroll}
      contentContainerStyle={stepStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Program summary card */}
      <View style={stepStyles.summaryCard}>
        {program.provider_name ? (
          <Text style={stepStyles.summaryProvider}>{program.provider_name}</Text>
        ) : null}
        <Text style={stepStyles.summaryTitle} numberOfLines={3}>
          {program.title}
        </Text>
      </View>

      {/* Probability display */}
      <View style={stepStyles.probWrap}>
        <Text style={[stepStyles.probNumber, { color: probColor }]}>
          {probability}%
        </Text>
        <Text style={stepStyles.probLabel}>신청 가능성</Text>
        <View style={[stepStyles.probBadge, { backgroundColor: probColor + "18" }]}>
          <Text style={[stepStyles.probBadgeText, { color: probColor }]}>
            {probability >= 85
              ? "높은 가능성"
              : probability >= 65
              ? "보통 가능성"
              : "낮은 가능성"}
          </Text>
        </View>
      </View>

      {/* Conditions checklist */}
      <View style={stepStyles.sectionCard}>
        <Text style={stepStyles.sectionTitle}>자격 조건 확인</Text>
        {conditions.map((c, i) => (
          <View key={i} style={stepStyles.conditionRow}>
            <Ionicons
              name={
                c.status === "ok"
                  ? "checkmark-circle"
                  : c.status === "warn"
                  ? "warning"
                  : "help-circle"
              }
              size={18}
              color={
                c.status === "ok"
                  ? "#16a34a"
                  : c.status === "warn"
                  ? "#d97706"
                  : colors.onSurfaceVariant
              }
            />
            <View style={stepStyles.conditionText}>
              <Text style={stepStyles.conditionLabel}>{c.label}</Text>
              {c.sublabel ? (
                <Text style={stepStyles.conditionSublabel}>{c.sublabel}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — 서류 확인
// ---------------------------------------------------------------------------

interface Step2Props {
  docs: DocumentItem[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNext: () => void;
}

function Step2({ docs, checked, onToggle }: Step2Props) {
  const readyCount = docs.filter((d) => checked[d.id]).length;

  return (
    <ScrollView
      style={stepStyles.scroll}
      contentContainerStyle={stepStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Progress summary */}
      <View style={stepStyles.docSummaryRow}>
        <View style={stepStyles.docSummaryPill}>
          <Ionicons name="documents-outline" size={16} color={colors.primary} />
          <Text style={stepStyles.docSummaryText}>
            {readyCount}개 준비 완료 / {docs.length}개
          </Text>
        </View>
        {readyCount === docs.length && (
          <View style={stepStyles.docAllReadyBadge}>
            <Text style={stepStyles.docAllReadyText}>모두 준비됨</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={stepStyles.docProgressTrack}>
        <View
          style={[
            stepStyles.docProgressFill,
            {
              width: `${Math.round((readyCount / docs.length) * 100)}%` as any,
              backgroundColor:
                readyCount === docs.length
                  ? "#16a34a"
                  : readyCount > 0
                  ? "#d97706"
                  : colors.primary,
            },
          ]}
        />
      </View>

      {/* Document rows */}
      <View style={stepStyles.sectionCard}>
        <Text style={stepStyles.sectionTitle}>필요 서류</Text>
        {docs.map((doc) => {
          const isChecked = !!checked[doc.id];
          return (
            <View key={doc.id} style={stepStyles.docCard}>
              <TouchableOpacity
                style={stepStyles.docRow}
                onPress={() => onToggle(doc.id)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
                accessibilityLabel={doc.name}
              >
                <View style={[stepStyles.checkbox, isChecked && stepStyles.checkboxChecked]}>
                  {isChecked && (
                    <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                  )}
                </View>
                <View style={stepStyles.docInfo}>
                  <View style={stepStyles.docTitleRow}>
                    <Text style={[stepStyles.docName, isChecked && stepStyles.docNameChecked]}>
                      {doc.name}
                    </Text>
                    <View
                      style={[
                        stepStyles.docBadge,
                        doc.required ? stepStyles.docBadgeRequired : stepStyles.docBadgeOptional,
                      ]}
                    >
                      <Text
                        style={[
                          stepStyles.docBadgeText,
                          doc.required
                            ? stepStyles.docBadgeTextRequired
                            : stepStyles.docBadgeTextOptional,
                        ]}
                      >
                        {doc.required ? "필수" : "선택"}
                      </Text>
                    </View>
                  </View>
                  <Text style={stepStyles.docIssuer}>
                    {doc.issuer} · 약 {doc.daysNeeded}일 소요
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Issue link for unprepared docs */}
              {!isChecked && doc.issueUrl ? (
                <View style={stepStyles.docIssueRow}>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={stepStyles.docIssueLink}>지금 발급하기</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={stepStyles.infoNote}>
        <Ionicons name="information-circle-outline" size={15} color={colors.onSurfaceVariant} />
        <Text style={stepStyles.infoNoteText}>
          서류를 보관함에 저장해두면 다음 신청 때 바로 불러올 수 있어요.
        </Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — 정보 확인
// ---------------------------------------------------------------------------

interface Step3Props {
  profile: MergedProfile;
  onProfileChange: (field: keyof MergedProfile, value: string) => void;
}

function Step3({ profile, onProfileChange }: Step3Props) {
  const fields: Array<{ key: keyof MergedProfile; label: string; placeholder: string }> = [
    { key: "name", label: "이름", placeholder: "홍길동" },
    { key: "birthYear", label: "생년월일", placeholder: "2000년" },
    { key: "contact", label: "연락처", placeholder: "010-0000-0000" },
    { key: "region", label: "주소 (지역)", placeholder: "서울특별시" },
    { key: "schoolName", label: "학교명", placeholder: "한국대학교" },
    { key: "schoolYear", label: "학년", placeholder: "3학년" },
    { key: "enrollmentStatus", label: "학적 상태", placeholder: "재학" },
    { key: "incomeBracket", label: "소득 구간", placeholder: "3구간" },
    { key: "householdSize", label: "가구원 수", placeholder: "3인 가구" },
  ];

  return (
    <ScrollView
      style={stepStyles.scroll}
      contentContainerStyle={stepStyles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={stepStyles.infoNote}>
        <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
        <Text style={[stepStyles.infoNoteText, { color: colors.primary }]}>
          이름과 연락처는 개인정보 보호를 위해 저장하지 않아요. 직접 입력해주세요.
        </Text>
      </View>

      <View style={stepStyles.sectionCard}>
        <Text style={stepStyles.sectionTitle}>신청 정보 확인 및 수정</Text>
        {fields.map((field, idx) => (
          <View key={field.key}>
            {idx > 0 && <View style={stepStyles.fieldDivider} />}
            <View style={stepStyles.fieldRow}>
              <Text style={stepStyles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={stepStyles.fieldInput}
                value={profile[field.key]}
                onChangeText={(v) => onProfileChange(field.key, v)}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        ))}
      </View>

      <Text style={stepStyles.step3Hint}>
        정보가 자동 입력에 사용됩니다. 틀린 정보가 있으면 지금 수정해주세요.
      </Text>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — 신청 실행 (WebView)
// ---------------------------------------------------------------------------

interface Step4Props {
  url: string | undefined;
  profile: MergedProfile;
  insetTop: number;
  insetBottom: number;
  onFillDone: () => void;
  showToast: (msg: string) => void;
}

function Step4({ url, profile, insetTop, insetBottom, onFillDone, showToast }: Step4Props) {
  const webViewRef = useRef<WebView>(null);
  const [webLoading, setWebLoading] = useState(true);
  const [filled, setFilled] = useState(false);

  const handleAutoFill = useCallback(() => {
    if (!webViewRef.current) return;
    webViewRef.current.injectJavaScript(buildFillScript(profile));
    showToast("자동 입력을 시도했어요. 확인해주세요.");
    setFilled(true);
  }, [profile, showToast]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "FILL_RESULT" && data.missed?.length > 0) {
          showToast("일부 항목은 직접 입력이 필요해요");
        }
      } catch {
        // ignore
      }
    },
    [showToast]
  );

  if (!url) {
    return (
      <View style={step4Styles.noUrl}>
        <Ionicons name="link-outline" size={40} color={colors.onSurfaceVariant} />
        <Text style={step4Styles.noUrlTitle}>신청 URL이 없어요</Text>
        <Text style={step4Styles.noUrlDesc}>
          이 프로그램의 공식 신청 링크가 등록되지 않았습니다.{"\n"}
          담당 기관에 직접 문의하세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={step4Styles.root}>
      {/* Status bar spacer */}
      <View style={{ height: insetTop, backgroundColor: colors.primary }} />

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={step4Styles.webView}
        onLoadStart={() => setWebLoading(true)}
        onLoadEnd={() => setWebLoading(false)}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      />

      {/* Loading strip */}
      {webLoading && (
        <View style={step4Styles.loadingStrip}>
          <View style={step4Styles.loadingBar} />
        </View>
      )}

      {/* Floating toolbar */}
      <View style={[step4Styles.toolbar, { paddingBottom: insetBottom > 0 ? insetBottom : spacing[3] }]}>
        <TouchableOpacity
          style={step4Styles.fillBtn}
          onPress={handleAutoFill}
          activeOpacity={0.85}
          disabled={webLoading}
          accessibilityRole="button"
          accessibilityLabel="자동 입력"
        >
          <LinearGradient
            colors={
              webLoading
                ? [colors.surfaceContainerHigh, colors.surfaceContainerHigh]
                : [colors.primary, colors.primaryContainer]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={step4Styles.fillBtnGradient}
          >
            <Ionicons
              name="flash"
              size={16}
              color={webLoading ? colors.onSurfaceVariant : colors.onPrimary}
            />
            <Text
              style={[
                step4Styles.fillBtnText,
                webLoading && step4Styles.fillBtnTextDisabled,
              ]}
            >
              자동 입력
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {filled && (
          <View style={step4Styles.filledHint}>
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text style={step4Styles.filledHintText}>
              자동 입력 완료! 내용을 확인하고 제출 버튼을 눌러주세요
            </Text>
          </View>
        )}

        {filled && (
          <TouchableOpacity
            style={step4Styles.doneBtn}
            onPress={onFillDone}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="신청 완료로 이동"
          >
            <Text style={step4Styles.doneBtnText}>신청 완료</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const step4Styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  webView: {
    flex: 1,
  },
  loadingStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primaryFixed,
    overflow: "hidden",
  },
  loadingBar: {
    height: 3,
    width: "60%",
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  toolbar: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[2],
    ...Platform.select({
      ios: {
        shadowColor: colors.secondaryFixedDim,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 10, shadowColor: colors.secondaryFixedDim },
    }),
  },
  fillBtn: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
  },
  fillBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    minHeight: layout.buttonHeightMd,
  },
  fillBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  fillBtnTextDisabled: {
    color: colors.onSurfaceVariant,
  },
  filledHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    backgroundColor: "#f0fdf4",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  filledHintText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: "#16a34a",
    lineHeight: 17,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    minHeight: layout.buttonHeightSm,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    ...shadows.primaryButton,
  },
  doneBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  noUrl: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
    padding: spacing[8],
  },
  noUrlTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  noUrlDesc: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },
});

// ---------------------------------------------------------------------------
// Step 5 — 완료
// ---------------------------------------------------------------------------

interface Step5Props {
  programTitle: string;
  onGoHome: () => void;
}

function Step5({ programTitle, onGoHome }: Step5Props) {
  // Simple pulse animation for the checkmark circle
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={step5Styles.root}>
      {/* Animated checkmark */}
      <Animated.View style={[step5Styles.iconCircle, { transform: [{ scale: pulse }] }]}>
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={step5Styles.iconGradient}
        >
          <Ionicons name="checkmark" size={48} color={colors.onPrimary} />
        </LinearGradient>
      </Animated.View>

      <Text style={step5Styles.title}>신청을 완료했어요!</Text>
      <Text style={step5Styles.programTitle} numberOfLines={2}>
        {programTitle}
      </Text>
      <Text style={step5Styles.desc}>
        신청 상태가 "신청중"으로 업데이트되었습니다.{"\n"}
        결과가 나오면 알림으로 알려드릴게요.
      </Text>

      {/* Status tracking start indicator */}
      <View style={step5Styles.trackingCard}>
        <Ionicons name="radio-outline" size={18} color={colors.primary} />
        <Text style={step5Styles.trackingText}>
          신청 상태 추적을 시작합니다
        </Text>
        <View style={step5Styles.trackingDot} />
      </View>

      <TouchableOpacity
        style={step5Styles.homeBtn}
        onPress={onGoHome}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="홈으로 이동"
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={step5Styles.homeBtnGradient}
        >
          <Text style={step5Styles.homeBtnText}>홈으로</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const step5Styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[5],
    paddingHorizontal: spacing[8],
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: borderRadius.full,
    overflow: "hidden",
    ...shadows.cardLg,
  },
  iconGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    textAlign: "center",
    letterSpacing: typography.letterSpacing.tight,
  },
  programTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    textAlign: "center",
    lineHeight: 22,
  },
  desc: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },
  trackingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    alignSelf: "stretch",
  },
  trackingText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: "#16a34a",
  },
  homeBtn: {
    alignSelf: "stretch",
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
    marginTop: spacing[2],
  },
  homeBtnGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    minHeight: layout.buttonHeightMd,
  },
  homeBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
});

// ---------------------------------------------------------------------------
// Shared step styles
// ---------------------------------------------------------------------------

const stepStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[5],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },

  // Program summary card (Step 1)
  summaryCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    gap: spacing[1],
    ...shadows.card,
  },
  summaryProvider: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  summaryTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    lineHeight: 24,
    letterSpacing: typography.letterSpacing.tight,
  },

  // Probability display
  probWrap: {
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[4],
  },
  probNumber: {
    fontSize: typography.fontSize["5xl"],
    fontWeight: typography.fontWeight.black,
    letterSpacing: -2,
    lineHeight: 56,
  },
  probLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  probBadge: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
  },
  probBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Section card wrapper
  sectionCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    gap: spacing[3],
    ...shadows.card,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    marginBottom: spacing[1],
  },

  // Condition row (Step 1)
  conditionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
    paddingVertical: spacing[1],
  },
  conditionText: {
    flex: 1,
    gap: spacing[0.5],
  },
  conditionLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
  },
  conditionSublabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
  },

  // Document summary (Step 2)
  docSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  docSummaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  docSummaryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  docAllReadyBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  docAllReadyText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: "#16a34a",
  },
  docProgressTrack: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: "hidden",
  },
  docProgressFill: {
    height: "100%",
    borderRadius: borderRadius.full,
  },

  // Document card (Step 2)
  docCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    padding: spacing[4],
    minHeight: layout.touchTargetMin,
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
  docInfo: {
    flex: 1,
    gap: spacing[1],
  },
  docTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  docName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  docNameChecked: {
    color: "#16a34a",
  },
  docBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  docBadgeRequired: {
    backgroundColor: colors.primaryFixed,
  },
  docBadgeOptional: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  docBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  docBadgeTextRequired: {
    color: colors.onPrimaryFixedVariant,
  },
  docBadgeTextOptional: {
    color: colors.onSurfaceVariant,
  },
  docIssuer: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  docIssueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  docIssueLink: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },

  // Info note row
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  infoNoteText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    lineHeight: 17,
  },

  // Field rows (Step 3)
  fieldDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  fieldLabel: {
    width: 72,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    minHeight: 36,
  },
  step3Hint: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: spacing[2],
  },
});

// ---------------------------------------------------------------------------
// Step title config
// ---------------------------------------------------------------------------

const STEP_META: Array<{ title: string; subtitle: string; icon: string }> = [
  {
    title: "자격 확인",
    subtitle: "신청 가능성을 확인해요",
    icon: "shield-checkmark-outline",
  },
  {
    title: "서류 확인",
    subtitle: "필요 서류를 체크해요",
    icon: "documents-outline",
  },
  {
    title: "정보 확인",
    subtitle: "신청 정보를 점검해요",
    icon: "person-outline",
  },
  {
    title: "신청 실행",
    subtitle: "신청 사이트에서 제출해요",
    icon: "globe-outline",
  },
  {
    title: "완료",
    subtitle: "신청을 마쳤어요",
    icon: "checkmark-circle-outline",
  },
];

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ApplyAssistantScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { visible: toastVisible, msg: toastMsg, fade: toastFade, show: showToast } = useToast();

  const [step, setStep] = useState(1);
  const [docChecked, setDocChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DEFAULT_DOCS.map((d) => [d.id, false]))
  );

  // Onboarding store + server profile
  const localStore = useOnboardingStore();

  const { data: profileResponse } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.getProfile(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  const [editableProfile, setEditableProfile] = useState<MergedProfile | null>(null);

  // Build the merged profile once server data arrives
  const serverProfile = profileResponse?.profile ?? null;
  const baseProfile = buildProfile(localStore, serverProfile);

  // editableProfile is initialized from baseProfile on first render
  const profile: MergedProfile = editableProfile ?? baseProfile;

  // Sync editableProfile when base changes (server load)
  useEffect(() => {
    if (!editableProfile) {
      setEditableProfile(baseProfile);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverProfile]);

  function handleProfileChange(field: keyof MergedProfile, value: string) {
    setEditableProfile((prev) => ({
      ...(prev ?? baseProfile),
      [field]: value,
    }));
  }

  // Program data
  const { data: program, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => api.getProgram(programId!),
    enabled: !!programId,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Status mutation — update to "applying" on Step 5
  const { mutate: updateStatus } = useMutation({
    mutationFn: (status: ApplicationStatus) =>
      api.updateApplicationStatus(programId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["applicationStatus", programId],
      });
    },
  });

  // Step 4 → Step 5: mark as "applying"
  function handleFillDone() {
    updateStatus("applying");
    setStep(5);
  }

  function handleNext() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  }

  function handleHome() {
    // Cast needed: Expo Router's typed replace doesn't accept the tab group path directly
    router.replace("/(tabs)" as any);
  }

  const conditions = program ? buildConditions(program) : [];
  const hasEligibilityIssues = conditions.some((c) => c.status !== "ok");
  const docReadyCount = DEFAULT_DOCS.filter((d) => docChecked[d.id]).length;

  // Whether the "다음" button is the primary action for current step
  const isStep4 = step === 4;
  const isStep5 = step === 5;

  const meta = STEP_META[step - 1];

  const bottomPad = insets.bottom > 0 ? insets.bottom : spacing[4];
  const headerTopPad = insets.top > 0 ? insets.top : spacing[8];

  // Step 4 fills the full screen with the WebView — different layout
  if (isStep4) {
    return (
      <View style={styles.root}>
        {/* Compact header for WebView step */}
        <View style={[styles.webViewHeader, { paddingTop: headerTopPad }]}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="이전 단계"
          >
            <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.webViewHeaderCenter}>
            <Text style={styles.webViewHeaderTitle}>{meta.title}</Text>
            <ProgressBar current={step} total={TOTAL_STEPS} />
          </View>
        </View>

        <Step4
          url={program?.official_url ?? undefined}
          profile={profile}
          insetTop={0}
          insetBottom={insets.bottom}
          onFillDone={handleFillDone}
          showToast={showToast}
        />

        {/* Toast */}
        {toastVisible && (
          <Animated.View style={[toastStyles.wrap, { opacity: toastFade }]}>
            <View style={toastStyles.pill}>
              <Text style={toastStyles.text}>{toastMsg}</Text>
            </View>
          </Animated.View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Gradient header ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: headerTopPad }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={step === 1 ? "뒤로 가기" : "이전 단계"}
          >
            <Ionicons name="arrow-back" size={20} color={colors.onPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerIconRow}>
              <Ionicons name={meta.icon as any} size={18} color="rgba(255,255,255,0.85)" />
              <Text style={styles.headerSubtitle}>{meta.subtitle}</Text>
            </View>
            <Text style={styles.headerTitle}>{meta.title}</Text>
          </View>

          {/* Spacer to balance back button */}
          <View style={styles.headerBackBtn} />
        </View>

        <ProgressBar current={step} total={TOTAL_STEPS} />
      </LinearGradient>

      {/* ── Step content ── */}
      {isStep5 ? (
        <Step5
          programTitle={program?.title ?? ""}
          onGoHome={handleHome}
        />
      ) : isLoading ? (
        <View style={styles.loadingCenter}>
          <Ionicons name="hourglass-outline" size={32} color={colors.primary} />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      ) : (
        <>
          {step === 1 && program && (
            <Step1
              program={program}
              onNext={handleNext}
              onNextForced={handleNext}
            />
          )}
          {step === 2 && (
            <Step2
              docs={DEFAULT_DOCS}
              checked={docChecked}
              onToggle={(id) =>
                setDocChecked((prev) => ({ ...prev, [id]: !prev[id] }))
              }
              onNext={handleNext}
            />
          )}
          {step === 3 && (
            <Step3
              profile={profile}
              onProfileChange={handleProfileChange}
            />
          )}
        </>
      )}

      {/* ── Fixed bottom navigation bar (steps 1-3) ── */}
      {!isStep5 && (
        <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
          {/* Step-specific context hint */}
          {step === 1 && hasEligibilityIssues && (
            <TouchableOpacity
              style={styles.forceNextBtn}
              onPress={handleNext}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="부족한 조건이 있어도 계속 진행"
            >
              <Text style={styles.forceNextText}>
                부족한 조건이 있어도 계속 진행할게요
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
          {step === 2 && (
            <View style={styles.docHintRow}>
              <Text style={styles.docHintText}>
                {docReadyCount === DEFAULT_DOCS.length
                  ? "모든 서류가 준비되었어요"
                  : `${docReadyCount}/${DEFAULT_DOCS.length}개 준비 완료 · 미준비 서류도 계속 진행 가능해요`}
              </Text>
            </View>
          )}

          {/* Primary action button */}
          <View style={styles.bottomBtnRow}>
            {step > 1 && (
              <TouchableOpacity
                style={styles.prevBtn}
                onPress={handleBack}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="이전 단계"
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.prevBtnText}>이전</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.nextBtnWrap}
              onPress={handleNext}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={step < TOTAL_STEPS - 1 ? "다음 단계" : "신청 실행"}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtnGradient}
              >
                <Text style={styles.nextBtnText}>
                  {step === 3 ? "신청 실행하기" : "다음"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Toast ── */}
      {toastVisible && (
        <Animated.View style={[toastStyles.wrap, { opacity: toastFade }]}>
          <View style={toastStyles.pill}>
            <Text style={toastStyles.text}>{toastMsg}</Text>
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

  // Gradient header
  header: {
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[5],
    gap: spacing[2],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: spacing[1],
  },
  headerBackBtn: {
    minWidth: layout.touchTargetMin,
    minHeight: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: spacing[0.5],
  },
  headerIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
    letterSpacing: typography.letterSpacing.tight,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: "rgba(255,255,255,0.80)",
  },

  // WebView step header (flat, not gradient)
  webViewHeader: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
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
  webViewHeaderCenter: {
    flex: 1,
  },
  webViewHeaderTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    paddingHorizontal: spacing[5],
    textAlign: "center",
    marginBottom: spacing[1],
  },

  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3],
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
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
  forceNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1],
    paddingVertical: spacing[2],
  },
  forceNextText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  docHintRow: {
    alignItems: "center",
  },
  docHintText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  bottomBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  prevBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[1.5],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minHeight: layout.buttonHeightMd,
    backgroundColor: colors.surfaceContainerLowest,
  },
  prevBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  nextBtnWrap: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
  },
  nextBtnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[4],
    minHeight: layout.buttonHeightMd,
  },
  nextBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
});

const toastStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 110,
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
