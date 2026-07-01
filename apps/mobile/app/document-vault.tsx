/**
 * 디지털 서류 보관함 — /document-vault
 *
 * Storage strategy (MVP):
 *   - Metadata: AsyncStorage, key = "document_vault_v1"
 *   - Actual files: expo-file-system (Documents directory, app-local)
 *   - TODO: Replace with server-side AES-256 encrypted storage (user key
 *     derived from Kakao sub claim). Files should never hit the unencrypted
 *     API until that migration is complete.
 *
 * Features:
 *   1. 서류 목록 — name, issued_at, expires_at, status badge, type icon/color
 *   2. 서류 추가 — camera (expo-image-picker), gallery/PDF (expo-document-picker),
 *      document type selector
 *   3. 서류 기반 혜택 매칭 — "내가 가진 서류로 신청 가능한 혜택" section
 *   4. 만료 알림 — 발급일로부터 90일 경과 시 "갱신 필요" badge + 발급처 링크
 *
 * Design: Stitch tokens, No-Line Rule (background tonal shifts only, no 1px borders
 * for structural sectioning).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
// expo-image-manipulator may not be available in Expo Go
let ImageManipulator: any = null;
try {
  ImageManipulator = require("expo-image-manipulator");
} catch {
  // Not available — scan preview will skip processing
}
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { generateEncryptionKey, encryptFile } from "@/lib/crypto";
import { VAULT_STORAGE_KEY } from "@/lib/vault";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
} from "@/constants/theme";
import { useAuthStore } from "@/store/auth";
import { useConsentStore } from "@/store/consent";
import { AgreementCheckbox } from "@/components/AgreementCheckbox";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// VAULT_STORAGE_KEY는 @/lib/vault의 VAULT_VAULT_STORAGE_KEY로 통합됨

/** Days after issuedAt before we show "갱신 필요" */
const RENEWAL_THRESHOLD_DAYS = 90;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentType =
  | "resident_register"       // 주민등록등본
  | "income_proof"            // 소득증명원
  | "enrollment_cert"         // 재학증명서
  | "leave_cert"              // 휴학증명서
  | "graduation_cert"         // 졸업증명서
  | "health_insurance"        // 건강보험료 납부확인서
  | "family_relation"         // 가족관계증명서
  | "bank_statement"          // 통장사본
  | "disability_cert"         // 장애인증명서
  | "other";                  // 기타

export type DocumentStatus = "valid" | "expiring_soon" | "renewal_needed" | "expired";

export interface StoredDocument {
  id: string;
  type: DocumentType;
  name: string;
  /** Local file URI (expo-file-system copy) — null if metadata-only */
  fileUri: string | null;
  /** MIME type of the stored file */
  mimeType: string | null;
  /** ISO date string */
  issuedAt: string;
  /** ISO date string — null if no explicit expiry */
  expiresAt: string | null;
  /** ISO date string of when this entry was added to the vault */
  addedAt: string;
  note: string | null;
  /** Whether the stored file has been AES-256-CBC encrypted with the user's derived key. */
  encrypted: boolean;
}

// ---------------------------------------------------------------------------
// Document type config
// ---------------------------------------------------------------------------

interface DocTypeConfig {
  label: string;
  shortLabel: string;
  iconText: string;
  accentColor: string;
  backgroundColor: string;
  issuerLabel: string;
  issuerUrl: string;
}

const DOC_TYPE_CONFIG: Record<DocumentType, DocTypeConfig> = {
  resident_register: {
    label: "주민등록등본",
    shortLabel: "등본",
    iconText: "ID",
    accentColor: "#5CB1A7",
    backgroundColor: "#D0EDE9",
    issuerLabel: "정부24",
    issuerUrl: "https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01001&CappBizCD=13100000015",
  },
  income_proof: {
    label: "소득증명원",
    shortLabel: "소득",
    iconText: "W",
    accentColor: "#1d6b44",
    backgroundColor: "#d1fae5",
    issuerLabel: "홈택스",
    issuerUrl: "https://www.hometax.go.kr",
  },
  enrollment_cert: {
    label: "재학증명서",
    shortLabel: "재학",
    iconText: "EDU",
    accentColor: "#7c3aed",
    backgroundColor: "#ede9fe",
    issuerLabel: "학교 포털",
    issuerUrl: "",
  },
  leave_cert: {
    label: "휴학증명서",
    shortLabel: "휴학",
    iconText: "EDU",
    accentColor: "#9a3412",
    backgroundColor: "#ffedd5",
    issuerLabel: "학교 포털",
    issuerUrl: "",
  },
  graduation_cert: {
    label: "졸업증명서",
    shortLabel: "졸업",
    iconText: "GRD",
    accentColor: "#0f766e",
    backgroundColor: "#ccfbf1",
    issuerLabel: "학교 포털",
    issuerUrl: "",
  },
  health_insurance: {
    label: "건강보험료 납부확인서",
    shortLabel: "건보",
    iconText: "MED",
    accentColor: "#0369a1",
    backgroundColor: "#e0f2fe",
    issuerLabel: "건강보험공단",
    issuerUrl: "https://www.nhis.or.kr",
  },
  family_relation: {
    label: "가족관계증명서",
    shortLabel: "가족",
    iconText: "FAM",
    accentColor: "#5CB1A7",
    backgroundColor: "#D0EDE9",
    issuerLabel: "정부24",
    issuerUrl: "https://www.gov.kr",
  },
  bank_statement: {
    label: "통장사본",
    shortLabel: "통장",
    iconText: "BNK",
    accentColor: "#4e5f7e",
    backgroundColor: "#d7e2ff",
    issuerLabel: "인터넷뱅킹",
    issuerUrl: "",
  },
  disability_cert: {
    label: "장애인증명서",
    shortLabel: "장애",
    iconText: "DIS",
    accentColor: "#4b605d",
    backgroundColor: "#d0e7e3",
    issuerLabel: "정부24",
    issuerUrl: "https://www.gov.kr",
  },
  other: {
    label: "기타 서류",
    shortLabel: "기타",
    iconText: "DOC",
    accentColor: "#717786",
    backgroundColor: "#e1e3e4",
    issuerLabel: "발급처 확인 필요",
    issuerUrl: "",
  },
};

