"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-10 w-24 rounded-xl bg-gray-100 animate-pulse" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "프로필"}
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm font-medium text-gray-700">
          {session.user.name}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("kakao")}
      className="inline-flex items-center gap-2 rounded-xl bg-[#FEE500] px-4 py-2.5 text-sm font-semibold text-[#3A1D1D] hover:bg-[#F5DC00] active:bg-[#EDD000] transition-colors"
    >
      <KakaoIcon />
      카카오 로그인
    </button>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="18"
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
