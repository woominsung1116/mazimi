"use client";

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
    return `${man}만 ${remainder.toLocaleString()}`;
  }
  return amount.toLocaleString();
}

export default function BenefitAmount({
  amount,
  unit = "월",
  size = "md",
}: BenefitAmountProps) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <span className={`font-bold text-teal-600 ${sizeClasses[size]}`}>
      {unit} {formatAmount(amount)}원
    </span>
  );
}
