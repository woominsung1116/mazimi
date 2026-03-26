"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type DashboardData, formatBenefit, programTypeLabel, programStatusLabel } from "@/lib/api";
import BenefitAmount from "@/components/BenefitAmount";
import DeadlineBadge from "@/components/DeadlineBadge";
import BookmarkButton from "@/components/BookmarkButton";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-md mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">데이터를 불러오지 못했습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">내 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">지금 받을 수 있는 혜택을 확인하세요</p>
      </div>

      {/* 예상 수혜액 카드 */}
      <section
        className="rounded-xl bg-blue-600 p-6 text-white shadow"
        aria-label="예상 수혜액"
      >
        <p className="text-sm font-semibold text-blue-100 mb-4">예상 수혜액</p>
        <div className="flex gap-8">
          <div>
            <p className="text-xs font-medium text-blue-200 mb-1">월</p>
            <div className="text-3xl font-bold text-white">
              <BenefitAmount amount={data.estimated_monthly} unit="" size="lg" />
            </div>
          </div>
          <div className="border-l border-blue-500 pl-8">
            <p className="text-xs font-medium text-blue-200 mb-1">학기</p>
            <div className="text-3xl font-bold text-white">
              <BenefitAmount amount={data.estimated_semester} unit="" size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* 곧 마감 */}
      {data.upcoming_deadlines.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">곧 마감</h2>
          <div className="space-y-2">
            {data.upcoming_deadlines.map((program) => (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                aria-label={`${program.title} 상세 보기`}
                className="flex items-center justify-between rounded-xl bg-white border border-gray-100 px-4 py-3 shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{program.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{program.provider_name}</p>
                </div>
                {program.deadline_at && <DeadlineBadge deadline={program.deadline_at} />}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 지금 해야 할 일 */}
      {data.todo_items.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">지금 해야 할 일</h2>
          <div className="rounded-xl bg-white border border-gray-100 px-4 py-4 shadow-sm">
            <ul className="space-y-2">
              {data.todo_items.map((item, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">-</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Nav links */}
      <nav className="flex gap-3 pt-2" aria-label="주요 메뉴">
        <Link
          href="/my/saved"
          aria-label="저장 목록 보기"
          className="flex-1 text-center rounded-xl border border-blue-600 text-blue-600 py-3 text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          저장 목록
        </Link>
        <Link
          href="/my/applications"
          aria-label="신청 현황 보기"
          className="flex-1 text-center rounded-xl bg-blue-600 text-white py-3 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          신청 현황
        </Link>
      </nav>
    </main>
  );
}
