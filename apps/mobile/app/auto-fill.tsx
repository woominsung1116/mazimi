/**
 * Auto-Fill Screen — /auto-fill?programId=xxx
 *
 * Helps users fill out government application forms by:
 * 1. Displaying profile data with per-field copy buttons
 * 2. One-touch category copy cards (기본 인적사항, 학적 정보, 소득 정보)
 * 3. Two modes for the official site:
 *    a) External browser (expo-web-browser) — legacy fallback
 *    b) In-app WebView with floating toolbar for JS auto-injection
 *
 * WebView mode toolbar:
 *  - "자동 입력"  — injects profile data into common government form fields
 *  - "이름 복사"  — quick copy of name
 *  - "주소 복사"  — quick copy of address/region
 *  - "완료"       — closes the WebView and returns to this screen
 *
 * Profile data comes from:
 *  - useOnboardingStore (local onboarding state)
 *  - api.getProfile (server-side saved profile) — merged, server wins
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, type UserProfile } from "@/lib/api";
import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
import { generateEncryptionKey, decryptFile } from "@/lib/crypto";
import { useAuthStore } from "@/store/auth";
import { useVaultDocuments, type StoredDocument } from "@/lib/vault";
import * as FileSystem from "expo-file-system/legacy";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  gradients,
} from "@/constants/theme";

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

interface ToastState {
  visible: boolean;
  message: string;
}

function useToast() {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "" });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ visible: true, message });
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        setToast({ visible: false, message: "" });
      });
    },
    [fadeAnim]
  );

  return { toast, fadeAnim, show };
}

// ---------------------------------------------------------------------------
// Profile merger — onboarding store (local) + server profile
// ---------------------------------------------------------------------------

interface MergedProfile {
  name: string | null;
  birthYear: string | null;      // e.g. "2000년"
  region: string | null;
  contact: string | null;        // not stored in either source — placeholder
  schoolName: string | null;
  schoolYear: string | null;
  enrollmentStatus: string | null;
  incomeBracket: string | null;
  householdSize: string | null;
}

/**
 * Flat data object passed to the WebView injection script.
 * Only fields that government form selectors commonly target are included.
 */
interface InjectableProfile {
  name: string;
  birth: string;
  phone: string;
  address: string;
}

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
// 서류 보관함 연동
// ---------------------------------------------------------------------------

// StoredDocument, useVaultDocuments는 @/lib/vault에서 임포트

// 프로그램 제목/타입과 관련성 있는 보관함 서류만 필터링 (간단 키워드 매칭)
function getRelevantVaultDocs(
  vaultDocs: StoredDocument[],
  programTitle: string
): StoredDocument[] {
  if (vaultDocs.length === 0) return [];
  // 프로그램 제목에서 유의미한 키워드 추출
  const titleKeywords = ["장학", "지원", "청년", "취업", "주거", "임대", "소득", "복지", "의료", "교육"];
  const matchesProgram = titleKeywords.some((kw) => programTitle.includes(kw));
  // 관련 프로그램이면 전체 서류 반환, 아니면 기본 서류만
  if (matchesProgram) return vaultDocs;
  return vaultDocs.filter((d) =>
    ["resident_register", "income_proof", "enrollment_cert", "health_insurance", "family_relation"].includes(d.type)
  );
}

interface VaultSectionProps {
  programTitle: string;
  onNavigateVault: () => void;
}

