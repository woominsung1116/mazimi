"use client";

import { useEffect, useState } from "react";
import { adminApi, AdminStats } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .catch(() => setError("통계를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
      {loading && (
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      )}
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">총 프로그램</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.total_programs.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">활성 프로그램</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {stats.active_programs.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">총 사용자</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.total_users.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
