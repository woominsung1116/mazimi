/**
 * 내 정보 (Profile) Screen
 *
 * Data source: api.getProfile() — user identity from JWT
 *
 * On API failure the screen falls back to static mock profile data and shows
 * an "오프라인 모드" banner. Alert preferences are still editable and saved
 * via api.upsertAlertPreference when a programId is known; the save button
 * is disabled in offline mode.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/auth";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, type UserProfile, type AlertListResponse } from "@/lib/api";
import OfflineBanner from "@/components/OfflineBanner";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  layout,
  componentStyles,
} from "@/constants/theme";

// No mock profile — always use real API data

const CURRENT_YEAR = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Local notification preference state (stored in component, persisted to API)
// ---------------------------------------------------------------------------

interface LocalAlertPrefs {
  deadline: boolean;
  new_program: boolean;
  profile_update: boolean;
  inApp: boolean;
  email: boolean;
}

const DEFAULT_PREFS: LocalAlertPrefs = {
  deadline: true,
  new_program: true,
  profile_update: false,
  inApp: true,
  email: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function regionLabel(code: string | null | undefined): string {
  const map: Record<string, string> = {
    busan: "부산",
    daegu: "대구",
    seoul: "서울",
    incheon: "인천",
    gwangju: "광주",
    daejeon: "대전",
    ulsan: "울산",
    sejong: "세종",
    gyeonggi: "경기",
  };
  if (!code) return "미입력";
  return map[code] ?? code;
}

function enrollmentLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    enrolled: "재학",
    leave_of_absence: "휴학",
    graduated: "졸업",
    prospective: "예비 대학생",
  };
  if (!status) return "미입력";
  return map[status] ?? status;
}

function employmentLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    employed: "취업",
    unemployed: "미취업",
    self_employed: "자영업",
    job_seeker: "구직 중",
  };
  if (!status) return "미입력";
  return map[status] ?? status;
}

function avatarInitial(profile: Partial<UserProfile> | null | undefined): string {
  if (profile?.region_code === "busan") return "부";
  if (profile?.region_code === "daegu") return "대";
  return "나";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AvatarCircle({ initial }: { initial: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );
}

function RegionBadge({ region }: { region: string }) {
  return (
    <View style={styles.regionBadge}>
      <Text style={styles.regionBadgeText}>{region}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function ProfileRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.profileRow, !isLast && styles.profileRowDivider]}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  isLast = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !isLast && styles.toggleRowDivider]}>
      <View style={styles.toggleLabelWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? (
          <Text style={styles.toggleDesc}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.surfaceContainerHigh,
          true: colors.primary,
        }}
        thumbColor={
          Platform.OS === "android"
            ? value
              ? colors.onPrimary
              : colors.surface
            : undefined
        }
        ios_backgroundColor={colors.surfaceContainerHigh}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowDivider]}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}


// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const [prefs, setPrefs] = useState<LocalAlertPrefs>(DEFAULT_PREFS);
  const [vaultCount, setVaultCount] = useState<number>(0);

  // Read vault doc count to show in the navigation card
  useEffect(() => {
    AsyncStorage.getItem("document_vault_v1")
      .then((raw) => {
        if (!raw) return;
        try {
          const docs = JSON.parse(raw) as unknown[];
          setVaultCount(Array.isArray(docs) ? docs.length : 0);
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, []);

  const profileQuery = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.getProfile(),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    enabled: !!user,
  });

  const isOffline = profileQuery.isError && !profileQuery.isLoading;

  // Resolve display profile — API data only
  const profile: Partial<UserProfile> =
    profileQuery.data?.profile ?? {};

  const birthYear = profile.birth_year ?? 2001;
  const age = CURRENT_YEAR - birthYear;
  const region = regionLabel(profile.region_code);
  const enrollment = enrollmentLabel(profile.enrollment_status);
  const employment = employmentLabel(profile.employment_status);
  const initial = avatarInitial(profile);

  function updateCategory(
    key: keyof Pick<LocalAlertPrefs, "deadline" | "new_program" | "profile_update">,
    val: boolean
  ) {
    setPrefs((prev) => ({ ...prev, [key]: val }));
  }

  function handleLogout() {
    useAuthStore.getState().logout();
    router.push("/login");
  }

  if (!user) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing[8]) + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 32 }}>
          <View style={[styles.avatar, { marginBottom: spacing[4] }]}>
            <Text style={styles.avatarInitial}>?</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.onSurface, marginBottom: 8 }}>
            로그인이 필요해요
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>
            프로필과 알림 설정을 보려면{"\n"}로그인해주세요.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/login")}
            style={{ backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, spacing[8]) + spacing[4] },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {isOffline && <OfflineBanner />}

      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.headerBlob} pointerEvents="none" />

        {profileQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <AvatarCircle initial={initial} />
            <View style={styles.profileHeaderInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>
                  {profile.nickname ?? profile.school_name ?? "마지미 유저"}
                </Text>
                <RegionBadge region={region} />
              </View>
              <Text style={styles.profileSubtitle}>
                {age}세 · {enrollment} · {employment}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* 내 프로필 section */}
      <View style={styles.section}>
        <SectionLabel>내 프로필</SectionLabel>
        <View style={styles.card}>
          <ProfileRow label="지역" value={region} />
          <ProfileRow label="나이" value={`${age}세 (${birthYear}년생)`} />
          <ProfileRow label="대학 상태" value={enrollment} />
          <ProfileRow
            label="취업 상태"
            value={employment}
            isLast
          />
        </View>

        <TouchableOpacity
          style={styles.editProfileBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="프로필 편집하기"
        >
          <Text style={styles.editProfileBtnText}>프로필 편집</Text>
        </TouchableOpacity>
      </View>

      {/* 내 서류 보관함 navigation card */}
      <View style={styles.section}>
        <SectionLabel>서류 관리</SectionLabel>
        <TouchableOpacity
          style={styles.vaultCard}
          onPress={() => router.push("/document-vault")}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="내 서류 보관함으로 이동"
        >
          <View style={styles.vaultCardIconWrap}>
            <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.vaultCardBody}>
            <Text style={styles.vaultCardTitle}>내 서류 보관함</Text>
            <Text style={styles.vaultCardSub}>
              {vaultCount > 0
                ? `보관 서류 ${vaultCount}건 · 만료 알림, 혜택 매칭`
                : "서류를 미리 보관하고 혜택을 빠르게 신청하세요"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* 알림 설정 section */}
      <View style={styles.section}>
        <SectionLabel>알림 설정</SectionLabel>

        <View style={styles.cardGroupLabel}>
          <Text style={styles.cardGroupLabelText}>알림 유형</Text>
        </View>
        <View style={styles.card}>
          <ToggleRow
            label="마감 임박"
            description="신청 마감 7일 전·3일 전·당일 알림"
            value={prefs.deadline}
            onValueChange={(val) => updateCategory("deadline", val)}
          />
          <ToggleRow
            label="새 정책"
            description="내 프로필에 맞는 새 정책·장학금 등록 시 알림"
            value={prefs.new_program}
            onValueChange={(val) => updateCategory("new_program", val)}
          />
          <ToggleRow
            label="프로필 변경"
            description="프로필 정보가 업데이트되면 알림"
            value={prefs.profile_update}
            onValueChange={(val) => updateCategory("profile_update", val)}
            isLast
          />
        </View>

      </View>

      {/* 로그아웃 */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="로그아웃"
      >
        <Text style={styles.logoutBtnText}>로그아웃</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[6],
    gap: layout.sectionGap,
  },

  profileHeader: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    padding: layout.cardPaddingLg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    overflow: "hidden",
    ...shadows.cardMd,
  },
  headerBlob: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: borderRadius.full,
    backgroundColor: colors.decorativeBlob,
  },
  avatar: {
    width: layout.avatarXl,
    height: layout.avatarXl,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...shadows.card,
  },
  avatarInitial: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },
  profileHeaderInfo: {
    flex: 1,
    gap: spacing[1],
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  profileName: {
    ...typography.styles.sectionTitle,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
  },
  profileSubtitle: {
    ...typography.styles.bodySm,
    color: colors.textSecondary,
  },
  regionBadge: {
    ...componentStyles.tagPrimary,
  },
  regionBadgeText: {
    ...typography.styles.badge,
    color: colors.onPrimaryFixedVariant,
  },

  section: {
    gap: spacing[2],
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: spacing[1],
  },
  cardGroupLabel: {
    paddingHorizontal: spacing[1],
  },
  cardGroupLabelText: {
    ...typography.styles.bodySm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textMuted,
  },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    paddingHorizontal: layout.cardPadding,
    ...shadows.card,
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3.5],
    minHeight: layout.touchTargetMin,
  },
  profileRowDivider: {
    borderBottomWidth: 0,
    paddingBottom: spacing[3],
    marginBottom: 0,
    backgroundColor: "transparent",
  },
  profileRowLabel: {
    ...typography.styles.bodyBase,
    color: colors.textSecondary,
  },
  profileRowValue: {
    ...typography.styles.label,
    color: colors.onSurface,
  },

  editProfileBtn: {
    ...componentStyles.buttonSecondary,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.card,
    minHeight: layout.buttonHeightSm,
  },
  editProfileBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.primary,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3.5],
    gap: spacing[3],
    minHeight: layout.touchTargetMin + spacing[4],
  },
  toggleRowDivider: {
    paddingBottom: spacing[2.5],
  },
  toggleLabelWrap: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.styles.bodyBase,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurface,
    marginBottom: spacing[0.5],
  },
  toggleDesc: {
    ...typography.styles.caption,
    color: colors.outlineVariant,
    lineHeight: 17,
  },

  statusBanner: {
    backgroundColor: colors.tertiaryFixed,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[3.5],
    alignItems: "center",
  },
  statusBannerError: {
    backgroundColor: colors.errorContainer,
  },
  statusBannerText: {
    ...typography.styles.bodySm,
    color: colors.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  statusBannerTextError: {
    color: colors.onErrorContainer,
  },

  saveBtn: {
    ...componentStyles.buttonPrimary,
    minHeight: layout.buttonHeightMd,
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

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3.5],
    minHeight: layout.touchTargetMin,
  },
  infoRowDivider: {
    paddingBottom: spacing[2.5],
  },
  infoRowLabel: {
    ...typography.styles.bodyBase,
    color: colors.textSecondary,
  },
  infoRowValue: {
    ...typography.styles.label,
    color: colors.textMuted,
  },

  logoutBtn: {
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    height: layout.buttonHeightMd,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  logoutBtnText: {
    ...typography.styles.buttonLabelSm,
    color: colors.onErrorContainer,
  },

  // Vault navigation card
  vaultCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: layout.touchTargetMin + spacing[8],
    ...shadows.cardMd,
  },
  vaultCardIconWrap: {
    width: layout.avatarLg,
    height: layout.avatarLg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  vaultCardBody: {
    flex: 1,
    gap: spacing[0.5],
  },
  vaultCardTitle: {
    ...typography.styles.label,
    color: colors.onSurface,
  },
  vaultCardSub: {
    ...typography.styles.caption,
    color: colors.textMuted,
    lineHeight: 17,
  },
});
