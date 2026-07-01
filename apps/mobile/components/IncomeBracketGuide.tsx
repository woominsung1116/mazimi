/**
 * IncomeBracketGuide — "내 소득구간 모르겠어요" 가이드.
 *
 * 청년 유저가 자기 소득분위(중위소득 %)를 몰라서 프로필/추천 필터의 소득 입력에서
 * 막히는 문제를 풀기 위한 보조 계산기. 가구원수 + 가구 전체 월 소득을 입력하면
 * 기준 중위소득(보건복지부 고시, `constants/incomeMedian.ts`) 대비 대략적인 %와
 * 이 앱이 쓰는 1(최저)~10(최고) 소득분위 스케일로 매핑해 안내한다.
 *
 * 중요: 정확한 자격 판정이 아니라 "대략 이 구간" 참고용 — 실제 신청 시에는 각
 * 정책 공고의 소득 기준을 반드시 별도로 확인해야 한다는 문구를 항상 노출한다.
 *
 * 재사용: 온보딩(app/onboarding/step1.tsx)과 프로필(app/(tabs)/profile.tsx),
 * 탐색 필터 패널(components/FilterSheet.tsx)에서 공용으로 사용.
 */

import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  layout,
} from "@/constants/theme";
import { estimateIncomeBracket, type IncomeEstimate } from "@/constants/incomeMedian";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUSEHOLD_SIZE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IncomeBracketGuideProps {
  /** 계산된 소득분위를 부모에 적용할 때 호출 (예: setIncomeBracket). */
  onApply: (bracket: number, estimate: IncomeEstimate) => void;
  /** 처음부터 펼친 상태로 보여줄지 여부 (기본: 접힘, 트리거 버튼만 표시) */
  defaultExpanded?: boolean;
  /** 트리거 버튼 문구 커스텀 (기본: "내 소득구간 모르겠어요") */
  triggerLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncomeBracketGuide({
  onApply,
  defaultExpanded = false,
  triggerLabel = "내 소득구간 모르겠어요",
}: IncomeBracketGuideProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [householdSize, setHouseholdSize] = useState<number>(1);
  const [incomeInput, setIncomeInput] = useState(""); // 만원 단위 문자열
  const [applied, setApplied] = useState(false);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }, []);

  const monthlyIncomeWon = useMemo(() => {
    const parsed = parseFloat(incomeInput.replace(/[^0-9.]/g, ""));
    if (isNaN(parsed) || parsed < 0) return 0;
    return Math.round(parsed * 10_000);
  }, [incomeInput]);

  const estimate: IncomeEstimate | null = useMemo(() => {
    if (monthlyIncomeWon <= 0) return null;
    return estimateIncomeBracket(householdSize, monthlyIncomeWon);
  }, [householdSize, monthlyIncomeWon]);

  const handleApply = useCallback(() => {
    if (!estimate) return;
    onApply(estimate.bracket, estimate);
    setApplied(true);
  }, [estimate, onApply]);

  return (
    <View style={styles.root}>
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
        accessibilityState={{ expanded }}
      >
        <View style={styles.triggerIconWrap}>
          <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.triggerText}>{triggerLabel}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.onSurfaceVariant}
        />
      </Pressable>

      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.panelHint}>
            가구원수와 가구 전체 월 소득을 입력하면 대략적인 소득구간을
            안내해드려요. 정확한 판정이 아닌 참고용이에요.
          </Text>

          {/* 가구원수 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>가구원수 (본인 포함)</Text>
            <View style={styles.chipRow}>
              {HOUSEHOLD_SIZE_OPTIONS.map((n) => {
                const isActive = householdSize === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setHouseholdSize(n)}
                    style={[styles.sizeChip, isActive && styles.sizeChipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`${n}인 가구${n === 7 ? " 이상" : ""}`}
                  >
                    <Text
                      style={[
                        styles.sizeChipText,
                        isActive && styles.sizeChipTextActive,
                      ]}
                    >
                      {n}
                      {n === 7 ? "인+" : "인"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 월 소득 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>가구 전체 월 소득 (세전, 만원)</Text>
            <View style={styles.incomeInputWrap}>
              <TextInput
                style={styles.incomeInput}
                value={incomeInput}
                onChangeText={(v) => {
                  setApplied(false);
                  setIncomeInput(v.replace(/[^0-9]/g, ""));
                }}
                placeholder="예: 250"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={5}
                accessibilityLabel="가구 전체 월 소득 입력, 만원 단위"
              />
              <Text style={styles.incomeSuffix}>만원</Text>
            </View>
          </View>

          {/* Result */}
          {estimate && (
            <View style={styles.resultCard}>
              <Text style={styles.resultHeadline}>
                기준 중위소득 약 {estimate.percentOfMedian}%
              </Text>
              <Text style={styles.resultSub}>
                대략 <Text style={styles.resultBracket}>{estimate.bracket}구간</Text>
                에 해당해요 (1=최저 ~ 10=최고)
              </Text>
              <Text style={styles.resultDisclaimer}>
                * 보건복지부 고시 기준 중위소득 기준 근사치입니다. 실제 소득
                기준은 정책별로 다르니 신청 전 꼭 확인하세요.
              </Text>

              <Pressable
                onPress={handleApply}
                style={({ pressed }) => [
                  styles.applyBtn,
                  pressed && { opacity: 0.85 },
                  applied && styles.applyBtnApplied,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${estimate.bracket}구간 적용하기`}
              >
                <Ionicons
                  name={applied ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={18}
                  color={colors.onPrimary}
                />
                <Text style={styles.applyBtnText}>
                  {applied ? "적용됨" : `${estimate.bracket}구간 적용하기`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    gap: spacing[2],
  },

  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.primaryFixed,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    minHeight: layout.touchTargetMin,
  },
  triggerPressed: {
    opacity: 0.85,
  },
  triggerIconWrap: {
    flexShrink: 0,
  },
  triggerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimaryFixedVariant,
  },

  panel: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[4],
  },
  panelHint: {
    fontSize: typography.fontSize.xs,
    color: colors.onSurfaceVariant,
    lineHeight: typography.fontSize.xs * 1.6,
  },

  field: {
    gap: spacing[2],
  },
  fieldLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.4,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  sizeChip: {
    minWidth: 44,
    minHeight: layout.touchTargetMin,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeChipActive: {
    backgroundColor: colors.primary,
  },
  sizeChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  sizeChipTextActive: {
    color: colors.onPrimary,
  },

  incomeInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    height: layout.inputHeight,
    gap: spacing[2],
  },
  incomeInput: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  incomeSuffix: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
  },

  resultCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    gap: spacing[1.5],
  },
  resultHeadline: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
  },
  resultSub: {
    fontSize: typography.fontSize.sm,
    color: colors.onSurface,
    fontWeight: typography.fontWeight.medium,
  },
  resultBracket: {
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
  },
  resultDisclaimer: {
    fontSize: typography.fontSize.xs,
    color: colors.outline,
    lineHeight: typography.fontSize.xs * 1.5,
    marginTop: spacing[1],
  },

  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    height: layout.buttonHeightSm,
    marginTop: spacing[2],
  },
  applyBtnApplied: {
    backgroundColor: colors.tertiary,
  },
  applyBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
});
