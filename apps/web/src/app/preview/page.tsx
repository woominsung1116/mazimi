"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboardingStore } from "@/store/onboarding";
import { api, type PreviewResponse } from "@/lib/api";
import RecommendationCard from "@/components/RecommendationCard";

export default function PreviewPage() {
  const router = useRouter();
  const { region, birthYear, enrollmentStatus, schoolName, incomeBracket } =
    useOnboardingStore();

  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!region || !birthYear || !enrollmentStatus) {
      router.replace("/onboarding");
      return;
    }

    api
      .getPreview({
        region,
        birthYear,
        enrollmentStatus,
        schoolName: schoolName || undefined,
        incomeBracket,
      })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [region, birthYear, enrollmentStatus, schoolName, incomeBracket, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">맞춤 추천을 분석하고 있어요...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-gray-700">추천 결과를 불러오지 못했어요</p>
          <p className="text-sm text-gray-500">{error}</p>
          <Link
            href="/onboarding"
            className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            다시 시도하기
          </Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  function formatBenefit(amount: number): string {
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000)}만`;
    }
    return amount.toLocaleString();
  }

  return (
    <main className="min-h-screen px-4 py-8 pb-24">
      <div className="w-full max-w-md mx-auto">
        {/* Summary Card */}
        <div className="rounded-xl bg-blue-600 p-5 text-white mb-6">
          <p className="text-sm opacity-80 mb-3">
            {region} / {enrollmentStatus} 기준 추천 결과
          </p>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm opacity-80">이번 달 신청 가능</p>
              <p className="text-3xl font-bold">{data.totalCount}건</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">예상 수혜액</p>
              <p className="text-3xl font-bold">
                월 {formatBenefit(data.estimatedMonthlyBenefit)}원
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          맞춤 추천 혜택
        </h2>

        {data.recommendations.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm border border-gray-100">
            <p className="text-gray-500">
              현재 조건에 맞는 추천 결과가 없어요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.recommendations.map((rec) => (
              <RecommendationCard key={rec.program.id} data={rec} />
            ))}
          </div>
        )}

        {/* Bottom CTAs */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <div className="max-w-md mx-auto space-y-2">
            <button
              type="button"
              className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              내 조건 저장하기
            </button>
            <Link
              href="/programs"
              className="block w-full text-center rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              전체 프로그램 둘러보기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
