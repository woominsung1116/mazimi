import React from "react";
import { Text, StyleSheet } from "react-native";

interface BenefitAmountProps {
  amount: number;
  unit?: string;
  size?: "sm" | "md" | "lg";
}

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const remainder = amount % 10000;
    if (remainder === 0) return `${man}만`;
    return `${man}만 ${remainder.toLocaleString("ko-KR")}`;
  }
  return amount.toLocaleString("ko-KR");
}

export default function BenefitAmount({
  amount,
  unit = "월",
  size = "md",
}: BenefitAmountProps) {
  const fontSize = size === "sm" ? 16 : size === "md" ? 20 : 28;

  return (
    <Text style={[styles.base, { fontSize }]}>
      {unit} {formatAmount(amount)}원
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: "700",
    color: "#0058bc",
  },
});
