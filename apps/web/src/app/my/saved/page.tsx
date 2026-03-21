"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, USER_ID, SavedProgram } from "@/lib/api";
import DeadlineBadge from "@/components/DeadlineBadge";
import BookmarkButton from "@/components/BookmarkButton";

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getSaved(USER_ID)
      .then((res) => setSaved(res.saved))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">저장한 항목</h1>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-center text-gray-500 py-12">데이터를 불러오지 못했습니다.</p>
      )}

      {!loading && !error && saved.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-500">저장한 항목이 없습니다.</p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            프로그램 둘러보기
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {!loading && !error && saved.length > 0 && (
        <div className="space-y-3">
          {saved.map(({ program }) => (
            <div
              key={program.id}
              className="rounded-xl bg-white border border-gray-100 px-4 py-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <Link href={`/programs/${program.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded font-medium">
                      {program.type}
                    </span>
                    <DeadlineBadge deadline={program.deadline} />
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{program.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{program.organization}</p>
                  <p className="text-sm font-medium text-blue-600 mt-1">
                    {program.benefitUnit} {(program.benefitAmount / 10000).toFixed(0)}만원
                  </p>
                </Link>
                <BookmarkButton programId={program.id} initialBookmarked={true} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
