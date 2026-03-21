"use client";

import { useEffect, useState } from "react";
import { api, USER_ID, AlertPreferences } from "@/lib/api";

const defaultPrefs: AlertPreferences = {
  deadline: true,
  new_program: true,
  profile_update: false,
  channels: {
    inApp: true,
    email: false,
  },
};

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  id: string;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, id, label, description }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4 py-3 cursor-pointer"
    >
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
          checked ? "bg-blue-600" : "bg-gray-200"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<AlertPreferences>(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Optimistically start with defaults; a GET endpoint can be added later
  }, []);

  function updateCategory(key: keyof Omit<AlertPreferences, "channels">, val: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function updateChannel(key: keyof AlertPreferences["channels"], val: boolean) {
    setPrefs((prev) => ({
      ...prev,
      channels: { ...prev.channels, [key]: val },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(false);
    try {
      await api.updateAlertPreferences(USER_ID, prefs);
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">알림 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          받고 싶은 알림 유형을 선택하세요
        </p>
      </div>

      {/* 카테고리별 토글 */}
      <section className="rounded-xl bg-white border border-gray-100 px-4 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-4 pb-1">
          알림 유형
        </h2>
        <div className="divide-y divide-gray-100">
          <Toggle
            id="toggle-deadline"
            checked={prefs.deadline}
            onChange={(val) => updateCategory("deadline", val)}
            label="마감 임박"
            description="신청 마감 7일 전·3일 전·당일에 알림"
          />
          <Toggle
            id="toggle-new-program"
            checked={prefs.new_program}
            onChange={(val) => updateCategory("new_program", val)}
            label="새 정책"
            description="내 프로필에 맞는 새 정책·장학금 등록 시 알림"
          />
          <Toggle
            id="toggle-profile-update"
            checked={prefs.profile_update}
            onChange={(val) => updateCategory("profile_update", val)}
            label="프로필 변경"
            description="프로필 정보가 업데이트되면 알림"
          />
        </div>
      </section>

      {/* 알림 채널 */}
      <section className="rounded-xl bg-white border border-gray-100 px-4 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-4 pb-1">
          알림 채널
        </h2>
        <div className="divide-y divide-gray-100">
          <Toggle
            id="toggle-inapp"
            checked={prefs.channels.inApp}
            onChange={(val) => updateChannel("inApp", val)}
            label="인앱 알림"
            description="앱 내 알림 벨을 통해 받기"
          />
          <Toggle
            id="toggle-email"
            checked={prefs.channels.email}
            onChange={(val) => updateChannel("email", val)}
            label="이메일 알림"
            description="등록한 이메일로 받기"
          />
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600 text-center">
          저장에 실패했습니다. 다시 시도해주세요.
        </p>
      )}

      {saved && !error && (
        <p className="text-sm text-green-600 text-center">
          설정이 저장되었습니다.
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {saving ? "저장 중..." : "저장하기"}
      </button>
    </main>
  );
}
