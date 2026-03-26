"use client";

import { useState } from "react";
import BookmarkButton from "./BookmarkButton";
import type { RecommendationItem } from "@/lib/api";
import { programTypeLabel } from "@/lib/api";

interface RecommendationCardProps {
  data: RecommendationItem;
}

export default function RecommendationCard({
  data,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { program_id, title, program_type, match_score, reasons, missing_checks, benefit_amount_monthly, benefit_amount_semester, deadline, official_url } = data;

  const scoreLabel =
    match_score >= 90
      ? "매우 높음"
      : match_score >= 70
        ? "높음"
        : match_score >= 50
          ? "보통"
          : "낮음";

  const scoreColor =
    match_score >= 90
      ? "bg-green-100 text-green-700"
      : match_score >= 70
        ? "bg-blue-100 text-blue-700"
        : match_score >= 50
          ? "bg-yellow-100 text-yellow-700"
          : "bg-gray-100 text-gray-600";

  function formatBenefitAmount(): string {
    if (benefit_amount_monthly) {
      return `월 ${Math.round(benefit_amount_monthly / 10000)}만원`;
    }
    if (benefit_amount_semester) {
      return `학기 ${Math.round(benefit_amount_semester / 10000)}만원`;
    }
    return "혜택 확인";
  }

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      {/* Layer 1 — amount + D-Day only (always visible) */}
      <button
        type="button"
        className="w-full p-4 text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${title} 상세 정보 ${expanded ? "접기" : "펼치기"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {title}
            </h3>
            <p className="text-sm font-medium text-blue-600 mt-1">
              {formatBenefitAmount()}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <BookmarkButton programId={program_id} />
          </div>
        </div>

        <div className="flex items-center justify-center mt-2">
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Layer 2 — reasons + conditions + apply link (expandable) */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {/* Context row */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
              {programTypeLabel(program_type)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scoreColor}`}
            >
              적합도 {scoreLabel}
            </span>
          </div>

          {reasons.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1.5">
                추천 이유
              </h4>
              <ul className="space-y-1">
                {reasons.map((reason, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <svg
                      className="h-4 w-4 text-green-500 mt-0.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missing_checks.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1.5">
                확인 필요
              </h4>
              <ul className="space-y-1">
                {missing_checks.map((check, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-500"
                  >
                    <svg
                      className="h-4 w-4 text-amber-500 mt-0.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
                      />
                    </svg>
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {official_url && (
            <a
              href={official_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${title} 공식 사이트에서 신청하기 (새 창)`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              공식 사이트에서 신청
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
