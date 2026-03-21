"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, USER_ID } from "@/lib/api";

export default function AlertBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api
      .getAlerts(USER_ID)
      .then((alerts) => {
        const unread = alerts.filter((a) => !a.isRead).length;
        setUnreadCount(unread);
      })
      .catch(() => {
        // silent — bell still renders without count
      });
  }, []);

  return (
    <button
      type="button"
      onClick={() => router.push("/alerts")}
      aria-label={
        unreadCount > 0
          ? `알림 ${unreadCount}개 읽지 않음`
          : "알림 보기"
      }
      className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
