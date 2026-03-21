"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

const HIDE_NAV_PREFIXES = ["/admin", "/onboarding", "/login"];

function shouldHideNav(pathname: string) {
  return HIDE_NAV_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideNav = shouldHideNav(pathname);

  return (
    <>
      {/* 바텀네비 높이만큼 하단 패딩 확보 (네비 없는 페이지는 패딩 없음) */}
      <div className={hideNav ? "" : "pb-16"}>{children}</div>
      <BottomNav />
    </>
  );
}