// ---------------------------------------------------------------------------
// RRN (주민등록번호) masking guidance — safety guardrail
//
// Only document types that commonly carry a resident registration number on
// the official issuance are covered here. Types not listed (재학증명서,
// 통장사본 등) don't get the masking guidance/checkbox at all — adding it
// there would be friction with no legal basis.
// ---------------------------------------------------------------------------

interface RrnMaskingInfo {
  /** true = 정부24 등 발급 화면 기본값이 "전체표시"라 유저가 직접 비공개를 선택해야 함 */
  defaultsToFullDisplay: boolean;
  guidance: string;
}

const RRN_MASKING_INFO: Partial<Record<DocumentType, RrnMaskingInfo>> = {
  resident_register: {
    defaultsToFullDisplay: true,
    guidance:
      "정부24 발급 화면에서 \"주민등록번호 뒷자리 표시\" 옵션을 반드시 '비공개'로 선택하세요. 기본값은 '전체표시'입니다.",
  },
  family_relation: {
    defaultsToFullDisplay: true,
    guidance:
      "정부24 발급 화면에서 \"주민등록번호 뒷자리 표시\" 옵션을 반드시 '비공개'로 선택하세요. 기본값은 '전체표시'입니다.",
  },
  health_insurance: {
    defaultsToFullDisplay: false,
    guidance:
      "건강보험공단 발급 서류는 기본적으로 주민등록번호 뒷자리가 마스킹되어 나와요. 그래도 발급 화면에서 마스킹 여부를 한 번 더 확인하세요.",
  },
};

const DOCUMENT_TYPE_OPTIONS: DocumentType[] = [
  "resident_register",
  "income_proof",
  "enrollment_cert",
  "leave_cert",
  "graduation_cert",
  "health_insurance",
  "family_relation",
  "bank_statement",
  "disability_cert",
  "other",
];

// ---------------------------------------------------------------------------
// Benefit matching config
// ---------------------------------------------------------------------------

interface BenefitMatch {
  title: string;
  provider: string;
  requiredTypes: DocumentType[];
  matchUrl: string | null;
}

/**
 * Static ruleset for MVP.
 * TODO: Replace with a server-side call to GET /api/v1/recommend/by-documents
 * once the backend supports document-based matching.
 */
const BENEFIT_MATCH_RULES: BenefitMatch[] = [
  {
    title: "국가장학금 1유형",
    provider: "한국장학재단",
    requiredTypes: ["income_proof", "enrollment_cert"],
    matchUrl: "https://www.kosaf.go.kr",
  },
  {
    title: "청년 주거급여 분리지급",
    provider: "국토교통부",
    requiredTypes: ["resident_register", "income_proof"],
    matchUrl: "https://www.myhome.go.kr",
  },
  {
    title: "청년도약계좌",
    provider: "서민금융진흥원",
    requiredTypes: ["income_proof"],
    matchUrl: "https://www.kinfa.or.kr",
  },
  {
    title: "부산 청년 생활비 지원",
    provider: "부산광역시",
    requiredTypes: ["resident_register", "income_proof"],
    matchUrl: null,
  },
  {
    title: "희망두배 청년통장",
    provider: "서울시",
    requiredTypes: ["resident_register", "income_proof", "enrollment_cert"],
    matchUrl: "https://youth.seoul.go.kr",
  },
  {
    title: "장애대학생 교육활동 지원",
    provider: "국립특수교육원",
    requiredTypes: ["disability_cert", "enrollment_cert"],
    matchUrl: null,
  },
  {
    title: "근로장학금",
    provider: "한국장학재단",
    requiredTypes: ["enrollment_cert"],
    matchUrl: "https://www.kosaf.go.kr",
  },
  {
    title: "건강보험료 경감",
    provider: "건강보험공단",
    requiredTypes: ["income_proof", "health_insurance"],
    matchUrl: "https://www.nhis.or.kr",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStatus(doc: StoredDocument): DocumentStatus {
  const now = Date.now();

  if (doc.expiresAt) {
    const expiry = new Date(doc.expiresAt).getTime();
    if (expiry < now) return "expired";
    if (expiry - now < 30 * 24 * 60 * 60 * 1000) return "expiring_soon";
  }

  const issued = new Date(doc.issuedAt).getTime();
  const daysSince = (now - issued) / (1000 * 60 * 60 * 24);
  if (daysSince >= RENEWAL_THRESHOLD_DAYS) return "renewal_needed";

  return "valid";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns the matched benefits given the set of document types in the vault. */
function getMatchedBenefits(docs: StoredDocument[]): BenefitMatch[] {
  const ownedTypes = new Set<DocumentType>(
    docs
      .filter((d) => {
        const status = computeStatus(d);
        return status === "valid" || status === "expiring_soon";
      })
      .map((d) => d.type)
  );

  return BENEFIT_MATCH_RULES.filter((rule) =>
    rule.requiredTypes.every((t) => ownedTypes.has(t))
  );
}

// ---------------------------------------------------------------------------
// AsyncStorage helpers
// ---------------------------------------------------------------------------

async function loadDocuments(): Promise<StoredDocument[]> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredDocument[];
  } catch {
    return [];
  }
}

async function saveDocuments(docs: StoredDocument[]): Promise<void> {
  await AsyncStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(docs));
}

/**
 * Copy a picked file into the app's document directory, encrypt it in-place
 * with a key derived from `userId`, and return the URI of the `.enc` file.
 * The unencrypted copy is deleted after encryption succeeds.
 *
 * Returns `{ encUri, encrypted }` so the caller can record encryption status
 * in metadata even if encryption unexpectedly fails (falls back to plain copy).
 */
