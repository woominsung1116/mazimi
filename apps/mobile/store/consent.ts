/**
 * store/consent.ts — 법적 동의 상태 관리
 *
 * 두 종류의 동의를 분리 관리한다 (개인정보보호법 23조 "끼워팔기 금지" 대응):
 *
 *  1. required   — 앱 최초 실행 시 필수 게이트(이용약관 + 개인정보 기본수집).
 *                   미동의 시 app/_layout.tsx의 Stack.Protected가 홈 진입을 차단한다.
 *  2. healthInsurance — 서류보관함에서 건강보험 자격득실확인서를 업로드하려 할 때만
 *                   요구되는 민감정보 별도 선택동의. 거부해도 다른 서류 보관 기능은
 *                   정상 동작해야 하므로 필수 게이트와 완전히 독립적으로 저장한다.
 *
 * 버전 관리: 각 동의 기록에 정책 버전 문자열을 함께 저장한다. 정책 내용이 개정되어
 * 버전 상수가 올라가면 `hasRequiredConsent()` / `hasHealthInsuranceConsent()`가 자동으로
 * false를 반환해 재동의를 유도한다.
 *
 * TODO(후속 — 법적 증빙 강화): 현재는 클라이언트(AsyncStorage) 저장만 한다. 분쟁 대응을
 * 위한 서버측 동의 감사로그(타임스탬프+버전+IP 등)는 별도 백엔드 작업으로 추가한다.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Policy versions — keep in sync with the "시행일" text in app/terms.tsx and
// app/privacy-policy.tsx. Bump the relevant constant whenever that document's
// content changes in a way that requires re-consent.
// ---------------------------------------------------------------------------

export const TERMS_VERSION = "2026-03-21";
export const PRIVACY_VERSION = "2026-07-02";
export const HEALTH_INSURANCE_CONSENT_VERSION = "2026-07-02";

const CONSENT_STORAGE_KEY = "mazimi_consent_v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequiredConsentRecord {
  termsAgreed: boolean;
  privacyAgreed: boolean;
  agreedAt: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
}

interface HealthInsuranceConsentRecord {
  agreed: boolean;
  agreedAt: string | null;
  version: string | null;
}

interface PersistedConsent {
  required: RequiredConsentRecord;
  healthInsurance: HealthInsuranceConsentRecord;
}

const EMPTY_REQUIRED: RequiredConsentRecord = {
  termsAgreed: false,
  privacyAgreed: false,
  agreedAt: null,
  termsVersion: null,
  privacyVersion: null,
};

const EMPTY_HEALTH_INSURANCE: HealthInsuranceConsentRecord = {
  agreed: false,
  agreedAt: null,
  version: null,
};

interface ConsentState {
  /** true once the AsyncStorage read on app start has resolved (avoids a false "not agreed" flash) */
  isLoaded: boolean;
  required: RequiredConsentRecord;
  healthInsurance: HealthInsuranceConsentRecord;

  loadConsent: () => Promise<void>;
  /** Records agreement to both required items (terms + privacy) at once, stamped with current versions. */
  agreeRequired: () => Promise<void>;
  /** Records the separate, independent sensitive-info (건강보험) consent. */
  agreeHealthInsurance: () => Promise<void>;

  /** True only if both required items are agreed AND the stored version matches the current policy version. */
  hasRequiredConsent: () => boolean;
  /** True only if health-insurance consent is agreed AND matches the current version. */
  hasHealthInsuranceConsent: () => boolean;
}

async function persist(next: Pick<ConsentState, "required" | "healthInsurance">) {
  const payload: PersistedConsent = {
    required: next.required,
    healthInsurance: next.healthInsurance,
  };
  try {
    await AsyncStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort — if persistence fails the in-memory state still reflects
    // the user's choice for this session; it will simply re-prompt next launch.
  }
}

export const useConsentStore = create<ConsentState>((set, get) => ({
  isLoaded: false,
  required: EMPTY_REQUIRED,
  healthInsurance: EMPTY_HEALTH_INSURANCE,

  loadConsent: async () => {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedConsent>;
        set({
          required: { ...EMPTY_REQUIRED, ...parsed.required },
          healthInsurance: { ...EMPTY_HEALTH_INSURANCE, ...parsed.healthInsurance },
          isLoaded: true,
        });
        return;
      }
    } catch {
      // Corrupt or unreadable — fall through and treat as "not yet agreed"
    }
    set({ isLoaded: true });
  },

  agreeRequired: async () => {
    const required: RequiredConsentRecord = {
      termsAgreed: true,
      privacyAgreed: true,
      agreedAt: new Date().toISOString(),
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    };
    set({ required });
    await persist({ required, healthInsurance: get().healthInsurance });
  },

  agreeHealthInsurance: async () => {
    const healthInsurance: HealthInsuranceConsentRecord = {
      agreed: true,
      agreedAt: new Date().toISOString(),
      version: HEALTH_INSURANCE_CONSENT_VERSION,
    };
    set({ healthInsurance });
    await persist({ required: get().required, healthInsurance });
  },

  hasRequiredConsent: () => {
    const { required } = get();
    return (
      required.termsAgreed &&
      required.privacyAgreed &&
      required.termsVersion === TERMS_VERSION &&
      required.privacyVersion === PRIVACY_VERSION
    );
  },

  hasHealthInsuranceConsent: () => {
    const { healthInsurance } = get();
    return (
      healthInsurance.agreed && healthInsurance.version === HEALTH_INSURANCE_CONSENT_VERSION
    );
  },
}));
