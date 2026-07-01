/**
 * ApplicationGuideCard — "신청 가이드" card shared by the program detail
 * screen and the apply-assistant wizard.
 *
 * Renders the three application-guide fields the backend added to Program:
 *   - application_method    → step chain when "→" is present, else free text
 *   - submission_documents  → itemized list
 *   - screening_method      → free text section
 *
 * Any field that's null/blank is simply omitted — no empty sections, no
 * placeholder copy. If all three are null/blank the component renders
 * nothing (`null`); callers should also skip their own wrapping layout
 * (card padding + divider) in that case — see programs/[id].tsx.
 *
 * Design tokens only — no new colors. Uses constants/theme.ts ("Moss Stone").
 */

import React from "react";
import { View, Text, StyleSheet, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
} from "@/constants/theme";

export interface ApplicationGuideCardProps {
  applicationMethod?: string | null;
  submissionDocuments?: string | null;
  screeningMethod?: string | null;
}

/**
 * Splits "시험응시 → 접수 → 서류확인" into ["시험응시", "접수", "서류확인"].
 * Returns null when there's no "→" (or only one segment) to split on —
 * caller falls back to rendering the raw text as a paragraph.
 */
function splitStepChain(text: string): string[] | null {
  if (!text.includes("→")) return null;
  const steps = text
    .split("→")
    .map((s) => s.trim())
    .filter(Boolean);
  return steps.length > 1 ? steps : null;
}

/**
 * Splits a submission-documents blob into itemized rows. Prefers newlines
 * (most structured gov-API text); falls back to common inline delimiters;
 * strips leading bullet/number markers ("1.", "-", "•").
 */
function splitDocumentItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const byLine = trimmed
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const source =
    byLine.length > 1
      ? byLine
      : trimmed
          .split(/[·,;、]/)
          .map((s) => s.trim())
          .filter(Boolean);
  return source
    .map((s) => s.replace(/^[-•*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

function MultilineText({ text, style }: { text: string; style?: TextStyle }) {
  return (
    <>
      {text.split(/\r?\n/).map((line, i) => (
        <Text key={i} style={style}>
          {line}
        </Text>
      ))}
    </>
  );
}

export function ApplicationGuideCard({
  applicationMethod,
  submissionDocuments,
  screeningMethod,
}: ApplicationGuideCardProps) {
  const method = applicationMethod?.trim() || null;
  const docs = submissionDocuments?.trim() || null;
  const screening = screeningMethod?.trim() || null;

  if (!method && !docs && !screening) return null;

  const steps = method ? splitStepChain(method) : null;
  const docItems = docs ? splitDocumentItems(docs) : [];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="compass-outline" size={19} color={colors.primary} />
        <Text style={styles.headerTitle}>신청 가이드</Text>
      </View>

      {method && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신청방법</Text>
          {steps ? (
            <View>
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepIndicatorCol}>
                      <View style={styles.stepDot}>
                        <Text style={styles.stepDotText}>{i + 1}</Text>
                      </View>
                      {!isLast && <View style={styles.stepLine} />}
                    </View>
                    <Text
                      style={[styles.stepText, isLast && styles.stepTextLast]}
                    >
                      {step}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.paragraph}>
              <MultilineText text={method} style={styles.paragraphText} />
            </View>
          )}
        </View>
      )}

      {method && (docs || screening) && <View style={styles.divider} />}

      {docs && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제출서류</Text>
          <View style={styles.docList}>
            {docItems.map((item, i) => (
              <View key={i} style={styles.docRow}>
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={colors.primary}
                  style={styles.docIcon}
                />
                <Text style={styles.docText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {docs && screening && <View style={styles.divider} />}

      {screening && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>심사방법</Text>
          <View style={styles.paragraph}>
            <MultilineText text={screening} style={styles.paragraphText} />
          </View>
        </View>
      )}
    </View>
  );
}

export default ApplicationGuideCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    gap: spacing[4],
    ...shadows.card,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurface,
  },
  section: {
    gap: spacing[2.5],
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.onSurfaceVariant,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceContainerHigh,
  },

  // Step chain (신청방법)
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
  },
  stepIndicatorCol: {
    alignItems: "center",
    width: 22,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    color: colors.onPrimary,
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: spacing[3],
    backgroundColor: colors.outlineVariant,
    marginVertical: 2,
  },
  stepText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.onSurface,
    paddingBottom: spacing[3],
    paddingTop: 1,
  },
  stepTextLast: {
    paddingBottom: 0,
  },

  // Paragraph fallback (free text 신청방법 / 심사방법)
  paragraph: {
    gap: spacing[0.5],
  },
  paragraphText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.onSurface,
    lineHeight: 21,
  },

  // Document list (제출서류)
  docList: {
    gap: spacing[2],
  },
  docRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[2],
  },
  docIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  docText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.onSurface,
    lineHeight: 20,
  },
});
