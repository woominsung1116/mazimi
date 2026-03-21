"use client";

import { useEffect, useState } from "react";
import { api, USER_ID, Alert } from "@/lib/api";
import AlertCard from "@/components/AlertCard";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getAlerts(USER_ID)
      .then(setAlerts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-24 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
          <div className="h-20 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-md mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">알림을 불러오지 못했습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">알림</h1>
        {alerts.length > 0 && (
          <span className="text-sm text-gray-500">
            {alerts.filter((a) => !a.isRead).length}개 읽지 않음
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg
            className="h-12 w-12 text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <p className="text-gray-500 font-medium">새로운 알림이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">
            마감 임박이나 새 정책이 생기면 알려드릴게요
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              type={alert.type}
              title={alert.title}
              message={alert.message}
              programTitle={alert.programTitle}
              amount={alert.amount}
              daysLeft={alert.daysLeft}
              createdAt={alert.createdAt}
              isRead={alert.isRead}
            />
          ))}
        </div>
      )}
    </main>
  );
}
