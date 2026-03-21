"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingProgress from "@/components/OnboardingProgress";
import { useOnboardingStore } from "@/store/onboarding";

const STATUSES = [
  { value: "대학생", label: "대학생" },
  { value: "휴학생", label: "휴학생" },
  { value: "졸업예정", label: "졸업예정" },
  { value: "취업준비생", label: "취업준비생" },
] as const;

const INCOME_BRACKETS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function OnboardingStep2() {
  const router = useRouter();
  const setStep2 = useOnboardingStore((s) => s.setStep2);
  const { region, birthYear } = useOnboardingStore();

  const [status, setStatus] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [incomeBracket, setIncomeBracket] = useState<number | null>(null);

  // Redirect if step1 wasn't completed
  if (!region || !birthYear) {
    if (typeof window !== "undefined") {
      router.replace("/onboarding");
    }
    return null;
  }

  const canSubmit = status !== "";

  function handleSubmit() {
    if (!canSubmit) return;
    setStep2(status, schoolName, incomeBracket);
    router.push("/preview");
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <OnboardingProgress currentStep={2} />

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          조금만 더 알려주세요
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          정확한 추천을 위한 추가 정보예요
        </p>

        {/* Enrollment Status */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            현재 신분
          </label>
          <div className="grid grid-cols-2 gap-3">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
                  status === s.value
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* School Name */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            학교명
            <span className="ml-1 text-xs font-normal text-gray-400">
              (선택)
            </span>
          </label>
          <input
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="예: 부산대학교"
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none transition-colors"
          />
        </div>

        {/* Income Bracket */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-700">
              소득구간
            </label>
            <button
              type="button"
              onClick={() => setIncomeBracket(null)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              건너뛰기
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {INCOME_BRACKETS.map((bracket) => (
              <button
                key={bracket}
                type="button"
                onClick={() => setIncomeBracket(bracket)}
                className={`rounded-lg border-2 py-2.5 text-sm font-semibold transition-all ${
                  incomeBracket === bracket
                    ? "border-blue-600 bg-blue-50 text-blue-600"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {bracket}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            1구간(최저) ~ 10구간(최고) / 모르면 건너뛰기
          </p>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full rounded-xl px-6 py-4 text-lg font-semibold transition-all ${
            canSubmit
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          맞춤 추천 보기
        </button>
      </div>
    </main>
  );
}