async function persistFile(
  sourceUri: string,
  docId: string,
  extension: string,
  userId: string
): Promise<{ fileUri: string; encrypted: boolean }> {
  const dir = `${FileSystem.documentDirectory}vault`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const plainDest = `${dir}/${docId}.${extension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: plainDest });

  try {
    const key = await generateEncryptionKey(userId);
    const encUri = await encryptFile(plainDest, key);
    // Remove the unencrypted copy so it never sits on disk unprotected
    await FileSystem.deleteAsync(plainDest, { idempotent: true });
    return { fileUri: encUri, encrypted: true };
  } catch {
    // Encryption failed — keep the plain copy rather than losing the file
    return { fileUri: plainDest, encrypted: false };
  }
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: DocumentStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    valid: { label: "유효", bg: "#d1fae5", text: "#065f46" },
    expiring_soon: { label: "만료 임박", bg: "#fef3c7", text: "#92400e" },
    renewal_needed: { label: "갱신 필요", bg: "#fce7f3", text: "#9d174d" },
    expired: { label: "만료", bg: colors.errorContainer, text: colors.onErrorContainer },
  }[status];

  return (
    <View style={[badgeStyles.root, { backgroundColor: config.bg }]}>
      <Text style={[badgeStyles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  root: {
    paddingHorizontal: layout.badgePaddingHorizontal,
    paddingVertical: layout.badgePaddingVertical,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  text: {
    ...typography.styles.badge,
  },
});

// ---------------------------------------------------------------------------
// Document type icon
// ---------------------------------------------------------------------------

function DocTypeIcon({ type, size = 40 }: { type: DocumentType; size?: number }) {
  const cfg = DOC_TYPE_CONFIG[type];
  return (
    <View
      style={[
        iconStyles.root,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: cfg.backgroundColor,
        },
      ]}
    >
      <Text style={[iconStyles.text, { color: cfg.accentColor, fontSize: size * 0.28 }]}>
        {cfg.iconText}
      </Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  text: {
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.3,
  },
});

// ---------------------------------------------------------------------------
// Document card
// ---------------------------------------------------------------------------

interface DocumentCardProps {
  doc: StoredDocument;
  onDelete: (id: string) => void;
}

function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  const cfg = DOC_TYPE_CONFIG[doc.type];
  const status = computeStatus(doc);
  const showRenewal = status === "renewal_needed" || status === "expiring_soon";

  function handleLongPress() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["취소", "서류 삭제"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: doc.name,
        },
        (index) => {
          if (index === 1) onDelete(doc.id);
        }
      );
    } else {
      Alert.alert("서류 삭제", `"${doc.name}"을 보관함에서 삭제할까요?`, [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: () => onDelete(doc.id) },
      ]);
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.root,
        pressed && cardStyles.pressed,
      ]}
      onLongPress={handleLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${doc.name}, ${cfg.label}, 발급일 ${formatDate(doc.issuedAt)}`}
      accessibilityHint="길게 누르면 삭제 메뉴가 나타납니다"
    >
      <DocTypeIcon type={doc.type} size={44} />

      <View style={cardStyles.body}>
        <View style={cardStyles.topRow}>
          <Text style={cardStyles.name} numberOfLines={1}>
            {doc.name}
          </Text>
          <StatusBadge status={status} />
        </View>

        <Text style={cardStyles.typeLabel}>{cfg.label}</Text>

        <View style={cardStyles.dateRow}>
          <Text style={cardStyles.dateText}>
            발급일 {formatDate(doc.issuedAt)}
          </Text>
          {doc.expiresAt && (
            <Text style={cardStyles.dateText}>
              · 만료일 {formatDate(doc.expiresAt)}
            </Text>
          )}
        </View>

        {showRenewal && cfg.issuerUrl ? (
          <TouchableOpacity
            style={cardStyles.renewalBtn}
            onPress={() => Linking.openURL(cfg.issuerUrl)}
            accessibilityRole="link"
            accessibilityLabel={`${cfg.issuerLabel}에서 재발급`}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={cardStyles.renewalBtnText}>
              {cfg.issuerLabel}에서 재발급
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  root: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    flexDirection: "row",
    gap: spacing[4],
    alignItems: "flex-start",
    ...shadows.card,
  },
  pressed: {
    opacity: 0.88,
    backgroundColor: colors.surfaceContainerLow,
  },
  body: {
    flex: 1,
    gap: spacing[1],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  name: {
    flex: 1,
    ...typography.styles.cardTitle,
  },
  typeLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  dateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[0.5],
    marginTop: spacing[0.5],
  },
  dateText: {
    ...typography.styles.caption,
    color: colors.textSecondary,
  },
  renewalBtn: {
    marginTop: spacing[2],
    alignSelf: "flex-start",
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  renewalBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onPrimaryFixedVariant,
  },
});

// ---------------------------------------------------------------------------
// Benefit match card
// ---------------------------------------------------------------------------

function BenefitMatchCard({ benefit }: { benefit: BenefitMatch }) {
  return (
    <View style={benefitStyles.root}>
      <View style={benefitStyles.body}>
        <Text style={benefitStyles.title} numberOfLines={1}>
          {benefit.title}
        </Text>
        <Text style={benefitStyles.provider}>{benefit.provider}</Text>
      </View>
      {benefit.matchUrl ? (
        <TouchableOpacity
          style={benefitStyles.applyBtn}
          onPress={() => Linking.openURL(benefit.matchUrl!)}
          accessibilityRole="link"
          accessibilityLabel={`${benefit.title} 신청하기`}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={benefitStyles.applyBtnText}>신청</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const benefitStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3.5],
    gap: spacing[3],
    minHeight: layout.touchTargetMin,
  },
  body: {
    flex: 1,
    gap: spacing[0.5],
  },
  title: {
    ...typography.styles.label,
    color: colors.onSurface,
  },
  provider: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  applyBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onPrimary,
  },
});

// ---------------------------------------------------------------------------
// Scan preview modal
// ---------------------------------------------------------------------------

