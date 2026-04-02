/**
 * RecommendationCard — expandable card for a single RecommendationItem.
 *
 * Updated to match the new API shape from crates/core/src/models.rs:
 *   RecommendationItem { program_id, title, program_type, match_score,
 *     benefit_amount_monthly, benefit_amount_semester, deadline,
 *     reasons, missing_checks, official_url }
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import type { RecommendationItem } from "@/lib/api";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface RecommendationCardProps {
  data: RecommendationItem;
}

function formatBenefitLabel(item: RecommendationItem): string {
  if (item.benefit_amount_monthly) {
    return `월 ${Math.round(item.benefit_amount_monthly / 10000)}만원`;
  }
  if (item.benefit_amount_semester) {
    return `학기 ${Math.round(item.benefit_amount_semester / 10000)}만원`;
  }
  return "혜택 확인";
}

function formatDeadlineLabel(deadline: string | null): string {
  if (!deadline) return "상시";
  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "마감";
  if (days === 0) return "D-DAY";
  return `D-${days}`;
}

function programTypeKorean(type: string): string {
  switch (type) {
    case "scholarship": return "장학금";
    case "support":
    case "youth_policy": return "청년정책";
    case "welfare": return "복지/생활";
    default: return type;
  }
}

export default function RecommendationCard({ data }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const { program_id, title, program_type, match_score, reasons, missing_checks, official_url, deadline } = data;

  const benefitLabel = formatBenefitLabel(data);
  const deadlineLabel = formatDeadlineLabel(deadline);
  const typeLabel = programTypeKorean(program_type);

  const scoreLabel =
    match_score >= 90
      ? "매우 높음"
      : match_score >= 70
        ? "높음"
        : match_score >= 50
          ? "보통"
          : "낮음";

  const scoreColors =
    match_score >= 90
      ? { bg: "#DCFCE7", text: "#15803D" }
      : match_score >= 70
        ? { bg: "#D0EDE9", text: "#0D2B26" }
        : match_score >= 50
          ? { bg: "#FEF9C3", text: "#A16207" }
          : { bg: "#e1e3e4", text: "#717786" };

  function toggleExpand() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  function handleApply() {
    if (official_url) {
      Linking.openURL(official_url);
    }
  }

  function handleDetail() {
    router.push(`/programs/${program_id}`);
  }

  return (
    <View style={styles.card}>
      {/* Layer 1: title + benefit + deadline (always visible) */}
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title} 상세 정보 ${expanded ? "접기" : "펼치기"}`}
        accessibilityState={{ expanded }}
        style={styles.layer1}
      >
        <View style={styles.layer1Left}>
          <Text style={styles.programName} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.benefitLabel}>{benefitLabel}</Text>
        </View>
        <View style={styles.layer1Right}>
          <View style={styles.deadlineBadge}>
            <Text style={styles.deadlineText}>{deadlineLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expand chevron */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={styles.chevronRow}
        activeOpacity={0.5}
        accessibilityLabel={expanded ? "접기" : "펼치기"}
      >
        <Text style={[styles.chevron, expanded && styles.chevronUp]}>›</Text>
      </TouchableOpacity>

      {/* Layer 2: details (expanded) */}
      {expanded && (
        <View style={styles.layer2}>
          {/* Tag row */}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{typeLabel}</Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColors.bg }]}>
              <Text style={[styles.scoreText, { color: scoreColors.text }]}>
                적합도 {scoreLabel} ({match_score}%)
              </Text>
            </View>
          </View>

          {/* 추천 이유 */}
          {reasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>추천 이유</Text>
              {reasons.map((reason: string, i: number) => (
                <View key={i} style={styles.listRow}>
                  <Text style={styles.checkIcon}>✓</Text>
                  <Text style={styles.listText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 확인 필요 */}
          {missing_checks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>확인 필요</Text>
              {missing_checks.map((check: string, i: number) => (
                <View key={i} style={styles.listRow}>
                  <Text style={styles.warnIcon}>!</Text>
                  <Text style={styles.listTextMuted}>{check}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={handleDetail}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${title} 상세 보기`}
            >
              <Text style={styles.detailBtnText}>상세 보기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, !official_url && styles.applyBtnDisabled]}
              onPress={handleApply}
              disabled={!official_url}
              activeOpacity={0.8}
              accessibilityRole="link"
              accessibilityLabel={`${title} 공식 사이트에서 신청하기`}
            >
              <Text style={styles.applyBtnText}>공식 신청 →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#b6c7eb",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 1,
    marginBottom: 12,
  },
  layer1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
    minHeight: 72,
  },
  layer1Left: {
    flex: 1,
    gap: 4,
  },
  layer1Right: {
    alignItems: "flex-end",
  },
  programName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#191c1d",
  },
  benefitLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5CB1A7",
  },
  deadlineBadge: {
    backgroundColor: "#e8f0fe",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5CB1A7",
  },
  chevronRow: {
    alignItems: "center",
    paddingBottom: 8,
    minHeight: 28,
  },
  chevron: {
    fontSize: 18,
    color: "#c1c6d7",
    transform: [{ rotate: "90deg" }],
  },
  chevronUp: {
    transform: [{ rotate: "-90deg" }],
  },
  layer2: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    backgroundColor: "#e1e3e4",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  tagText: {
    fontSize: 12,
    color: "#717786",
    fontWeight: "500",
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "500",
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#414755",
    marginBottom: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  checkIcon: {
    fontSize: 13,
    color: "#22C55E",
    marginTop: 1,
    width: 14,
  },
  warnIcon: {
    fontSize: 13,
    color: "#F59E0B",
    marginTop: 1,
    width: 14,
    textAlign: "center",
    fontWeight: "700",
  },
  listText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
  },
  listTextMuted: {
    flex: 1,
    fontSize: 13,
    color: "#717786",
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#e1e3e4",
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  detailBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#414755",
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#4DA89E",
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    shadowColor: "#5CB1A7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
