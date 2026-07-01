/**
 * app/consent.tsx — 앱 최초 실행 필수 동의 게이트
 *
 * app/_layout.tsx의 <Stack.Protected guard={!hasRequiredConsent}>가 이 화면만
 * 노출시키고 그 외 모든 라우트(홈/로그인/온보딩 등)를 차단한다. 두 필수 항목
 * (이용약관, 개인정보 수집·이용)에 모두 체크해야 "동의하고 시작하기"가 활성화된다.
 *
 * ⚠️ 포괄동의 금지: 이 화면에는 민감정보(건강보험 서류)·마케팅 동의를 절대 함께
 * 넣지 않는다. 그런 항목은 실제로 필요한 시점(document-vault.tsx 업로드 시)에
 * 별도로 받는다 — store/consent.ts의 agreeHealthInsurance 참고.
 */

import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AgreementCheckbox } from "@/components/AgreementCheckbox";
import { useConsentStore } from "@/store/consent";
import { colors, typography, spacing, borderRadius, layout, shadows } from "@/constants/theme";

export default function ConsentGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const agreeRequired = useConsentStore((s) => s.agreeRequired);

  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  const allChecked = termsChecked && privacyChecked;

  function toggleAll() {
    const next = !allChecked;
    setTermsChecked(next);
    setPrivacyChecked(next);
  }

  async function handleContinue() {
    if (!termsChecked || !privacyChecked) return;
    await agreeRequired();
    // hasRequiredConsent() flips true → Stack.Protected in _layout.tsx
    // automatically reveals (tabs)/login/etc. Land on the default tab.
    router.replace("/(tabs)");
  }

  return (
    <View style={styles.root}>
      <View style={styles.blob} pointerEvents="none" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing[10], paddingBottom: spacing[6] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoLetter}>마</Text>
          </LinearGradient>
          <Text style={styles.title}>서비스 이용을 위해{"\n"}약관 동의가 필요해요</Text>
          <Text style={styles.subtitle}>
            아래 필수 항목에 동의하셔야{"\n"}마지미를 이용하실 수 있어요.
          </Text>
        </View>

        <View style={styles.card}>
          <AgreementCheckbox
            checked={allChecked}
            onToggle={toggleAll}
            label="모두 동의합니다"
            emphasized
          />

          <View style={styles.divider} />

          <AgreementCheckbox
            checked={termsChecked}
            onToggle={() => setTermsChecked((v) => !v)}
            label="이용약관 동의"
            requirement="required"
            onPressDetail={() => router.push("/terms")}
          />
          <AgreementCheckbox
            checked={privacyChecked}
            onToggle={() => setPrivacyChecked((v) => !v)}
            label="개인정보 수집 및 이용 동의"
            requirement="required"
            onPressDetail={() => router.push("/privacy-policy")}
          />
        </View>

        <View style={styles.noteRow}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText}>
            건강보험 등 민감정보 서류는 서류보관함에서 실제 업로드할 때 별도로 동의를 받아요.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.ctaWrapper, { paddingBottom: insets.bottom + spacing[4] }]}>
        <LinearGradient
          colors={
            allChecked
              ? [colors.primary, colors.primaryContainer]
              : [colors.surfaceContainerHigh, colors.surfaceContainerHigh]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaGradient}
        >
          <TouchableOpacity
            style={styles.ctaTouchable}
            onPress={handleContinue}
            disabled={!allChecked}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="동의하고 시작하기"
            accessibilityState={{ disabled: !allChecked }}
          >
            <Text style={[styles.ctaLabel, !allChecked && styles.ctaLabelDisabled]}>
              동의하고 시작하기
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  blob: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: colors.decorativeBlob,
  },
  content: {
    paddingHorizontal: layout.pagePadding + spacing[2],
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing[8],
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
    ...shadows.primaryButton,
  },
  logoLetter: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.onPrimary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
    textAlign: "center",
    lineHeight: typography.fontSize["2xl"] * 1.3,
    marginBottom: spacing[3],
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    gap: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
    marginVertical: spacing[2],
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
    marginTop: spacing[4],
    paddingHorizontal: spacing[1],
  },
  noteText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },

  ctaWrapper: {
    paddingHorizontal: layout.pagePadding + spacing[2],
    paddingTop: spacing[3],
  },
  ctaGradient: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    ...shadows.primaryButton,
  },
  ctaTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: layout.buttonHeightLg,
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