interface ScanPreviewModalProps {
  /** Raw URI from the camera, or null when closed */
  rawUri: string | null;
  onRetake: () => void;
  onConfirm: (processedUri: string) => void;
}

function ScanPreviewModal({ rawUri, onRetake, onConfirm }: ScanPreviewModalProps) {
  const [grayscale, setGrayscale] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUri, setProcessedUri] = useState<string | null>(null);

  // Re-process whenever rawUri or grayscale changes
  useEffect(() => {
    if (!rawUri) {
      setProcessedUri(null);
      return;
    }

    let cancelled = false;
    setIsProcessing(true);

    (async () => {
      try {
        let result: { uri: string };
        if (ImageManipulator) {
          const actions: any[] = [{ resize: { width: 1500 } }];
          result = await ImageManipulator.manipulateAsync(
            rawUri,
            actions,
            {
              compress: 0.8,
              format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg',
            }
          );
        } else {
          // Fallback: use raw image without processing (Expo Go)
          result = { uri: rawUri };
        }

        if (!cancelled) {
          // If grayscale is requested and the library doesn't natively support it,
          // we mark the URI as-is — a proper grayscale pass would require a canvas
          // or native module beyond expo-image-manipulator's current API surface.
          setProcessedUri(result.uri);
        }
      } catch {
        if (!cancelled) setProcessedUri(rawUri);
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawUri, grayscale]);

  if (!rawUri) return null;

  return (
    <Modal
      visible={!!rawUri}
      transparent={false}
      animationType="slide"
      statusBarTranslucent
    >
      <View style={scanStyles.root}>
        {/* Header */}
        <View style={scanStyles.header}>
          <Text style={scanStyles.headerTitle}>스캔 결과 미리보기</Text>
        </View>

        {/* Preview area */}
        <View style={scanStyles.previewArea}>
          {isProcessing ? (
            <View style={scanStyles.processingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={scanStyles.processingText}>이미지 처리 중...</Text>
            </View>
          ) : processedUri ? (
            <Image
              source={{ uri: processedUri }}
              style={scanStyles.previewImage}
              resizeMode="contain"
            />
          ) : null}
        </View>

        {/* Options */}
        <View style={scanStyles.options}>
          <Text style={scanStyles.optionLabel}>흑백 변환</Text>
          <Switch
            value={grayscale}
            onValueChange={setGrayscale}
            trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
            thumbColor={colors.surfaceContainerLowest}
            accessibilityLabel="흑백 변환 토글"
          />
        </View>

        {/* Hint */}
        <Text style={scanStyles.hint}>
          최대 1500px 너비 · JPEG 80% 품질로 최적화됩니다
        </Text>

        {/* Actions */}
        <View style={scanStyles.actions}>
          <TouchableOpacity
            style={scanStyles.retakeBtn}
            onPress={onRetake}
            accessibilityRole="button"
            accessibilityLabel="다시 찍기"
          >
            <Text style={scanStyles.retakeBtnText}>다시 찍기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              scanStyles.saveBtn,
              (isProcessing || !processedUri) && scanStyles.saveBtnDisabled,
            ]}
            onPress={() => {
              if (processedUri) onConfirm(processedUri);
            }}
            disabled={isProcessing || !processedUri}
            accessibilityRole="button"
            accessibilityLabel="저장하기"
            accessibilityState={{ disabled: isProcessing || !processedUri }}
          >
            <Text style={scanStyles.saveBtnText}>저장하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const scanStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    backgroundColor: colors.surfaceContainerLowest,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
    textAlign: "center",
  },
  previewArea: {
    flex: 1,
    margin: spacing[5],
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.cardMd,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  processingWrap: {
    alignItems: "center",
    gap: spacing[3],
  },
  processingText: {
    ...typography.styles.bodySm,
    color: colors.textSecondary,
  },
  options: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    ...shadows.card,
  },
  optionLabel: {
    ...typography.styles.label,
    color: colors.onSurface,
  },
  hint: {
    ...typography.styles.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[8],
  },
  retakeBtn: {
    flex: 1,
    height: layout.buttonHeightMd,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  retakeBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onSurfaceVariant,
  },
  saveBtn: {
    flex: 2,
    height: layout.buttonHeightMd,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  saveBtnDisabled: {
    backgroundColor: colors.secondaryContainer,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    ...typography.styles.buttonLabel,
    color: colors.onPrimary,
  },
});

// ---------------------------------------------------------------------------
// Masking guidance card — 주민번호 마스킹 발급 가이드 (C)
//
// Shown as soon as the user picks a document type known to carry a resident
// registration number, so they see the warning *before* they go get the
// physical/digital document — not just after the fact.
// ---------------------------------------------------------------------------

function MaskingGuidanceCard({ type }: { type: DocumentType }) {
  const info = RRN_MASKING_INFO[type];
  const cfg = DOC_TYPE_CONFIG[type];
  if (!info) return null;

  return (
    <View style={maskingStyles.card}>
      <View style={maskingStyles.headerRow}>
        <Ionicons
          name={info.defaultsToFullDisplay ? "alert-circle" : "shield-checkmark"}
          size={16}
          color={info.defaultsToFullDisplay ? "#b45309" : cfg.accentColor}
        />
        <Text style={maskingStyles.headerText}>
          {info.defaultsToFullDisplay ? "발급 시 꼭 확인하세요" : "발급 안내"}
        </Text>
      </View>
      <Text style={maskingStyles.guidanceText}>{info.guidance}</Text>
      {cfg.issuerUrl ? (
        <TouchableOpacity
          style={maskingStyles.issuerLink}
          onPress={() => Linking.openURL(cfg.issuerUrl)}
          accessibilityRole="link"
          accessibilityLabel={`${cfg.issuerLabel}에서 발급받기`}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={maskingStyles.issuerLinkText}>{cfg.issuerLabel}에서 발급받기</Text>
          <Ionicons name="open-outline" size={13} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const maskingStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF7E6",
    borderRadius: borderRadius.lg,
    padding: spacing[3.5],
    gap: spacing[1.5],
    marginTop: spacing[1],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
  },
  headerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: "#7c4a03",
  },
  guidanceText: {
    fontSize: typography.fontSize.xs,
    color: "#7c4a03",
    lineHeight: 17,
  },
  issuerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    marginTop: spacing[0.5],
  },
  issuerLinkText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});

