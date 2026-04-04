"use client";

import type { ApplicationStatus } from "@/lib/api";

interface StatusBadgeProps {
  status: ApplicationStatus;
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: "관심",
  planning: "예정",
  applying: "진행중",
  applied: "완료",
  waiting: "대기",
  received: "수혜",
  abandoned: "포기",
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  interested: "bg-gray-100 text-gray-600",
  planning: "bg-teal-100 text-teal-700",
  applying: "bg-yellow-100 text-yellow-700",
  applied: "bg-green-100 text-green-700",
  waiting: "bg-orange-100 text-orange-700",
  received: "bg-purple-100 text-purple-700",
  abandoned: "bg-red-100 text-red-600",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
