/**
 * components/AgreementCheckbox.tsx — 동의 체크박스 행
 *
 * app/consent.tsx (필수동의 게이트)와 app/document-vault.tsx (민감정보 별도동의,
 * 주민번호 마스킹 확인)에서 공유하는 체크박스 UI. 기존 preCheckCheckbox 패턴
 * (app/programs/[id].tsx)과 동일한 시각 언어를 사용한다.
 */

import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing, borderRadius, layout } from "@/constants/theme";

interface AgreementCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  /** Shows a red "[필수]" / gray "[선택]" tag before the label */
  requirement?: "required" | "optional";
  /** Optional "보기" link rendered at the row's end (e.g. opens full policy text) */
  onPressDetail?: () => void;
  detailLabel?: string;
  /** Larger, bolder row used for "모두 동의" convenience toggles */
  emphasized?: boolean;
}

export function AgreementCheckbox({
  checked,
  onToggle,
  label,
  requirement,
  onPressDetail,
  detailLabel = "보기",
  emphasized = false,
}: AgreementCheckboxProps) {
  return (
    <View style={[styles.row, emphasized && styles.rowEmphasized]}>
      <Pressable
        style={styles.pressArea}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <View style={[styles.box, checked && styles.boxChecked, emphasized && styles.boxLg]}>
          {checked && (
            <Ionicons name="checkmark" size={emphasized ? 15 : 13} color={colors.onPrimary} />
          )}
        </View>
        <View style={styles.labelWrap}>
          {requirement && (
            <Text
              style={[
                styles.requirementTag,
                requirement === "required" ? styles.requirementRequired : styles.requirementOptional,
              ]}
            >
              {requirement === "required" ? "[필수] " : "[선택] "}
            </Text>
          )}
          <Text style={[styles.label, emphasized && styles.labelEmphasized]}>{label}</Text>
        </View>
      </Pressable>

      {onPressDetail && (
        <Pressable
          onPress={onPressDetail}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.detailBtn}
          accessibilityRole="link"
          accessibilityLabel={`${label} ${detailLabel}`}
        >
          <Text style={styles.detailBtnText}>{detailLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.touchTargetMin,
    paddingVertical: spacing[1],
  },
  rowEmphasized: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    marginBottom: spacing[1],
  },
  pressArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing[3],
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerLowest,
    flexShrink: 0,
  },
  boxLg: {
    width: 26,
    height: 26,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  labelWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  requirementTag: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  requirementRequired: {
    color: colors.error,
  },
  requirementOptional: {
    color: colors.textMuted,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurface,
    lineHeight: 20,
  },
  labelEmphasized: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  detailBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing[2],
  },
  detailBtnText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});

export default AgreementCheckbox;
