"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnboardingStore } from "@/store/onboarding";
import { api, type RecommendationResult, type RecommendationItem, programTypeLabel } from "@/lib/api";

export default function PreviewPage() {
  const router = useRouter();
  const { region, birthYear, enrollmentStatus, schoolName, incomeBracket } =
    useOnboardingStore();

  const [data, setData] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!region || !birthYear || !enrollmentStatus) {
      router.replace("/onboarding");
      return;
    }

    api
      .getRecommendPreview({
        region_code: region,
        birth_year: birthYear,
        enrollment_status: enrollmentStatus,
        school_name: schoolName || undefined,
        income_bracket: incomeBracket,
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
          <div className="h-8 w-8 mx-auto border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
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
            className="inline-block rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            다시 시도하기
          </Link>
        </div>
      </main>
    );
  }

  if (!data) return null;

  function formatAmount(amount: number): string {
    if (amount >= 10000) {
      return `${Math.floor(amount / 10000)}만`;
    }
    return amount.toLocaleString();
  }

  return (
    <main className="min-h-screen px-4 py-8 pb-24">
      <div className="w-full max-w-md mx-auto">
        {/* Summary Card */}
        <div className="rounded-xl bg-teal-600 p-5 text-white mb-6">
          <p className="text-sm opacity-80 mb-3">
            {region} / {enrollmentStatus} 기준 추천 결과
          </p>
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm opacity-80">이번 달 신청 가능</p>
              <p className="text-3xl font-bold">{data.total_available}건</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">예상 수혜액</p>
              <p className="text-3xl font-bold">
                월 {formatAmount(data.estimated_monthly)}원
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          맞춤 추천 혜택
        </h2>

        {data.items.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm border border-gray-100">
            <p className="text-gray-500">
              현재 조건에 맞는 추천 결과가 없어요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => (
              <RecommendationCard key={item.program_id} item={item} />
            ))}
          </div>
        )}

        {/* Bottom CTAs */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <div className="max-w-md mx-auto space-y-2">
            <button
              type="button"
              className="w-full rounded-xl bg-teal-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-teal-700 transition-colors"
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

/** Inline recommendation card for the preview page */
function RecommendationCard({ item }: { item: RecommendationItem }) {
  const scoreLabel =
    item.match_score >= 90
      ? "매우 높음"
      : item.match_score >= 70
        ? "높음"
        : item.match_score >= 50
          ? "보통"
          : "낮음";

  const scoreColor =
    item.match_score >= 90
      ? "bg-green-100 text-green-700"
      : item.match_score >= 70
        ? "bg-teal-100 text-teal-700"
        : item.match_score >= 50
          ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-100 text-gray-600";

  function formatBenefitAmount(): string {
    if (item.benefit_amount_monthly) {
      return `월 ${Math.round(item.benefit_amount_monthly / 10000)}만원`;
    }
    if (item.benefit_amount_semester) {
      return `학기 ${Math.round(item.benefit_amount_semester / 10000)}만원`;
    }
    return "혜택 확인";
  }

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
          {programTypeLabel(item.program_type)}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor}`}
        >
          적합도 {scoreLabel}
        </span>
      </div>
      <h3 className="font-semibold text-gray-900">{item.title}</h3>
      <p className="text-sm font-medium text-teal-600 mt-1">{formatBenefitAmount()}</p>

      {item.reasons.length > 0 && (
        <div className="mt-2">
          <ul className="space-y-1">
            {item.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <svg
                  className="h-4 w-4 text-green-500 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.missing_checks.length > 0 && (
        <div className="mt-2">
          <ul className="space-y-1">
            {item.missing_checks.map((check, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                <svg
                  className="h-4 w-4 text-amber-500 mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
                {check}
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.official_url && (
        <a
          href={item.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          공식 사이트에서 신청
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}
