"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, AdminProgram } from "@/lib/api";

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listPrograms()
      .then((data) => {
        setPrograms(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("프로그램 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          프로그램 관리 ({total})
        </h1>
        <Link
          href="/admin/programs/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          새 프로그램 등록
        </Link>
      </div>

      {loading && <p className="text-gray-500 text-sm">불러오는 중...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    제목
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
                    유형
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                    지역
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                    마감일
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    상태
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    편집
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {programs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      등록된 프로그램이 없습니다.
                    </td>
                  </tr>
                )}
                {programs.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                      {p.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {p.program_type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {p.regions?.join(", ") ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {p.deadline_at
                        ? new Date(p.deadline_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/programs/${p.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        편집
                      </Link>
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
