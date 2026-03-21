"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (session) {
      router.replace(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-md mx-auto space-y-8">
        {/* 로고 / 타이틀 */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-3.5 py-1.5 mb-2">
            <span className="text-xs font-semibold text-blue-600">부산 · 대구 청년 혜택</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">마지미 로그인</h1>
          <p className="text-gray-500 text-sm">
            카카오 계정으로 간편하게 시작하고<br />
            나에게 맞는 혜택을 받아보세요
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-100 space-y-4">
          {/* 카카오 로그인 버튼 */}
          <button
            onClick={() => signIn("kakao", { callbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-6 py-4 text-base font-semibold text-[#3A1D1D] hover:bg-[#F5DC00] active:bg-[#EDD000] transition-colors shadow-sm"
          >
            <KakaoLoginIcon />
            카카오 1-Tap 로그인
          </button>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            로그인하면{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-gray-600">
              서비스 이용약관
            </span>{" "}
            및{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-gray-600">
              개인정보 처리방침
            </span>
            에 동의합니다
          </p>
        </div>

        {/* 보안 안내 */}
        <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
          <LockIcon />
          <span>카카오 인증 서버를 통해 안전하게 로그인됩니다</span>
        </div>
      </div>
    </main>
  );
}

function KakaoLoginIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 1C4.582 1 1 3.895 1 7.455c0 2.275 1.52 4.27 3.813 5.41L3.95 16.15a.238.238 0 00.35.265l4.1-2.706c.197.014.396.02.6.02 4.418 0 8-2.895 8-6.455C17 3.895 13.418 1 9 1z"
        fill="#3A1D1D"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
