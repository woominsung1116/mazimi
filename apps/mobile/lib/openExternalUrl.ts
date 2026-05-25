/**
 * External application-URL launcher with a destination-domain confirmation.
 *
 * Program/apply URLs ultimately originate from external government APIs and the
 * DB, so before handing one to the system browser we (1) show the user which
 * domain they're about to visit and (2) flag domains that are NOT government /
 * public-institution domains as a phishing guardrail. We warn rather than block,
 * because legitimate scholarships live on private domains (e.g. careers.samsung.com).
 */
import { Alert, Linking } from "react-native";

/** Government / public-institution domain suffixes that need no extra caution. */
const TRUSTED_GOV_SUFFIXES = [".go.kr", ".or.kr", ".ac.kr", ".gov.kr"];
const TRUSTED_GOV_HOSTS = ["gov.kr", "go.kr"];

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the URL points at a .go.kr/.or.kr/.ac.kr/.gov.kr (or gov.kr) host. */
export function isTrustedGovHost(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  if (TRUSTED_GOV_HOSTS.includes(host)) return true;
  return TRUSTED_GOV_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

interface OpenApplyUrlCallbacks {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * Show a confirmation dialog naming the destination domain, then open it in the
 * external browser. Non-government domains get an extra caution line.
 */
export function openApplyUrl(
  url: string,
  { onSuccess, onError }: OpenApplyUrlCallbacks = {}
): void {
  const host = hostnameOf(url);
  if (!host) {
    onError?.("올바르지 않은 링크예요.");
    return;
  }

  const message = isTrustedGovHost(url)
    ? `${host} 사이트를 외부 브라우저에서 엽니다.`
    : `${host} 사이트를 외부 브라우저에서 엽니다.\n\n⚠️ 정부·공공기관(go.kr 등) 도메인이 아니에요. 주소가 맞는지 확인하고 진행하세요.`;

  Alert.alert("외부 신청 사이트로 이동", message, [
    { text: "취소", style: "cancel" },
    {
      text: "열기",
      onPress: async () => {
        try {
          const supported = await Linking.canOpenURL(url);
          if (!supported) {
            onError?.("이 링크를 열 수 없어요. 직접 검색해 주세요.");
            return;
          }
          await Linking.openURL(url);
          onSuccess?.();
        } catch {
          onError?.("신청 사이트를 여는 중 문제가 발생했어요.");
        }
      },
    },
  ]);
}