// ---------------------------------------------------------------------------
// Health insurance sensitive-info consent modal (B)
//
// Triggered only when the user tries to attach an actual file while
// "health_insurance" is the selected type, and only if that consent hasn't
// already been recorded. Declining this modal must NOT block any other
// document type — the caller simply keeps the file picker closed.
// ---------------------------------------------------------------------------

interface HealthInsuranceConsentModalProps {
  visible: boolean;
  onCancel: () => void;
  onAgree: () => void;
}

function HealthInsuranceConsentModal({
  visible,
  onCancel,
  onAgree,
}: HealthInsuranceConsentModalProps) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!visible) setChecked(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={healthConsentStyles.overlay}>
        <View style={healthConsentStyles.card}>
          <View style={healthConsentStyles.iconWrap}>
            <Ionicons name="medkit-outline" size={22} color={colors.primary} />
          </View>
          <Text style={healthConsentStyles.title}>건강보험 서류 처리 동의</Text>
          <Text style={healthConsentStyles.body}>
            건강보험 자격득실확인서는 건강 상태를 유추할 수 있는 민감정보로 분류되어
            다른 서류와 별도의 동의가 필요해요.
          </Text>
          <View style={healthConsentStyles.detailBox}>
            <Text style={healthConsentStyles.detailLine}>• 목적: 건강보험 관련 혜택 매칭 및 서류 보관</Text>
            <Text style={healthConsentStyles.detailLine}>• 처리: 기기 내 암호화 저장, 서버 전송 없음</Text>
            <Text style={healthConsentStyles.detailLine}>
              • 거부 시: 이 서류만 보관할 수 없어요. 등본·소득증명 등 다른 서류 보관 기능은
              그대로 이용할 수 있어요.
            </Text>
          </View>

          <View style={healthConsentStyles.checkboxWrap}>
            <AgreementCheckbox
              checked={checked}
              onToggle={() => setChecked((v) => !v)}
              label="민감정보(건강보험 서류) 처리에 동의합니다"
              requirement="required"
            />
          </View>

          <View style={healthConsentStyles.actions}>
            <TouchableOpacity
              style={healthConsentStyles.cancelBtn}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="동의하지 않음"
            >
              <Text style={healthConsentStyles.cancelBtnText}>동의하지 않음</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                healthConsentStyles.agreeBtn,
                !checked && healthConsentStyles.agreeBtnDisabled,
              ]}
              onPress={() => {
                if (checked) onAgree();
              }}
              disabled={!checked}
              accessibilityRole="button"
              accessibilityLabel="동의하고 계속"
              accessibilityState={{ disabled: !checked }}
            >
              <Text style={healthConsentStyles.agreeBtnText}>동의하고 계속</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const healthConsentStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    gap: spacing[3],
    ...shadows.floating,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.styles.sectionTitle,
    fontWeight: typography.fontWeight.extrabold,
  },
  body: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  detailBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    gap: spacing[1],
  },
  detailLine: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  checkboxWrap: {
    marginTop: spacing[1],
  },
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[2],
  },
  cancelBtn: {
    flex: 1,
    height: layout.buttonHeightMd,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onSurfaceVariant,
  },
  agreeBtn: {
    flex: 1,
    height: layout.buttonHeightMd,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  agreeBtnDisabled: {
    backgroundColor: colors.secondaryContainer,
    shadowOpacity: 0,
    elevation: 0,
  },
  agreeBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onPrimary,
  },
});

// ---------------------------------------------------------------------------
// Add document modal
// ---------------------------------------------------------------------------

interface AddDocModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (doc: StoredDocument) => void;
}

type PickedFile = {
  uri: string;
  mimeType: string | null;
  name: string;
  extension: string;
};

