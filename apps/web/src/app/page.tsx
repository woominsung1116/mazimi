"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function Home() {
  const [programCount, setProgramCount] = useState<number | null>(null);

  useEffect(() => {
    api
      .getProgramCount()
      .then((data) => setProgramCount(data.count))
      .catch(() => setProgramCount(null));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-md mx-auto text-center space-y-8">

        {/* Hero */}
        <div className="space-y-5">
          {/* 지역 pill */}
          <div className="inline-flex items-center rounded-full bg-teal-50 border border-teal-100 px-3.5 py-1.5">
            <span className="text-xs font-semibold text-teal-600">부산 · 대구 청년 혜택</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            이번 학기,<br />
            <span className="text-teal-600">놓치고 있는 혜택</span>이<br />
            있어요
          </h1>

          <p className="text-base text-gray-500 leading-relaxed">
            정책·장학금을 한눈에 확인하고<br />
            나에게 맞는 혜택을 추천받으세요
          </p>
        </div>

        {/* Stats card */}
        <div
          className="rounded-xl bg-white p-5 shadow-sm border border-gray-100"
          role="region"
          aria-label="등록된 프로그램 현황"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">등록된 청년 정책</p>
              <p className="text-4xl font-bold text-teal-600 mt-1">
                {programCount !== null ? `${programCount}건` : "--건"}
              </p>
            </div>
            <div className="text-right space-y-1">
              <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-600">
                부산 · 대구
              </span>
              <p className="text-sm font-medium text-gray-500">실시간 업데이트</p>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="space-y-3">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center w-full rounded-xl bg-teal-600 px-6 py-4 text-lg font-semibold text-white hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm"
            aria-label="맞춤 혜택 찾기 시작하기"
          >
            내 혜택 찾기
          </Link>

          <Link
            href="/programs"
            className="inline-flex items-center justify-center w-full rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-base font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            aria-label="전체 프로그램 목록 보기"
          >
            전체 프로그램 보기
          </Link>
        </div>

        {/* Trust nudge */}
        <p className="text-xs text-gray-400">
          2분 안에 완료 · 개인정보 저장 없음
        </p>
      </div>
    </main>
  );
}