function VaultSection({ programTitle, onNavigateVault }: VaultSectionProps) {
  const vaultDocs = useVaultDocuments();
  const relevantDocs = getRelevantVaultDocs(vaultDocs, programTitle);
  const { user } = useAuthStore();

  async function handleShare(doc: StoredDocument) {
    if (!doc.fileUri) {
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return;

    let shareUri = doc.fileUri;
    let tempUri: string | null = null;

    if (doc.encrypted && user?.id) {
      // 공유 전에 복호화하여 임시 파일 생성
      const key = await generateEncryptionKey(user.id);
      tempUri = await decryptFile(doc.fileUri, key);
      shareUri = tempUri;
    }

    try {
      await Sharing.shareAsync(shareUri, {
        mimeType: doc.mimeType ?? "application/octet-stream",
        dialogTitle: doc.name,
      });
    } finally {
      // 공유 완료 후 임시 복호화 파일 삭제
      if (tempUri) {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      }
    }
  }

  if (vaultDocs.length === 0) return null;

  return (
    <View style={vaultStyles.section}>
      <View style={vaultStyles.headerRow}>
        <View style={vaultStyles.headerLeft}>
          <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
          <Text style={vaultStyles.headerTitle}>서류 보관함</Text>
        </View>
        <TouchableOpacity
          onPress={onNavigateVault}
          accessibilityRole="button"
          accessibilityLabel="서류 보관함 전체 보기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={vaultStyles.headerLink}>전체 보기 →</Text>
        </TouchableOpacity>
      </View>

      {relevantDocs.length === 0 ? (
        <View style={vaultStyles.emptyRow}>
          <Text style={vaultStyles.emptyText}>
            이 프로그램과 관련된 서류가 보관함에 없어요.
          </Text>
        </View>
      ) : (
        <View style={vaultStyles.docList}>
          {relevantDocs.map((doc) => (
            <View key={doc.id} style={vaultStyles.docRow}>
              <View style={vaultStyles.docIcon}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              </View>
              <View style={vaultStyles.docInfo}>
                <Text style={vaultStyles.docName} numberOfLines={1}>{doc.name}</Text>
                <Text style={vaultStyles.docMeta}>
                  발급일 {doc.issuedAt.slice(0, 10)}
                  {doc.expiresAt ? ` · 만료 ${doc.expiresAt.slice(0, 10)}` : ""}
                </Text>
              </View>
              {doc.fileUri ? (
                <TouchableOpacity
                  style={vaultStyles.shareBtn}
                  onPress={() => handleShare(doc)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${doc.name} 공유`}
                >
                  <Ionicons name="share-outline" size={15} color={colors.primary} />
                  <Text style={vaultStyles.shareBtnText}>공유</Text>
                </TouchableOpacity>
              ) : (
                <View style={vaultStyles.noFileTag}>
                  <Text style={vaultStyles.noFileTagText}>메타만</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const vaultStyles = StyleSheet.create({
  section: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.card,
  } as any,
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  headerLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  emptyRow: {
    paddingVertical: spacing[2],
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurfaceVariant,
  },
  docList: {
    gap: spacing[2],
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  docInfo: {
    flex: 1,
    gap: 2,
  },
  docName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
  },
  docMeta: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
  },
  shareBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  noFileTag: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  noFileTagText: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
  },
});

// ---------------------------------------------------------------------------

function mergeProfile(
  local: ReturnType<typeof useOnboardingStore.getState>,
  server: UserProfile | null
): MergedProfile {
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
    name: null,          // not collected during onboarding — user fills manually
    birthYear,
    region,
    contact: null,       // not stored — user fills manually
    schoolName: rawSchool,
    schoolYear,
    enrollmentStatus,
    incomeBracket,
    householdSize,
  };
}

/** Build the injectable subset — only fields the injection script targets. */
function buildInjectableProfile(profile: MergedProfile): InjectableProfile {
  return {
    name: profile.name ?? "",
    birth: profile.birthYear ?? "",
    phone: profile.contact ?? "",
    address: profile.region ?? "",
  };
}

// ---------------------------------------------------------------------------
// WebView JS injection script builder
// ---------------------------------------------------------------------------

/**
 * Returns a self-executing JS string that:
 *  1. Fills common government-site form fields with user data.
 *  2. Posts a result message back via window.ReactNativeWebView.postMessage.
 */
function buildFillScript(profileData: InjectableProfile): string {
  return `
(function() {
  var data = ${JSON.stringify(profileData)};

  var fields = {
    name: ['#name', '#userName', '#user_name', 'input[name="name"]', 'input[name="userName"]', 'input[name="user_name"]'],
    birth: ['#birth', '#birthDay', '#birth_day', 'input[name="birth"]', 'input[name="birthDay"]', 'input[name="birth_day"]'],
    phone: ['#phone', '#tel', '#mobile', 'input[name="phone"]', 'input[name="tel"]', 'input[name="mobile"]'],
    addr: ['#addr', '#address', '#addr1', 'input[name="addr"]', 'input[name="address"]', 'input[name="addr1"]'],
  };

  var filled = [];
  var missed = [];

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
// Copy utilities
// ---------------------------------------------------------------------------

async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

function formatBasicInfo(p: MergedProfile): string {
  const lines: string[] = ["[기본 인적사항]"];
  if (p.name) lines.push(`이름: ${p.name}`);
  if (p.birthYear) lines.push(`생년월일: ${p.birthYear}`);
  if (p.contact) lines.push(`연락처: ${p.contact}`);
  if (p.region) lines.push(`주소(지역): ${p.region}`);
  if (lines.length === 1) lines.push("(정보 없음 — 설정에서 프로필을 업데이트하세요)");
  return lines.join("\n");
}

function formatAcademicInfo(p: MergedProfile): string {
  const lines: string[] = ["[학적 정보]"];
  if (p.schoolName) lines.push(`학교명: ${p.schoolName}`);
  if (p.schoolYear) lines.push(`학년: ${p.schoolYear}`);
  if (p.enrollmentStatus) lines.push(`학적상태: ${p.enrollmentStatus}`);
  if (lines.length === 1) lines.push("(정보 없음 — 설정에서 프로필을 업데이트하세요)");
  return lines.join("\n");
}

function formatIncomeInfo(p: MergedProfile): string {
  const lines: string[] = ["[소득 정보]"];
  if (p.incomeBracket) lines.push(`소득구간: ${p.incomeBracket}`);
  if (p.householdSize) lines.push(`가구원수: ${p.householdSize}`);
  if (lines.length === 1) lines.push("(정보 없음 — 설정에서 프로필을 업데이트하세요)");
  return lines.join("\n");
}

function formatAllInfo(p: MergedProfile): string {
  return [formatBasicInfo(p), "", formatAcademicInfo(p), "", formatIncomeInfo(p)].join("\n");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  value: string | null;
  onCopy: () => void;
  copied: boolean;
}

function FieldRow({ label, value, onCopy, copied }: FieldRowProps) {
  const isEmpty = !value;
  return (
    <View style={fieldStyles.row}>
      <View style={fieldStyles.labelCol}>
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      <View style={fieldStyles.valueCol}>
        <Text
          style={[fieldStyles.value, isEmpty && fieldStyles.valueMuted]}
          numberOfLines={2}
        >
          {value ?? "미입력"}
        </Text>
      </View>
      <TouchableOpacity
        style={[fieldStyles.copyBtn, isEmpty && fieldStyles.copyBtnDisabled]}
        onPress={onCopy}
        disabled={isEmpty}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${label} 복사`}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Text style={[fieldStyles.copyBtnText, isEmpty && fieldStyles.copyBtnTextDisabled]}>
          {copied ? "완료" : "복사"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  labelCol: {
    width: 70,
    flexShrink: 0,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
  },
  valueCol: {
    flex: 1,
  },
  value: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    lineHeight: 19,
  },
  valueMuted: {
    color: colors.textMuted,
    fontWeight: typography.fontWeight.regular,
  },
  copyBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minWidth: 48,
    alignItems: "center",
    minHeight: 32,
    justifyContent: "center",
  },
  copyBtnDisabled: {
    borderColor: colors.outlineVariant,
  },
  copyBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  copyBtnTextDisabled: {
    color: colors.textMuted,
  },
});

// ---------------------------------------------------------------------------
// One-touch copy card
// ---------------------------------------------------------------------------

interface CopyCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onCopy: () => void;
  copied: boolean;
  accentColor?: string;
  accentBg?: string;
}

function CopyCard({
  icon,
  title,
  subtitle,
  onCopy,
  copied,
  accentColor = colors.primary,
  accentBg = colors.primaryFixed,
}: CopyCardProps) {
  return (
    <TouchableOpacity
      style={[cardStyles.card, { backgroundColor: accentBg }]}
      onPress={onCopy}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={`${title} 복사`}
    >
      <View style={cardStyles.left}>
        <View style={[cardStyles.iconWrap, { backgroundColor: accentColor }]}>
          <Text style={cardStyles.icon}>{icon}</Text>
        </View>
        <View style={cardStyles.textGroup}>
          <Text style={[cardStyles.title, { color: accentColor }]}>{title}</Text>
          <Text style={cardStyles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={[cardStyles.badge, copied ? { backgroundColor: accentColor } : { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1.5, borderColor: accentColor }]}>
        <Text style={[cardStyles.badgeText, { color: copied ? colors.onPrimary : accentColor }]}>
          {copied ? "완료" : "복사"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.touchTargetMin + 12,
    ...shadows.card,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    fontSize: 18,
  },
  textGroup: {
    flex: 1,
    gap: spacing[0.5],
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    lineHeight: 15,
  },
  badge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    minWidth: 48,
    alignItems: "center",
    minHeight: 32,
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
});

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={sectionHeaderStyles.row}>
      <Text style={sectionHeaderStyles.title}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={action}
        >
          <Text style={sectionHeaderStyles.action}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  action: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
});

// ---------------------------------------------------------------------------
// Divider (background color shift, no 1px border line per No-Line Rule)
// ---------------------------------------------------------------------------

function SectionDivider() {
  return <View style={{ height: spacing[3], backgroundColor: colors.surfaceContainerLow }} />;
}

// ---------------------------------------------------------------------------
// Toast overlay
// ---------------------------------------------------------------------------

function ToastOverlay({ visible, message, fadeAnim }: { visible: boolean; message: string; fadeAnim: Animated.Value }) {
  if (!visible) return null;
  return (
    <Animated.View style={[toastStyles.wrap, { opacity: fadeAnim }]}>
      <View style={toastStyles.pill}>
        <Text style={toastStyles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

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

// ---------------------------------------------------------------------------
// WebView floating toolbar
// ---------------------------------------------------------------------------

interface WebViewToolbarProps {
  insetBottom: number;
  onAutoFill: () => void;
  onCopyName: () => void;
  onCopyAddress: () => void;
  onClose: () => void;
  isLoading: boolean;
}

function WebViewToolbar({
  insetBottom,
  onAutoFill,
  onCopyName,
  onCopyAddress,
  onClose,
  isLoading,
}: WebViewToolbarProps) {
  const paddingBottom = insetBottom > 0 ? insetBottom : spacing[3];

  return (
    <View style={[toolbarStyles.container, { paddingBottom }]}>
      {/* Auto-fill primary button */}
      <TouchableOpacity
        style={toolbarStyles.autoFillBtn}
        onPress={onAutoFill}
        activeOpacity={0.85}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel="자동 입력"
      >
        <LinearGradient
          colors={isLoading
            ? [colors.surfaceContainerHigh, colors.surfaceContainerHigh]
            : [colors.primary, colors.primaryContainer]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={toolbarStyles.autoFillGradient}
        >
          <Text style={[toolbarStyles.autoFillText, isLoading && toolbarStyles.autoFillTextDisabled]}>
            자동 입력
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick copy row */}
      <View style={toolbarStyles.quickRow}>
        <TouchableOpacity
          style={toolbarStyles.quickBtn}
          onPress={onCopyName}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="이름 복사"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text style={toolbarStyles.quickBtnText}>이름 복사</Text>
        </TouchableOpacity>

        <View style={toolbarStyles.quickDot} />

        <TouchableOpacity
          style={toolbarStyles.quickBtn}
          onPress={onCopyAddress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="주소 복사"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Text style={toolbarStyles.quickBtnText}>주소 복사</Text>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Close button */}
        <TouchableOpacity
          style={toolbarStyles.closeBtn}
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="완료 — 웹뷰 닫기"
        >
          <Text style={toolbarStyles.closeBtnText}>완료</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const toolbarStyles = StyleSheet.create({
  container: {
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
  autoFillBtn: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
  },
  autoFillGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[3.5],
    minHeight: layout.buttonHeightMd,
  },
  autoFillText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  autoFillTextDisabled: {
    color: colors.onSurfaceVariant,
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  quickBtn: {
    minHeight: layout.touchTargetMin,
    justifyContent: "center",
    paddingHorizontal: spacing[2],
  },
  quickBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  quickDot: {
    width: 3,
    height: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.outlineVariant,
  },
  closeBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceContainerHigh,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
});

// ---------------------------------------------------------------------------
// WebView screen
// ---------------------------------------------------------------------------

interface InAppWebViewProps {
  url: string;
  profile: MergedProfile;
  insets: { top: number; bottom: number };
  onClose: () => void;
  showToast: (message: string) => void;
  onCopyField: (value: string | null) => void;
}

function InAppWebView({
  url,
  profile,
  insets,
  onClose,
  showToast,
  onCopyField,
}: InAppWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAutoFill = useCallback(() => {
    if (!webViewRef.current) return;
    const injectableProfile = buildInjectableProfile(profile);
    const script = buildFillScript(injectableProfile);
    webViewRef.current.injectJavaScript(script);
    showToast("자동 입력을 시도했어요. 확인해주세요.");
  }, [profile, showToast]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "FILL_RESULT") {
          const { missed } = data as { missed: string[] };
          if (missed && missed.length > 0) {
            showToast("일부 항목은 직접 입력이 필요해요");
          }
        }
      } catch {
        // Non-JSON messages from the page — ignore.
      }
    },
    [showToast]
  );

  return (
    <View style={webViewScreenStyles.root}>
      {/* Minimal status-bar spacer */}
      <View style={[webViewScreenStyles.statusBar, { height: insets.top }]} />

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={webViewScreenStyles.webView}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Allow government domains — most Korean gov sites are .go.kr
        originWhitelist={["*"]}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      />

      {/* Loading indicator strip */}
      {isLoading && (
        <View style={webViewScreenStyles.loadingStrip}>
          <View style={webViewScreenStyles.loadingBar} />
        </View>
      )}

      {/* Floating toolbar pinned to bottom */}
      <WebViewToolbar
        insetBottom={insets.bottom}
        onAutoFill={handleAutoFill}
        onCopyName={() => onCopyField(profile.name)}
        onCopyAddress={() => onCopyField(profile.region)}
        onClose={onClose}
        isLoading={isLoading}
      />
    </View>
  );
}

const webViewScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  statusBar: {
    backgroundColor: colors.primary,
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
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AutoFillScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { toast, fadeAnim, show: showToast } = useToast();

  // Whether the in-app WebView is open
  const [webViewOpen, setWebViewOpen] = useState(false);

  // Track which individual fields were recently copied to show "완료" state
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedCategory, setCopiedCategory] = useState<string | null>(null);
  const fieldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local onboarding store
  const localStore = useOnboardingStore();

  // Fetch program data for title + official_url
  const { data: program } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => api.getProgram(programId!),
    enabled: !!programId && !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Fetch server-side profile
  const { data: profileResponse } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.getProfile(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    enabled: !!user,
  });

  const profile = mergeProfile(localStore, profileResponse?.profile ?? null);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : spacing[5] }]}>
          <View style={styles.headerInner}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackBtn}
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
            >
              <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>신청 정보 준비</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.onSurface, marginBottom: 8 }}>
            로그인이 필요해요
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
            신청 정보 자동 입력을 사용하려면 로그인해주세요.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/login")}
            style={{ backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Copy helpers ──

  function handleCopyField(key: string, value: string | null) {
    if (!value) return;
    copyToClipboard(value).then(() => {
      showToast("클립보드에 복사했어요");
      if (fieldTimerRef.current) clearTimeout(fieldTimerRef.current);
      setCopiedField(key);
      fieldTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    });
  }

  function handleCopyCategory(key: string, text: string) {
    copyToClipboard(text).then(() => {
      showToast("클립보드에 복사했어요");
      if (catTimerRef.current) clearTimeout(catTimerRef.current);
      setCopiedCategory(key);
      catTimerRef.current = setTimeout(() => setCopiedCategory(null), 2000);
    });
  }

  function handleCopyAll() {
    copyToClipboard(formatAllInfo(profile)).then(() => {
      showToast("전체 정보를 클립보드에 복사했어요");
    });
  }

  /** Quick copy helper for WebView toolbar buttons */
  function handleWebViewQuickCopy(value: string | null) {
    if (!value) {
      showToast("저장된 정보가 없어요. 직접 입력해주세요.");
      return;
    }
    copyToClipboard(value).then(() => {
      showToast("클립보드에 복사했어요");
    });
  }

  /** Opens the in-app WebView instead of the external browser */
  function handleOpenSiteInApp() {
    if (!program?.official_url) return;
    setWebViewOpen(true);
  }

  // Clean up timers
  useEffect(() => {
    return () => {
      if (fieldTimerRef.current) clearTimeout(fieldTimerRef.current);
      if (catTimerRef.current) clearTimeout(catTimerRef.current);
    };
  }, []);

  const bottomBarHeight = 72 + (insets.bottom > 0 ? insets.bottom : spacing[4]);
  const hasOfficialUrl = !!program?.official_url;

  // Fields array for the profile preview section
  const fields: Array<{ key: string; label: string; value: string | null }> = [
    { key: "name", label: "이름", value: profile.name },
    { key: "birthYear", label: "생년월일", value: profile.birthYear },
    { key: "region", label: "주소(지역)", value: profile.region },
    { key: "contact", label: "연락처", value: profile.contact },
    { key: "schoolName", label: "학교명", value: profile.schoolName },
    { key: "schoolYear", label: "학년", value: profile.schoolYear },
    { key: "enrollmentStatus", label: "학적상태", value: profile.enrollmentStatus },
  ];

  // ── When WebView is open, render the in-app browser UI ──
  if (webViewOpen && program?.official_url) {
    return (
      <View style={{ flex: 1 }}>
        <InAppWebView
          url={program.official_url}
          profile={profile}
          insets={{ top: insets.top, bottom: insets.bottom }}
          onClose={() => setWebViewOpen(false)}
          showToast={showToast}
          onCopyField={handleWebViewQuickCopy}
        />
        {/* Toast is rendered above the WebView */}
        <ToastOverlay visible={toast.visible} message={toast.message} fadeAnim={fadeAnim} />
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
        style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + spacing[2] : spacing[8] }]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
          >
            <Text style={styles.headerBackArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>신청 정보 자동 채우기</Text>
            {program?.title ? (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {program.title}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Hint strip at bottom of header */}
        <View style={styles.headerHint}>
          <Text style={styles.headerHintText}>
            저장된 프로필에서 신청에 필요한 정보를 바로 복사하세요
          </Text>
        </View>
      </LinearGradient>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomBarHeight + spacing[6] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: 프로필 데이터 미리보기 ── */}
        <View style={styles.section}>
          <SectionHeader
            title="내 신청 정보"
            action="전체 복사"
            onAction={handleCopyAll}
          />

          <View style={styles.fieldCard}>
            {fields.map((field, idx) => (
              <React.Fragment key={field.key}>
                {idx > 0 && <View style={styles.fieldDivider} />}
                <FieldRow
                  label={field.label}
                  value={field.value}
                  onCopy={() => handleCopyField(field.key, field.value)}
                  copied={copiedField === field.key}
                />
              </React.Fragment>
            ))}
          </View>

          {/* Warning note when name/contact are empty */}
          {(!profile.name || !profile.contact) && (
            <View style={styles.warningNote}>
              <Text style={styles.warningIcon}>ⓘ</Text>
              <Text style={styles.warningText}>
                이름과 연락처는 직접 입력해야 합니다. 개인정보 보호를 위해 저장하지 않아요.
              </Text>
            </View>
          )}
        </View>

        <SectionDivider />

        {/* ── Section 2: 원터치 복사 카드 ── */}
        <View style={styles.section}>
          <SectionHeader title="원터치 복사" />

          <View style={styles.copyCardsGroup}>
            <CopyCard
              icon="👤"
              title="기본 인적사항"
              subtitle="이름 · 생년월일 · 연락처 · 주소"
              onCopy={() => handleCopyCategory("basic", formatBasicInfo(profile))}
              copied={copiedCategory === "basic"}
              accentColor={colors.primary}
              accentBg={colors.primaryFixed}
            />

            <CopyCard
              icon="🎓"
              title="학적 정보"
              subtitle="학교 · 학년 · 학적상태"
              onCopy={() => handleCopyCategory("academic", formatAcademicInfo(profile))}
              copied={copiedCategory === "academic"}
              accentColor="#1d6b44"
              accentBg="#d1fae5"
            />

            <CopyCard
              icon="💰"
              title="소득 정보"
              subtitle="소득구간 · 가구원수"
              onCopy={() => handleCopyCategory("income", formatIncomeInfo(profile))}
              copied={copiedCategory === "income"}
              accentColor="#9a3412"
              accentBg="#ffedd5"
            />
          </View>
        </View>

        <SectionDivider />

        {/* ── Section 3: 신청 사이트 바로가기 ── */}
        <View style={styles.section}>
          <SectionHeader title="신청 사이트 바로가기" />

          {hasOfficialUrl ? (
            <View style={styles.siteCard}>
              <View style={styles.siteCardInfo}>
                <Text style={styles.siteCardIcon}>🌐</Text>
                <View style={styles.siteCardTextGroup}>
                  <Text style={styles.siteCardTitle}>공식 신청 페이지</Text>
                  <Text style={styles.siteCardUrl} numberOfLines={1}>
                    {program!.official_url}
                  </Text>
                </View>
              </View>

              {/* Primary: open in-app WebView */}
              <TouchableOpacity
                style={styles.siteOpenBtn}
                onPress={handleOpenSiteInApp}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="신청 사이트 열기 — 앱 내 자동 입력 지원"
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.siteOpenGradient}
                >
                  <Text style={styles.siteOpenBtnText}>신청 사이트 열기</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.siteHintRow}>
                <Text style={styles.siteHintText}>
                  앱 내 브라우저로 열리며 "자동 입력" 버튼으로 정보를 한 번에 채울 수 있어요.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noUrlCard}>
              <Text style={styles.noUrlIcon}>🔍</Text>
              <Text style={styles.noUrlText}>
                이 프로그램은 등록된 신청 URL이 없습니다.{"\n"}공식 기관에 직접 문의하세요.
              </Text>
            </View>
          )}
        </View>

        {/* ── Section 4: 신청서 PDF 생성 ── */}
        <SectionDivider />
        <View style={styles.section}>
          <SectionHeader title="신청서 PDF 생성" />
          <TouchableOpacity
            style={pdfStyles.card}
            onPress={() => {
              if (programId) {
                router.push(`/generated-form?programId=${programId}`);
              }
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="신청서 PDF 자동 생성 화면으로 이동"
          >
            <View style={pdfStyles.left}>
              <View style={pdfStyles.iconWrap}>
                <Text style={pdfStyles.icon}>📑</Text>
              </View>
              <View style={pdfStyles.textGroup}>
                <Text style={pdfStyles.title}>신청서 PDF 자동 생성</Text>
                <Text style={pdfStyles.subtitle}>
                  프로필 정보로 신청서를 만들고 공유·인쇄하세요
                </Text>
              </View>
            </View>
            <Text style={pdfStyles.arrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Section 5: 서류 보관함 ── */}
        <SectionDivider />
        <VaultSection
          programTitle={program?.title ?? ""}
          onNavigateVault={() => router.push("/document-vault")}
        />

        {/* ── Section 6: 도움말 ── */}
        <View style={[styles.section, styles.tipSection]}>
          <Text style={styles.tipTitle}>이렇게 사용하세요</Text>
          <View style={styles.tipList}>
            {[
              "'신청 사이트 열기'를 탭하면 앱 안에서 사이트가 열려요.",
              "하단 '자동 입력' 버튼을 탭하면 저장된 정보가 자동으로 입력돼요.",
              "자동 입력이 안 되는 항목은 '이름 복사' / '주소 복사'로 빠르게 붙여넣기 하세요.",
              "이름·연락처는 개인정보 보호를 위해 직접 입력해야 해요.",
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipNumber}>{i + 1}</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
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
        <TouchableOpacity
          style={styles.bottomAllCopyBtn}
          onPress={handleCopyAll}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="전체 정보 복사"
        >
          <Text style={styles.bottomAllCopyText}>전체 복사</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomPdfBtn]}
          onPress={() => {
            if (programId) router.push(`/generated-form?programId=${programId}`);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="신청서 PDF 생성"
        >
          <Text style={styles.bottomPdfText}>PDF 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomOpenBtn, !hasOfficialUrl && styles.bottomBtnDisabled]}
          onPress={handleOpenSiteInApp}
          activeOpacity={0.85}
          disabled={!hasOfficialUrl}
          accessibilityRole="button"
          accessibilityLabel="신청 사이트 열기"
        >
          <LinearGradient
            colors={hasOfficialUrl ? [colors.primary, colors.primaryContainer] : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomOpenGradient}
          >
            <Text style={[styles.bottomOpenText, !hasOfficialUrl && styles.bottomOpenTextDisabled]}>
              신청 사이트
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Toast ── */}
      <ToastOverlay visible={toast.visible} message={toast.message} fadeAnim={fadeAnim} />
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
    paddingBottom: spacing[5],
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  headerBackBtn: {
    minWidth: layout.touchTargetMin,
    minHeight: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerBackArrow: {
    fontSize: 22,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  headerTextGroup: {
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
    fontWeight: typography.fontWeight.regular,
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
    fontWeight: typography.fontWeight.medium,
    color: "rgba(255,255,255,0.90)",
    lineHeight: 19,
    textAlign: "center",
  },

  // ── Scroll / sections ──
  scroll: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
  },

  // ── Field card ──
  fieldCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    ...shadows.card,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginHorizontal: 0,
  },

  // Warning note
  warningNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    marginTop: spacing[4],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  warningIcon: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 1,
    flexShrink: 0,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },

  // ── Copy cards group ──
  copyCardsGroup: {
    gap: spacing[3],
  },

  // ── Site card ──
  siteCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    gap: spacing[4],
    ...shadows.cardMd,
  },
  siteCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  siteCardIcon: {
    fontSize: 26,
    flexShrink: 0,
  },
  siteCardTextGroup: {
    flex: 1,
    gap: spacing[0.5],
  },
  siteCardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  siteCardUrl: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.primary,
    lineHeight: 16,
  },
  siteOpenBtn: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
  },
  siteOpenGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    minHeight: layout.buttonHeightMd,
  },
  siteOpenBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  siteHintRow: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  siteHintText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.onPrimaryFixedVariant,
    lineHeight: 17,
    textAlign: "center",
  },

  // No URL state
  noUrlCard: {
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  noUrlIcon: {
    fontSize: 32,
  },
  noUrlText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 21,
  },

  // ── Tip section ──
  tipSection: {
    backgroundColor: colors.surfaceContainerLowest,
    marginTop: 0,
  },
  tipTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    marginBottom: spacing[4],
  },
  tipList: {
    gap: spacing[3],
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  tipNumber: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryFixed,
    textAlign: "center",
    lineHeight: 22,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },

  // ── Fixed bottom bar ──
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
  bottomAllCopyBtn: {
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
  bottomAllCopyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  bottomOpenBtn: {
    flex: 2,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    minHeight: layout.buttonHeightMd,
  },
  bottomOpenGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    minHeight: layout.buttonHeightMd,
  },
  bottomBtnDisabled: {
    opacity: 0.45,
  },
  bottomOpenText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  bottomOpenTextDisabled: {
    color: colors.onSurfaceVariant,
  },

  // ── PDF button in bottom bar ──
  bottomPdfBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: "#1d6b44",
    minHeight: layout.buttonHeightMd,
    backgroundColor: "#d1fae5",
  },
  bottomPdfText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: "#1d6b44",
  },
});

// ---------------------------------------------------------------------------
// PDF promo card styles
// ---------------------------------------------------------------------------

const pdfStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: layout.touchTargetMin + 12,
    ...shadows.card,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    fontSize: 20,
  },
  textGroup: {
    flex: 1,
    gap: spacing[0.5],
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: 16,
  },
  arrow: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing[2],
  },
});
