"use client";

interface DeadlineBadgeProps {
  deadline: string;
}

function getDDay(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export default function DeadlineBadge({ deadline }: DeadlineBadgeProps) {
  const dDay = getDDay(deadline);

  if (dDay < 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
        마감
      </span>
    );
  }

  let colorClasses: string;
  let ariaLabel: string;

  if (dDay === 0) {
    colorClasses = "bg-red-100 text-red-700";
    ariaLabel = "오늘 마감";
  } else if (dDay <= 3) {
    colorClasses = "bg-red-100 text-red-700";
    ariaLabel = `${dDay}일 후 마감`;
  } else if (dDay <= 7) {
    colorClasses = "bg-amber-100 text-amber-700";
    ariaLabel = `${dDay}일 후 마감`;
  } else {
    colorClasses = "bg-gray-100 text-gray-600";
    ariaLabel = `${dDay}일 후 마감`;
  }

  const label = dDay === 0 ? "D-Day" : `D-${dDay}`;

  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClasses}`}
    >
      {label}
    </span>
  );
}
