"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type Program } from "@/lib/api";
import DeadlineBadge from "@/components/DeadlineBadge";
import BenefitAmount from "@/components/BenefitAmount";

export default function ProgramDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getProgram(id)
      .then((data) => {
        setProgram(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !program) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-gray-700">프로그램 정보를 불러오지 못했어요</p>
          <Link
            href="/programs"
            className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 pb-24">
      <div className="w-full max-w-md mx-auto">
        {/* Back */}
        <Link
          href="/programs"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          목록으로
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {program.type}
            </span>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {program.region}
            </span>
            <DeadlineBadge deadline={program.deadline} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {program.name}
          </h1>
          <p className="text-sm text-gray-500">{program.organization}</p>
        </div>

        {/* Benefit */}
        <div className="rounded-xl bg-blue-50 p-5 mb-6">
          <p className="text-sm text-blue-700 mb-1">지원 금액</p>
          <BenefitAmount
            amount={program.benefitAmount}
            unit={program.benefitUnit}
            size="lg"
          />
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            요약
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {program.summary}
          </p>
        </div>

        {/* Description */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            상세 내용
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {program.description}
          </p>
        </div>

        {/* Eligibility */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            지원 자격
          </h2>
          <ul className="space-y-1.5">
            {program.eligibility.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-blue-600 mt-0.5">-</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Deadline */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            신청 기한
          </h2>
          <p className="text-sm text-gray-600">
            {new Date(program.deadline).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <div className="max-w-md mx-auto">
            <a
              href={program.applicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              공식 사이트에서 신청하기
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
