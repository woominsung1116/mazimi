"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, USER_ID, ApplicationItem, ApplicationStatus } from "@/lib/api";
import DeadlineBadge from "@/components/DeadlineBadge";
import StatusBadge from "@/components/StatusBadge";
import ApplicationTracker from "@/components/ApplicationTracker";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .getApplications(USER_ID)
      .then((res) => {
        setApplications(res.applications);
        const initialMemos: Record<string, string> = {};
        res.applications.forEach((a) => {
          initialMemos[a.id] = a.memo || "";
        });
        setMemos(initialMemos);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatusChange(appId: string, newStatus: ApplicationStatus) {
    setSaving((prev) => ({ ...prev, [appId]: true }));
    try {
      const updated = await api.updateApplicationStatus(
        appId,
        newStatus,
        memos[appId] || "",
        USER_ID
      );
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? updated : a))
      );
    } catch {
      // keep optimistic update
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
      );
    } finally {
      setSaving((prev) => ({ ...prev, [appId]: false }));
    }
  }

  async function handleMemoSave(appId: string, status: ApplicationStatus) {
    setSaving((prev) => ({ ...prev, [appId]: true }));
    try {
      const updated = await api.updateApplicationStatus(
        appId,
        status,
        memos[appId] || "",
        USER_ID
      );
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? updated : a))
      );
    } finally {
      setSaving((prev) => ({ ...prev, [appId]: false }));
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">신청 현황</h1>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-center text-gray-500 py-12">데이터를 불러오지 못했습니다.</p>
      )}

      {!loading && !error && applications.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-500">신청 중인 프로그램이 없습니다.</p>
          <Link
            href="/programs"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            프로그램 둘러보기
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((app) => {
            const isExpanded = expandedId === app.id;
            return (
              <div
                key={app.id}
                className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <button
                  type="button"
                  className="w-full px-4 py-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded font-medium">
                          {app.program.type}
                        </span>
                        <DeadlineBadge deadline={app.program.deadline} />
                      </div>
                      <p className="font-semibold text-gray-900 truncate">{app.program.name}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{app.program.organization}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={app.status} />
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                    {/* Status tracker */}
                    <div>
                      <p className="text-xs text-gray-500 mb-2">신청 단계</p>
                      <ApplicationTracker
                        status={app.status}
                        onChange={(newStatus) => handleStatusChange(app.id, newStatus)}
                      />
                    </div>

                    {/* Memo */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">메모</p>
                      <textarea
                        value={memos[app.id] || ""}
                        onChange={(e) =>
                          setMemos((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                        placeholder="메모를 입력하세요..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleMemoSave(app.id, app.status)}
                        disabled={saving[app.id]}
                        className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {saving[app.id] ? "저장 중..." : "저장"}
                      </button>
                    </div>

                    {/* Link to program */}
                    <Link
                      href={`/programs/${app.program.id}`}
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                    >
                      프로그램 상세 보기
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
