"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/programs", label: "프로그램 관리" },
  { href: "/admin/sync", label: "데이터 동기화" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
            ← 앱으로
          </Link>
          <span className="text-gray-300">|</span>
          <span className="text-base font-bold text-gray-900">관리자</span>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          Admin
        </span>
      </header>

      {/* Auth warning banner — visible until real auth is wired */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        인증이 구현되기 전까지 이 페이지는 누구나 접근 가능합니다. AdminUser 역할 검사는 백엔드에서 수행됩니다.
      </div>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <nav className="w-52 bg-white border-r border-gray-200 p-4 hidden md:block shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            메뉴
          </p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-10">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                  isActive ? "text-teal-700" : "text-gray-500"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