function AddDocModal({ visible, onClose, onAdd }: AddDocModalProps) {
  const { user } = useAuthStore();
  const hasHealthInsuranceConsent = useConsentStore((s) => s.hasHealthInsuranceConsent());
  const agreeHealthInsurance = useConsentStore((s) => s.agreeHealthInsurance);
  const [selectedType, setSelectedType] = useState<DocumentType>("resident_register");
  const [issuedDate, setIssuedDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** Raw camera URI waiting for scan-preview processing */
  const [scanRawUri, setScanRawUri] = useState<string | null>(null);
  /** B: 건강보험 민감정보 별도동의 모달 표시 여부 */
  const [showHealthConsentModal, setShowHealthConsentModal] = useState(false);
  /** C: "주민등록번호 뒷자리가 가려진 서류입니다" 업로드 직전 확인 체크박스 */
  const [maskingConfirmed, setMaskingConfirmed] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;

  /** C: this document type carries RRN risk AND a file is actually attached */
  const requiresMaskingConfirm = !!pickedFile && !!RRN_MASKING_INFO[selectedType];

  // The masking guidance card + confirmation checkbox add variable-height
  // content to this sheet, so it needs to scroll instead of relying on
  // intrinsic sizing (which could push the save button off-screen on
  // smaller devices).
  const { height: windowHeight } = useWindowDimensions();
  const sheetMaxHeight = windowHeight * 0.86;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible, slideAnim]);

  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("카메라 권한 필요", "카메라 접근 권한을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      // Keep original quality; expo-image-manipulator will compress to 80%
      quality: 1,
      allowsEditing: false,
      exif: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      // Open scan-preview modal instead of immediately setting pickedFile
      setScanRawUri(asset.uri);
    }
  }

  function handleScanConfirm(processedUri: string) {
    setScanRawUri(null);
    setMaskingConfirmed(false);
    setPickedFile({
      uri: processedUri,
      mimeType: "image/jpeg",
      name: DOC_TYPE_CONFIG[selectedType].label,
      extension: "jpg",
    });
  }

  function handleScanRetake() {
    setScanRawUri(null);
    // Re-open camera immediately
    handleCamera();
  }

  async function handleGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("사진 라이브러리 권한 필요", "사진 접근 권한을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() ?? "jpg";
      setMaskingConfirmed(false);
      setPickedFile({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
        name: DOC_TYPE_CONFIG[selectedType].label,
        extension: ext,
      });
    }
  }

  async function handleFilePicker() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const ext = (asset.name ?? "file").split(".").pop() ?? "pdf";
      setMaskingConfirmed(false);
      setPickedFile({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "application/pdf",
        name: asset.name ?? DOC_TYPE_CONFIG[selectedType].label,
        extension: ext,
      });
    }
  }

  function showAddOptions() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["취소", "카메라 촬영", "갤러리에서 선택", "파일(PDF) 선택"],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) handleCamera();
          else if (index === 2) handleGallery();
          else if (index === 3) handleFilePicker();
        }
      );
    } else {
      Alert.alert("서류 추가 방법", "", [
        { text: "카메라 촬영", onPress: handleCamera },
        { text: "갤러리에서 선택", onPress: handleGallery },
        { text: "파일(PDF) 선택", onPress: handleFilePicker },
        { text: "취소", style: "cancel" },
      ]);
    }
  }

  /**
   * B: 건강보험 자격득실확인서를 "업로드하려 할 때만" 민감정보 별도동의를 요구한다.
   * 이미 동의했거나 다른 서류 종류라면 곧바로 실제 파일 선택 액션시트를 연다.
   * 거부해도 다른 서류 종류의 보관 기능은 전혀 영향받지 않는다 — 끼워팔기 금지.
   */
  function handleAttachPress() {
    if (selectedType === "health_insurance" && !hasHealthInsuranceConsent) {
      setShowHealthConsentModal(true);
      return;
    }
    showAddOptions();
  }

  async function handleHealthConsentAgree() {
    await agreeHealthInsurance();
    setShowHealthConsentModal(false);
    showAddOptions();
  }

  async function handleSave() {
    // C: RRN 마스킹 확인 체크박스 미체크 시 업로드(파일 저장) 불가
    if (requiresMaskingConfirm && !maskingConfirmed) {
      Alert.alert(
        "확인이 필요해요",
        "주민등록번호 뒷자리가 가려진 서류인지 확인 후 체크박스에 체크해주세요."
      );
      return;
    }

    setIsSaving(true);
    try {
      const id = generateId();
      let fileUri: string | null = null;
      let mimeType: string | null = null;
      let encrypted = false;

      if (pickedFile) {
        if (!user?.id) {
          Alert.alert(
            "로그인 필요",
            "서류를 안전하게 암호화하려면 로그인이 필요합니다. 로그인 후 다시 시도해주세요.",
            [{ text: "확인" }]
          );
          setIsSaving(false);
          return;
        }

        const result = await persistFile(
          pickedFile.uri,
          id,
          pickedFile.extension,
          user.id
        );
        fileUri = result.fileUri;
        encrypted = result.encrypted;
        mimeType = pickedFile.mimeType;
      }

      const doc: StoredDocument = {
        id,
        type: selectedType,
        name: DOC_TYPE_CONFIG[selectedType].label,
        fileUri,
        mimeType,
        issuedAt: new Date(issuedDate).toISOString(),
        expiresAt: null,
        addedAt: new Date().toISOString(),
        note: null,
        encrypted,
      };

      onAdd(doc);
      // Reset form
      setPickedFile(null);
      setSelectedType("resident_register");
      setIssuedDate(new Date().toISOString().split("T")[0]);
      setMaskingConfirmed(false);
    } catch (err) {
      Alert.alert("저장 실패", "서류를 저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleClose() {
    setPickedFile(null);
    setScanRawUri(null);
    setMaskingConfirmed(false);
    onClose();
  }

  const saveDisabled = isSaving || (requiresMaskingConfirm && !maskingConfirmed);

  return (
    <>
      <ScanPreviewModal
        rawUri={scanRawUri}
        onRetake={handleScanRetake}
        onConfirm={handleScanConfirm}
      />
      <HealthInsuranceConsentModal
        visible={showHealthConsentModal}
        onCancel={() => setShowHealthConsentModal(false)}
        onAgree={handleHealthConsentAgree}
      />
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
      <Pressable style={modalStyles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            modalStyles.sheet,
            { maxHeight: sheetMaxHeight },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Drag handle */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={modalStyles.sheetInner}
          >
            <View style={modalStyles.handle} />

            <Text style={modalStyles.sheetTitle}>서류 추가</Text>

            <ScrollView
              style={modalStyles.fieldsScroll}
              contentContainerStyle={modalStyles.fieldsScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Document type selector */}
              <Text style={modalStyles.fieldLabel}>서류 종류</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={modalStyles.typeScrollContent}
                style={modalStyles.typeScroll}
              >
                {DOCUMENT_TYPE_OPTIONS.map((type) => {
                  const cfg = DOC_TYPE_CONFIG[type];
                  const isSelected = selectedType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        modalStyles.typeChip,
                        isSelected && modalStyles.typeChipSelected,
                        { borderColor: isSelected ? cfg.accentColor : "transparent" },
                      ]}
                      onPress={() => setSelectedType(type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={cfg.label}
                    >
                      <Text
                        style={[
                          modalStyles.typeChipText,
                          isSelected && { color: cfg.accentColor },
                        ]}
                      >
                        {cfg.shortLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* C: 주민번호 마스킹 발급 가이드 — 서류 종류 선택 직후, 실제 발급받으러
                  가기 전에 보이도록 배치 */}
              <MaskingGuidanceCard type={selectedType} />

              {/* Issued date — simple text representation (date picker is platform-specific;
                  a full DateTimePicker is a future enhancement) */}
              <Text style={modalStyles.fieldLabel}>발급일</Text>
              <View style={modalStyles.dateDisplay}>
                <Text style={modalStyles.dateDisplayText}>
                  {issuedDate}
                </Text>
              </View>

              {/* File picker area */}
              <Text style={modalStyles.fieldLabel}>파일 첨부 (선택)</Text>
              <TouchableOpacity
                style={[
                  modalStyles.filePicker,
                  pickedFile && modalStyles.filePickerFilled,
                ]}
                onPress={handleAttachPress}
                accessibilityRole="button"
                accessibilityLabel={pickedFile ? "첨부 파일 변경" : "파일 또는 사진 추가"}
              >
                <Text style={modalStyles.filePickerIcon}>
                  {pickedFile ? "✓" : "+"}
                </Text>
                <Text style={modalStyles.filePickerText}>
                  {pickedFile
                    ? pickedFile.name
                    : "카메라 촬영 · 갤러리 · PDF 선택"}
                </Text>
              </TouchableOpacity>

              {/* C: 업로드 직전 확인 체크박스 — 파일이 첨부되고, 주민번호 위험이 있는
                  서류 종류일 때만 노출. 미체크 시 handleSave에서 저장을 막는다. */}
              {requiresMaskingConfirm && (
                <View style={modalStyles.maskingCheckWrap}>
                  <AgreementCheckbox
                    checked={maskingConfirmed}
                    onToggle={() => setMaskingConfirmed((v) => !v)}
                    label="주민등록번호 뒷자리가 가려진 서류입니다"
                    requirement="required"
                  />
                </View>
              )}
            </ScrollView>

            {/* Action buttons */}
            <View style={modalStyles.actions}>
              <TouchableOpacity
                style={modalStyles.cancelBtn}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="취소"
              >
                <Text style={modalStyles.cancelBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.saveBtn, saveDisabled && modalStyles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saveDisabled}
                accessibilityRole="button"
                accessibilityLabel="서류 저장하기"
                accessibilityState={{ disabled: saveDisabled }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={modalStyles.saveBtnText}>저장하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
    </>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: borderRadius["2xl"],
    borderTopRightRadius: borderRadius["2xl"],
    ...shadows.floating,
  },
  sheetInner: {
    flex: 1,
    padding: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  fieldsScroll: {
    flex: 1,
  },
  fieldsScrollContent: {
    gap: spacing[3],
    paddingBottom: spacing[2],
  },
  maskingCheckWrap: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    alignSelf: "center",
    marginBottom: spacing[2],
  },
  sheetTitle: {
    ...typography.styles.sectionTitle,
    fontWeight: typography.fontWeight.extrabold,
    marginBottom: spacing[1],
  },
  fieldLabel: {
    ...typography.styles.bodySm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing[2],
  },
  typeScroll: {
    marginHorizontal: -spacing[1],
  },
  typeScrollContent: {
    gap: spacing[2],
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[1],
  },
  typeChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1.5,
    minHeight: layout.touchTargetMin - 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typeChipSelected: {
    backgroundColor: colors.primaryFixed,
  },
  typeChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  dateDisplay: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    minHeight: layout.inputHeight,
    justifyContent: "center",
  },
  dateDisplayText: {
    ...typography.styles.inputText,
    color: colors.onSurface,
  },
  filePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: layout.touchTargetMin + spacing[2],
  },
  filePickerFilled: {
    backgroundColor: colors.primaryFixed,
  },
  filePickerIcon: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: typography.fontWeight.bold,
  },
  filePickerText: {
    flex: 1,
    ...typography.styles.bodySm,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[4],
  },
  cancelBtn: {
    flex: 1,
    height: layout.buttonHeightMd,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onSurfaceVariant,
  },
  saveBtn: {
    flex: 2,
    height: layout.buttonHeightMd,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  saveBtnDisabled: {
    backgroundColor: colors.secondaryContainer,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    ...typography.styles.buttonLabel,
    color: colors.onPrimary,
  },
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyVault({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={emptyStyles.root}>
      <View style={emptyStyles.iconWrap}>
        <Text style={emptyStyles.icon}>📂</Text>
      </View>
      <Text style={emptyStyles.title}>보관 중인 서류가 없어요</Text>
      <Text style={emptyStyles.body}>
        자주 쓰는 서류를 미리 추가해두면{"\n"}혜택 신청 시 바로 활용할 수 있어요
      </Text>
      <TouchableOpacity
        style={emptyStyles.btn}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="첫 서류 추가하기"
      >
        <Text style={emptyStyles.btnText}>첫 서류 추가하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  root: {
    alignItems: "center",
    paddingVertical: spacing[12],
    gap: spacing[3],
    paddingHorizontal: spacing[8],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  icon: {
    fontSize: 32,
  },
  title: {
    ...typography.styles.sectionTitle,
    textAlign: "center",
  },
  body: {
    ...typography.styles.bodySm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    marginTop: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[7],
    height: layout.buttonHeightSm,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  btnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onPrimary,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function DocumentVaultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    if (!user) return;
    loadDocuments().then((docs) => {
      setDocuments(docs);
      setIsLoading(false);
    });
  }, [user]);

  const handleAdd = useCallback(async (doc: StoredDocument) => {
    setDocuments((prev) => {
      const next = [doc, ...prev];
      saveDocuments(next); // fire-and-forget
      return next;
    });
    setShowAddModal(false);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDocuments((prev) => {
      const target = prev.find((d) => d.id === id);
      const next = prev.filter((d) => d.id !== id);
      saveDocuments(next);

      // Best-effort cleanup of the file
      if (target?.fileUri) {
        FileSystem.deleteAsync(target.fileUri, { idempotent: true }).catch(() => {});
      }
      return next;
    });
  }, []);

  const matchedBenefits = getMatchedBenefits(documents);

  const renewalCount = documents.filter((d) => {
    const s = computeStatus(d);
    return s === "renewal_needed" || s === "expiring_soon";
  }).length;

  const bottomPad = Math.max(insets.bottom, spacing[4]) + spacing[10];

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : spacing[5] }]}>
          <View style={styles.headerInner}>
            <TouchableOpacity
              style={styles.headerBackBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
            >
              <Text style={styles.headerBackArrow}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>서류 보관함</Text>
            </View>
            <View style={styles.headerBackBtn} />
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.onSurface, marginBottom: 8 }}>
            로그인이 필요해요
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
            서류 보관함을 사용하려면 로그인해주세요.
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

  return (
    <View style={styles.root}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top > 0 ? insets.top : spacing[5] },
        ]}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="뒤로 가기"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.headerBackArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>내 서류 보관함</Text>
            {renewalCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{renewalCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerBackBtn} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          {/* Renewal alert banner */}
          {renewalCount > 0 && (
            <View style={styles.renewalBanner}>
              <Text style={styles.renewalBannerText}>
                갱신이 필요한 서류 {renewalCount}건이 있어요
              </Text>
            </View>
          )}

          {/* Statistics strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>{documents.length}</Text>
              <Text style={styles.statLabel}>보관 서류</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>
                {documents.filter((d) => computeStatus(d) === "valid").length}
              </Text>
              <Text style={styles.statLabel}>유효</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statNumber, renewalCount > 0 && styles.statNumberWarning]}>
                {renewalCount}
              </Text>
              <Text style={styles.statLabel}>갱신 필요</Text>
            </View>
          </View>

          {/* Documents list */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>보관 서류</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddModal(true)}
              accessibilityRole="button"
              accessibilityLabel="서류 추가하기"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={styles.addBtnText}>+ 추가</Text>
            </TouchableOpacity>
          </View>

          {documents.length === 0 ? (
            <EmptyVault onAdd={() => setShowAddModal(true)} />
          ) : (
            <View style={styles.docList}>
              {documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
              ))}
            </View>
          )}

          {/* Benefit matching section — only shown when there are docs */}
          {documents.length > 0 && (
            <>
              {/* Section divider via tonal background shift */}
              <View style={styles.sectionStrip} />

              <View style={styles.benefitSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>내 서류로 신청 가능한 혜택</Text>
                </View>

                {matchedBenefits.length === 0 ? (
                  <View style={styles.benefitEmpty}>
                    <Text style={styles.benefitEmptyText}>
                      현재 보관 중인 서류로 바로 신청 가능한 혜택이 없어요.
                      {"\n"}서류를 더 추가하면 더 많은 혜택을 매칭해드려요.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.benefitCard}>
                    <View style={styles.benefitMatchHeader}>
                      <Text style={styles.benefitMatchCount}>
                        이 서류로 바로 신청 가능한 혜택 {matchedBenefits.length}건
                      </Text>
                    </View>
                    {matchedBenefits.map((b, i) => (
                      <React.Fragment key={b.title}>
                        {i > 0 && <View style={styles.benefitRowDivider} />}
                        <BenefitMatchCard benefit={b} />
                      </React.Fragment>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* Encryption status note */}
          <View style={styles.todoNote}>
            <Text style={styles.todoNoteText}>
              서류 파일은 기기 내에서 AES-256 암호화되어 저장되며, 서버로 전송되지
              않아요. 회사는 서류의 평문 내용을 열람할 수 없습니다.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* FAB — add document */}
      {documents.length > 0 && (
        <View
          style={[
            styles.fab,
            { bottom: Math.max(insets.bottom, spacing[4]) + spacing[4] },
          ]}
        >
          <TouchableOpacity
            style={styles.fabBtn}
            onPress={() => setShowAddModal(true)}
            accessibilityRole="button"
            accessibilityLabel="서류 추가하기"
          >
            <Text style={styles.fabBtnText}>+ 서류 추가</Text>
          </TouchableOpacity>
        </View>
      )}

      <AddDocModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
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

  // Header
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
  headerBackBtn: {
    minWidth: layout.touchTargetMin,
    minHeight: layout.touchTargetMin,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBackArrow: {
    fontSize: 22,
    color: colors.onSurface,
    fontWeight: typography.fontWeight.semibold,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  headerBadge: {
    backgroundColor: "#fce7f3",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  headerBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: "#9d174d",
  },

  scroll: {
    flex: 1,
  },

  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Renewal banner
  renewalBanner: {
    backgroundColor: "#fce7f3",
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  renewalBannerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: "#9d174d",
  },

  // Statistics strip
  statsStrip: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerLowest,
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[5],
    ...shadows.card,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: spacing[1],
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.surfaceContainerHigh,
    alignSelf: "center",
  },
  statNumber: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    letterSpacing: typography.letterSpacing.tight,
  },
  statNumberWarning: {
    color: "#9d174d",
  },
  statLabel: {
    ...typography.styles.caption,
    color: colors.textMuted,
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
  },
  sectionTitle: {
    ...typography.styles.sectionTitle,
  },
  addBtn: {
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },

  // Document list
  docList: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },

  // Section strip (tonal divider, No-Line Rule)
  sectionStrip: {
    height: spacing[3],
    backgroundColor: colors.surfaceContainerLow,
    marginTop: spacing[6],
  },

  // Benefit matching
  benefitSection: {
    paddingHorizontal: spacing[4],
  },
  benefitCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    ...shadows.cardMd,
  },
  benefitMatchHeader: {
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  benefitMatchCount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  benefitRowDivider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
  },
  benefitEmpty: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    ...shadows.card,
  },
  benefitEmptyText: {
    ...typography.styles.bodySm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // TODO note
  todoNote: {
    marginHorizontal: spacing[5],
    marginTop: spacing[6],
    padding: spacing[4],
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
  },
  todoNoteText: {
    ...typography.styles.caption,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: "center",
  },

  // FAB
  fab: {
    position: "absolute",
    left: spacing[5],
    right: spacing[5],
    alignItems: "center",
  },
  fabBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[8],
    height: layout.buttonHeightMd,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  fabBtnText: {
    ...typography.styles.buttonLabel,
    color: colors.onPrimary,
  },
});
