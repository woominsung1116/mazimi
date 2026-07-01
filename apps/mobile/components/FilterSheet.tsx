/**
 * FilterSheet — 탐색 화면 상세 필터 바텀시트.
 *
 * 지역 · 분야 · 연령 · 소득구간으로 프로그램 목록을 좁히는 모달 패널.
 * 부모(app/(tabs)/explore.tsx)가 상태를 들고 있고, 이 컴포넌트는 "적용"을
 * 누르기 전까지는 로컬 draft 상태만 바꾼다 (열 때마다 initialValues로 리셋).
 *
 * 데이터 연동 메모:
 *  - 지역/분야는 explore.tsx가 이미 API 데이터(ApiProgram.regions,
 *    program_type)로 갖고 있는 필드라 클라이언트 필터가 정확하게 동작한다.
 *  - 연령은 ApiProgram.min_age/max_age를 explore.tsx에서 매핑해 전달한다.
 *  - 소득구간은 프로그램 목록 응답에 소득 자격 기준이 내려오지 않아
 *    (그건 /recommend/preview에서만 룰엔진으로 평가됨) 목록 자체를 걸러내지
 *    않는다 — 대신 전역 프로필(useOnboardingStore.incomeBracket)에 반영되어
 *    홈 탭 추천 등 다른 화면에서 실제로 쓰이게 한다. 그 사실을 라벨로 명시한다.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  layout,
  shadows,
} from "@/constants/theme";
import IncomeBracketGuide from "@/components/IncomeBracketGuide";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterOption {
  label: string;
  value: string;
}

export interface AgeRangeOption {
  label: string;
  min: number | null;
  max: number | null;
}

export interface ExploreFilterValues {
  region: string | null; // null = 전국(제한 없음)
  category: string; // "전체" | ...categoryOptions values
  ageRangeIndex: number; // index into AGE_RANGE_OPTIONS
  incomeBracket: number | null; // 1~10, null = 미설정
}

export const AGE_RANGE_OPTIONS: AgeRangeOption[] = [
  { label: "전체", min: null, max: null },
  { label: "18~24세", min: 18, max: 24 },
  { label: "25~29세", min: 25, max: 29 },
  { label: "30~34세", min: 30, max: 34 },
  { label: "35~39세", min: 35, max: 39 },
  { label: "40세 이상", min: 40, max: null },
];

export const INCOME_BRACKET_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export const DEFAULT_FILTER_VALUES: ExploreFilterValues = {
  region: null,
  category: "전체",
  ageRangeIndex: 0,
  incomeBracket: null,
};

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  regionOptions: FilterOption[]; // does NOT include "전국" — added internally
  categoryOptions: FilterOption[]; // first entry should be "전체"
  initialValues: ExploreFilterValues;
  onApply: (values: ExploreFilterValues) => void;
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SelectChip({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, isActive && styles.chipActive]}
      accessibilityRole="radio"
      accessibilityState={{ checked: isActive }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FilterSheet({
  visible,
  onClose,
  regionOptions,
  categoryOptions,
  initialValues,
  onApply,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ExploreFilterValues>(initialValues);

  // Reset draft to whatever is currently applied every time the sheet opens.
  useEffect(() => {
    if (visible) setDraft(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_FILTER_VALUES);
  }, []);

  const handleApply = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  const activeFilterCount =
    (draft.region !== null ? 1 : 0) +
    (draft.category !== "전체" ? 1 : 0) +
    (draft.ageRangeIndex !== 0 ? 1 : 0) +
    (draft.incomeBracket !== null ? 1 : 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="필터 닫기" />

      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, spacing[4]) },
        ]}
      >
        {/* Grabber */}
        <View style={styles.grabber} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>상세 필터</Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="필터 닫기"
          >
            <Ionicons name="close" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 지역 */}
          <View style={styles.section}>
            <SectionTitle>지역</SectionTitle>
            <View style={styles.chipWrap}>
              <SelectChip
                label="전국"
                isActive={draft.region === null}
                onPress={() => setDraft((d) => ({ ...d, region: null }))}
              />
              {regionOptions.map((r) => (
                <SelectChip
                  key={r.value}
                  label={r.label}
                  isActive={draft.region === r.value}
                  onPress={() => setDraft((d) => ({ ...d, region: r.value }))}
                />
              ))}
            </View>
          </View>

          {/* 분야 */}
          <View style={styles.section}>
            <SectionTitle>분야</SectionTitle>
            <View style={styles.chipWrap}>
              {categoryOptions.map((c) => (
                <SelectChip
                  key={c.value}
                  label={c.label}
                  isActive={draft.category === c.value}
                  onPress={() => setDraft((d) => ({ ...d, category: c.value }))}
                />
              ))}
            </View>
          </View>

          {/* 연령 */}
          <View style={styles.section}>
            <SectionTitle>연령</SectionTitle>
            <View style={styles.chipWrap}>
              {AGE_RANGE_OPTIONS.map((opt, idx) => (
                <SelectChip
                  key={opt.label}
                  label={opt.label}
                  isActive={draft.ageRangeIndex === idx}
                  onPress={() => setDraft((d) => ({ ...d, ageRangeIndex: idx }))}
                />
              ))}
            </View>
          </View>

          {/* 소득구간 */}
          <View style={styles.section}>
            <SectionTitle>소득구간</SectionTitle>
            <Text style={styles.sectionHint}>
              선택한 소득구간은 내 프로필에 저장되어 홈 탭 맞춤 추천에
              반영돼요. 이 목록은 소득 조건으로 걸러지지 않아요.
            </Text>
            <View style={styles.chipWrap}>
              <SelectChip
                label="미입력"
                isActive={draft.incomeBracket === null}
                onPress={() => setDraft((d) => ({ ...d, incomeBracket: null }))}
              />
              {INCOME_BRACKET_OPTIONS.map((b) => (
                <SelectChip
                  key={b}
                  label={`${b}구간`}
                  isActive={draft.incomeBracket === b}
                  onPress={() => setDraft((d) => ({ ...d, incomeBracket: b }))}
                />
              ))}
            </View>

            <View style={{ marginTop: spacing[3] }}>
              <IncomeBracketGuide
                onApply={(bracket) =>
                  setDraft((d) => ({ ...d, incomeBracket: bracket }))
                }
              />
            </View>
          </View>
        </ScrollView>

        {/* Sticky action row */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="필터 초기화"
          >
            <Text style={styles.resetBtnText}>초기화</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [
              styles.applyBtn,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0
                ? `필터 ${activeFilterCount}개 적용하기`
                : "필터 적용하기"
            }
          >
            <Text style={styles.applyBtnText}>
              {activeFilterCount > 0
                ? `필터 적용 (${activeFilterCount})`
                : "필터 적용"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SHEET_MAX_HEIGHT = "82%" as const;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: layout.tabBarTopRadius,
    borderTopRightRadius: layout.tabBarTopRadius,
    ...shadows.floating,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.outlineVariant,
    marginTop: spacing[2.5],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onSurface,
  },

  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: layout.pagePadding,
    paddingBottom: spacing[4],
    gap: layout.sectionGap,
  },

  section: {
    gap: spacing[2.5],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontSize: typography.fontSize.xs,
    color: colors.outline,
    lineHeight: typography.fontSize.xs * 1.5,
    marginTop: -spacing[1],
  },

  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    minHeight: layout.touchTargetMin,
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },

  actionRow: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing[3],
    backgroundColor: colors.surface,
  },
  resetBtn: {
    flex: 1,
    height: layout.buttonHeightMd,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
  },
  applyBtn: {
    flex: 2,
    height: layout.buttonHeightMd,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  applyBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: colors.onPrimary,
  },
});
