"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api";

export default function AdminSyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await adminApi.triggerSync();
      setResult(res);
    } catch {
      setError("동기화 요청에 실패했습니다. 백엔드 서버 상태를 확인하세요.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">데이터 동기화</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">동기화 소스</p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>청년 센터 (Youth Center API)</li>
            <li>정부24 복지 혜택 (Gov Benefits API)</li>
          </ul>
        </div>

        <p className="text-sm text-gray-500">
          동기화를 실행하면 외부 소스에서 최신 정책·장학금 데이터를 가져와 DB에
          반영합니다. 작업은 백그라운드에서 실행되며 완료까지 수 분이 걸릴 수
          있습니다.
        </p>

        {result && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-700">
            <span className="font-medium">{result.status}</span> — {result.message}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              동기화 중...
            </>
          ) : (
            "지금 동기화 실행"
          )}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-medium mb-1">주의</p>
        <p>
          동기화는 환경변수(API 키)가 설정된 소스만 실행됩니다. 설정되지 않은
          소스는 건너뜁니다.
        </p>
      </div>
    </div>
  );
}
