"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, AdminStats, AdminProgram } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentPrograms, setRecentPrograms] = useState<AdminProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminApi.getStats(),
      adminApi.listPrograms({ limit: 10, offset: 0 }),
    ])
      .then(([statsData, programsData]) => {
        setStats(statsData);
        setRecentPrograms(programsData.items);
      })
      .catch(() => setError("데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await adminApi.triggerSync();
      setSyncMessage(result.message);
    } catch {
      setSyncMessage("동기화 요청에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              동기화 중...
            </>
          ) : (
            "데이터 동기화"
          )}
        </button>
      </div>

      {syncMessage && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
          {syncMessage}
        </div>
      )}

      {loading && <p className="text-gray-500 text-sm">불러오는 중...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">총 프로그램</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.total_programs.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">활성 프로그램</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">
              {stats.active_programs.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">총 사용자</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.total_users.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">비활성 프로그램</p>
            <p className="text-2xl font-bold text-gray-400 mt-1">
              {(stats.total_programs - stats.active_programs).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {recentPrograms.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              최근 프로그램 (최신 10개)
            </h2>
            <Link
              href="/admin/programs"
              className="text-sm text-teal-600 hover:text-teal-800 font-medium"
            >
              전체 보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    제목
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 hidden sm:table-cell">
                    유형
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 hidden md:table-cell">
                    마감일
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentPrograms.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-900 max-w-xs">
                      <Link
                        href={`/admin/programs/${p.id}`}
                        className="hover:text-teal-600 truncate block"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">
                      {p.program_type}
                    </td>
                    <td className="px-5 py-3 text-gray-600 hidden md:table-cell">
                      {p.deadline_at
                        ? new Date(p.deadline_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
