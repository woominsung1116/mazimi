/**
 * Onboarding Step 1 — Nickname Confirmation
 * Shows the Kakao nickname pre-filled, allows editing before proceeding.
 * Matches Stitch "Onboarding / Profile Setup" design exactly.
 */
import React, { useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "@/store/onboarding";
import { useAuthStore } from "@/store/auth";
import { colors, typography, borderRadius, layout } from "@/constants/theme";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;
const CURRENT_STEP = 1;
const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

// ─── Component ──────────────────────────────────────────────────────────────

export default function OnboardingNickname() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const { user } = useAuthStore();
  const { nickname, setNickname } = useOnboardingStore();

  // Pre-fill with Kakao nickname if store is empty
  useEffect(() => {
    if (nickname === "" && user?.nickname) {
      setNickname(user.nickname);
    }
  }, [nickname, user?.nickname, setNickname]);

  const canProceed = nickname.trim().length > 0;

  const handleNext = useCallback(() => {
    if (!canProceed) return;
    router.push("/onboarding/step1");
  }, [canProceed, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* Decorative blobs */}
        <View style={[styles.blobTopRight, { top: insets.top + 64 }]} />
        <View style={styles.blobBottomLeft} />

        {/* Glass header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
          >
            <Ionicons name="chevron-back" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerBrand}>마지미</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Progress indicator */}
          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressStepLabel}>STEP {CURRENT_STEP}/{TOTAL_STEPS}</Text>
              <Text style={styles.progressPctLabel}>{PROGRESS_PCT}% Completed</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${PROGRESS_PCT}%` }]} />
            </View>
          </View>

          {/* Question header */}
          <View style={styles.questionWrap}>
            <Text style={styles.questionTitle}>닉네임을{"\n"}확인해 주세요</Text>
            <Text style={styles.questionSubtitle}>
              카카오 닉네임으로 자동 설정됐어요.{"\n"}원하시면 바꿀 수 있어요.
            </Text>
          </View>

          {/* Profile image */}
          {user?.image ? (
            <View style={styles.avatarWrap}>
              <Image
                source={{ uri: user.image }}
                style={styles.avatar}
                accessibilityLabel="프로필 사진"
              />
            </View>
          ) : (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={40} color={colors.primary} />
              </View>
            </View>
          )}

          {/* Nickname input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>닉네임</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={[
                styles.inputWrapper,
                nickname.trim().length > 0 && styles.inputWrapperFilled,
              ]}
            >
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={nickname}
                onChangeText={setNickname}
                placeholder="닉네임을 입력하세요"
                placeholderTextColor={colors.outline}
                returnKeyType="done"
                maxLength={20}
                accessibilityLabel="닉네임 입력"
              />
              {nickname.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => setNickname("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="닉네임 지우기"
                >
                  <Ionicons name="close-circle" size={20} color={colors.outline} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Sticky gradient CTA */}
        <View style={[styles.ctaWrapper, { paddingBottom: insets.bottom + 16 }]}>
          <LinearGradient
            colors={
              canProceed
                ? [colors.primary, colors.primaryContainer]
                : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <TouchableOpacity
              style={styles.ctaTouchable}
              onPress={handleNext}
              disabled={!canProceed}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="다음 단계로 이동"
              accessibilityState={{ disabled: !canProceed }}
            >
              <Text style={[styles.ctaLabel, !canProceed && styles.ctaLabelDisabled]}>
                다음
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canProceed ? colors.onPrimary : colors.outline}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  blobTopRight: {
    position: "absolute",
    right: -80,
    width: 256,
    height: 256,
    borderRadius: 9999,
    backgroundColor: colors.decorativeBlob,
    zIndex: -1,
  },
  blobBottomLeft: {
    position: "absolute",
    bottom: 160,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 9999,
    backgroundColor: "rgba(202, 218, 255, 0.07)",
    zIndex: -1,
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    ...Platform.select({
      ios: {
        shadowColor: "#b6c7eb",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 120,
  },

  progressWrap: {
    marginBottom: 40,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  progressStepLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    letterSpacing: 1.5,
  },
  progressPctLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  progressTrack: {
    height: layout.progressBarHeight,
    borderRadius: 9999,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 9999,
    backgroundColor: colors.primary,
  },

  questionWrap: {
    marginBottom: 32,
  },
  questionTitle: {
    fontSize: typography.fontSize["3xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    lineHeight: typography.fontSize["3xl"] * 1.2,
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurfaceVariant,
    lineHeight: typography.fontSize.base * 1.5,
  },

  // Profile avatar
  avatarWrap: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 9999,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 9999,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },

  // Nickname input
  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 16,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.xl,
    paddingHorizontal: 20,
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#b6c7eb",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  inputWrapperFilled: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    paddingVertical: 18,
  },

  // CTA
  ctaWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  ctaGradient: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  ctaTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: layout.buttonHeightLg,
    paddingHorizontal: 24,
  },
  ctaLabel: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
  ctaLabelDisabled: {
    color: colors.outline,
  },
});
