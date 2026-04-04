"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { adminApi, AdminProgram } from "@/lib/api";

const PROGRAM_TYPES = ["전체", "장학금", "정책", "대출", "주거", "취업", "기타"];
const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
];

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    adminApi
      .listPrograms({ limit: 200, offset: 0 })
      .then((data) => {
        setPrograms(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("프로그램 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return programs.filter((p) => {
      const matchSearch =
        search.trim() === "" ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.provider_name ?? "").toLowerCase().includes(search.toLowerCase());

      const matchType =
        typeFilter === "전체" || p.program_type === typeFilter;

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && p.is_active) ||
        (statusFilter === "inactive" && !p.is_active);

      return matchSearch && matchType && matchStatus;
    });
  }, [programs, search, typeFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          프로그램 관리{" "}
          <span className="text-base font-normal text-gray-500">
            ({filtered.length}/{total})
          </span>
        </h1>
        <Link
          href="/admin/programs/new"
          className="inline-flex items-center px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
        >
          프로그램 추가
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="제목 또는 기관명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {PROGRAM_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
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
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      {programs.length === 0
                        ? "등록된 프로그램이 없습니다."
                        : "검색 결과가 없습니다."}
                    </td>
                  </tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 max-w-xs">
                      <span className="truncate block">{p.title}</span>
                      {p.provider_name && (
                        <span className="text-xs text-gray-400 truncate block">
                          {p.provider_name}
                        </span>
                      )}
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
                        className="text-teal-600 hover:text-teal-800 text-sm font-medium"
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
