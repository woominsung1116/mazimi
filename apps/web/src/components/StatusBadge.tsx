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
  received: "수혜",
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  interested: "bg-gray-100 text-gray-600",
  planning: "bg-blue-100 text-blue-700",
  applying: "bg-yellow-100 text-yellow-700",
  applied: "bg-green-100 text-green-700",
  received: "bg-purple-100 text-purple-700",
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
