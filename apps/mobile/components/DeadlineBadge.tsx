import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface DeadlineBadgeProps {
  deadline: string;
}

function getDDay(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DeadlineBadge({ deadline }: DeadlineBadgeProps) {
  const dDay = getDDay(deadline);

  if (dDay < 0) {
    return (
      <View style={[styles.badge, styles.gray]}>
        <Text style={[styles.text, styles.grayText]}>마감</Text>
      </View>
    );
  }

  const label = dDay === 0 ? "D-Day" : `D-${dDay}`;
  let badgeStyle: object;
  let textStyle: object;
  let accessibilityLabel: string;

  if (dDay <= 3) {
    badgeStyle = styles.red;
    textStyle = styles.redText;
    accessibilityLabel = dDay === 0 ? "오늘 마감" : `${dDay}일 후 마감`;
  } else if (dDay <= 7) {
    badgeStyle = styles.amber;
    textStyle = styles.amberText;
    accessibilityLabel = `${dDay}일 후 마감`;
  } else {
    badgeStyle = styles.gray;
    textStyle = styles.grayText;
    accessibilityLabel = `${dDay}일 후 마감`;
  }

  return (
    <View
      style={[styles.badge, badgeStyle]}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.text, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
  red: { backgroundColor: "#FEE2E2" },
  redText: { color: "#B91C1C" },
  amber: { backgroundColor: "#FEF3C7" },
  amberText: { color: "#B45309" },
  gray: { backgroundColor: "#e1e3e4" },
  grayText: { color: "#717786" },
});
