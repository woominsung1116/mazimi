"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type ApplicationDetail, type ApplicationStatus } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import ApplicationTracker from "@/components/ApplicationTracker";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .getMyApplications()
      .then((res) => {
        setApplications(res.items);
        const initialMemos: Record<string, string> = {};
        res.items.forEach((a) => {
          initialMemos[a.program_id] = a.memo || "";
        });
        setMemos(initialMemos);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatusChange(programId: string, newStatus: ApplicationStatus) {
    setSaving((prev) => ({ ...prev, [programId]: true }));
    try {
      const updated = await api.updateApplicationStatus(
        programId,
        newStatus,
        memos[programId] || ""
      );
      setApplications((prev) =>
        prev.map((a) =>
          a.program_id === programId
            ? { ...a, current_status: updated.status, memo: updated.memo, updated_at: updated.updated_at }
            : a
        )
      );
    } catch {
      // optimistic update
      setApplications((prev) =>
        prev.map((a) => (a.program_id === programId ? { ...a, current_status: newStatus } : a))
      );
    } finally {
      setSaving((prev) => ({ ...prev, [programId]: false }));
    }
  }

  async function handleMemoSave(programId: string, status: ApplicationStatus) {
    setSaving((prev) => ({ ...prev, [programId]: true }));
    try {
      const updated = await api.updateApplicationStatus(
        programId,
        status,
        memos[programId] || ""
      );
      setApplications((prev) =>
        prev.map((a) =>
          a.program_id === programId
            ? { ...a, current_status: updated.status, memo: updated.memo, updated_at: updated.updated_at }
            : a
        )
      );
    } finally {
      setSaving((prev) => ({ ...prev, [programId]: false }));
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
            className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
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
            const isExpanded = expandedId === app.program_id;
            return (
              <div
                key={app.program_id}
                className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <button
                  type="button"
                  className="w-full px-4 py-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : app.program_id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{app.program_title}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={app.current_status} />
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
                        status={app.current_status}
                        onChange={(newStatus) => handleStatusChange(app.program_id, newStatus)}
                      />
                    </div>

                    {/* Memo */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">메모</p>
                      <textarea
                        value={memos[app.program_id] || ""}
                        onChange={(e) =>
                          setMemos((prev) => ({ ...prev, [app.program_id]: e.target.value }))
                        }
                        placeholder="메모를 입력하세요..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleMemoSave(app.program_id, app.current_status)}
                        disabled={saving[app.program_id]}
                        className="mt-2 w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                      >
                        {saving[app.program_id] ? "저장 중..." : "저장"}
                      </button>
                    </div>

                    {/* Link to program */}
                    <Link
                      href={`/programs/${app.program_id}`}
                      className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
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
