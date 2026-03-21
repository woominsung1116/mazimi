"use client";

export type AlertType = "deadline" | "new_program" | "profile_update";

export interface AlertCardProps {
  type: AlertType;
  title: string;
  message: string;
  programTitle?: string;
  amount?: number;
  daysLeft?: number;
  createdAt: string;
  isRead: boolean;
}

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    return `${man}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${diffDay}일 전`;
}

function buildAmountMessage(
  type: AlertType,
  amount: number | undefined,
  daysLeft: number | undefined
): string | null {
  if (!amount) return null;

  if (type === "deadline") {
    if (daysLeft === 0) return `오늘 마감! ${formatAmount(amount)} 혜택이 사라질 수 있어요`;
    if (daysLeft === 1) return `내일 마감! ${formatAmount(amount)} 혜택이 사라질 수 있어요`;
    if (daysLeft != null && daysLeft <= 7)
      return `${daysLeft}일 후 마감! ${formatAmount(amount)} 혜택이 사라질 수 있어요`;
  }

  if (type === "new_program") {
    return `최대 ${formatAmount(amount)} 혜택을 받을 수 있어요`;
  }

  return null;
}

const typeIcon: Record<AlertType, React.ReactNode> = {
  deadline: (
    <svg
      className="h-5 w-5 text-red-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  new_program: (
    <svg
      className="h-5 w-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  ),
  profile_update: (
    <svg
      className="h-5 w-5 text-amber-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
};

export default function AlertCard({
  type,
  title,
  message,
  programTitle,
  amount,
  daysLeft,
  createdAt,
  isRead,
}: AlertCardProps) {
  const amountMessage = buildAmountMessage(type, amount, daysLeft);

  return (
    <div
      className={`rounded-xl border border-gray-100 px-4 py-4 shadow-sm ${
        isRead ? "bg-white" : "bg-blue-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{typeIcon[type]}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {title}
            </p>
            <span className="text-xs text-gray-400 shrink-0">
              {formatRelativeTime(createdAt)}
            </span>
          </div>

          {programTitle && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {programTitle}
            </p>
          )}

          <p className="text-sm text-gray-600 mt-1">{message}</p>

          {amountMessage && (
            <p className="text-sm font-medium text-blue-600 mt-1">
              {amountMessage}
            </p>
          )}
        </div>

        {!isRead && (
          <span
            aria-label="읽지 않은 알림"
            className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-600"
          />
        )}
      </div>
    </div>
  );
}
