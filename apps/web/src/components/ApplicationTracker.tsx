"use client";

import type { ApplicationStatus } from "@/lib/api";

interface ApplicationTrackerProps {
  status: ApplicationStatus;
  onChange?: (status: ApplicationStatus) => void;
}

const STEPS: { value: ApplicationStatus; label: string }[] = [
  { value: "interested", label: "관심" },
  { value: "planning", label: "예정" },
  { value: "applying", label: "진행중" },
  { value: "applied", label: "완료" },
  { value: "received", label: "수혜" },
];

const STEP_ACTIVE_COLORS: Record<ApplicationStatus, string> = {
  interested: "bg-gray-500",
  planning: "bg-blue-600",
  applying: "bg-yellow-500",
  applied: "bg-green-600",
  received: "bg-purple-600",
};

export default function ApplicationTracker({
  status,
  onChange,
}: ApplicationTrackerProps) {
  const currentIndex = STEPS.findIndex((s) => s.value === status);

  return (
    <div className="flex items-center gap-1 w-full">
      {STEPS.map((step, i) => {
        const isActive = i <= currentIndex;
        const isCurrent = step.value === status;
        return (
          <button
            key={step.value}
            type="button"
            onClick={() => onChange?.(step.value)}
            className="flex-1 flex flex-col items-center gap-1 group"
          >
            <div
              className={`h-2 w-full rounded-full transition-colors ${
                isActive
                  ? STEP_ACTIVE_COLORS[status]
                  : "bg-gray-200"
              }`}
            />
            <span
              className={`text-xs transition-colors ${
                isCurrent
                  ? "font-semibold text-gray-900"
                  : isActive
                    ? "text-gray-600"
                    : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
