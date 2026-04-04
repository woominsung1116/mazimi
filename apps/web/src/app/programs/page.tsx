"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type ApiProgram, formatBenefit, programTypeLabel, programStatusLabel } from "@/lib/api";
import DeadlineBadge from "@/components/DeadlineBadge";

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ApiProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .getPrograms({
        program_type: typeFilter || undefined,
        region: regionFilter || undefined,
      })
      .then((data) => {
        setPrograms(data.items || []);
        setLoading(false);
      })
      .catch(() => {
        setPrograms([]);
        setLoading(false);
      });
  }, [typeFilter, regionFilter]);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            전체 프로그램
          </h1>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            홈으로
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {/* Type filters */}
          {["", "scholarship", "support"].map((t) => (
            <button
              key={t || "all-type"}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                typeFilter === t
                  ? "bg-teal-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {t ? programTypeLabel(t) : "전체"}
            </button>
          ))}

          <div className="w-px bg-gray-200 mx-1" />

          {/* Region filters */}
          {["", "busan", "daegu"].map((r) => (
            <button
              key={r || "all-region"}
              type="button"
              onClick={() => setRegionFilter(r)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                regionFilter === r
                  ? "bg-teal-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {r === "busan" ? "부산" : r === "daegu" ? "대구" : "전체 지역"}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm border border-gray-100">
            <p className="text-gray-500">등록된 프로그램이 없어요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((program) => (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                    {programTypeLabel(program.program_type)}
                  </span>
                  {program.regions && program.regions.length > 0 && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                      {program.regions[0]}
                    </span>
                  )}
                  {program.deadline_at && <DeadlineBadge deadline={program.deadline_at} />}
                </div>
                <h3 className="font-semibold text-gray-900">
                  {program.title}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5 mb-2">
                  {program.provider_name}
                </p>
                <p className="text-sm font-medium text-teal-600">
                  {formatBenefit(program)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
