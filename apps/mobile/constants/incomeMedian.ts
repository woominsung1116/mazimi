/**
 * 기준 중위소득 기반 "대략적" 소득분위 추정 유틸.
 *
 * 목적: 청년 유저가 자기 소득분위(온보딩/프로필의 `incomeBracket`, 1~10 스케일 —
 * 1=최저, 10=최고, `store/onboarding.ts` 및 웹 온보딩과 동일 스케일)를 잘 몰라서
 * 입력을 건너뛰는 문제를 줄이기 위한 "가이드"용 계산. 정확한 자격 판정이 아니라
 * "대략 이 정도 구간" 안내용이다 — 실제 정책 신청 시에는 각 사업 공고의 소득 기준
 * (기준 중위소득 %, 건강보험료 등)을 반드시 별도로 확인해야 한다.
 *
 * 출처: 보건복지부 고시 "2025년 기준 중위소득" (가구원수별 월 기준, 원 단위).
 * 매년 갱신되는 고시 수치이므로 최신 정확한 금액은 복지로(bokjiro.go.kr) 또는
 * 정부24에서 재확인할 것. 여기 값은 안내 목적의 근사치로만 사용한다.
 */

/** 1인~6인 가구 기준 중위소득 (원/월). 7인 이상은 아래 공식으로 추정. */
const MEDIAN_INCOME_BY_HOUSEHOLD_SIZE: Record<number, number> = {
  1: 2_392_013,
  2: 3_932_658,
  3: 5_025_353,
  4: 6_097_773,
  5: 7_108_192,
  6: 8_064_805,
};

const MAX_TABLE_SIZE = 6;

/**
 * 가구원수에 대한 기준 중위소득(원/월)을 반환한다.
 * 7인 이상은 통계청/복지부가 실제로 쓰는 방식과 동일하게, 마지막 구간 증분
 * (6인 - 5인 가구 차액)을 인원수만큼 더해 추정한다.
 */
export function getMedianIncome(householdSize: number): number {
  const size = Math.max(1, Math.round(householdSize));
  if (size <= MAX_TABLE_SIZE) {
    return MEDIAN_INCOME_BY_HOUSEHOLD_SIZE[size];
  }
  const increment =
    MEDIAN_INCOME_BY_HOUSEHOLD_SIZE[6] - MEDIAN_INCOME_BY_HOUSEHOLD_SIZE[5];
  return (
    MEDIAN_INCOME_BY_HOUSEHOLD_SIZE[6] + (size - MAX_TABLE_SIZE) * increment
  );
}

/**
 * 기준 중위소득 대비 비율(%) → 자체 정의 1~10 소득분위 근사 매핑.
 *
 * 주의: 이는 통계청 공식 "소득 10분위" 자료가 아니라, 이 앱이 이미 쓰고 있는
 * 1(최저)~10(최고) 자기입력 스케일에 맞춰 대략적으로 매핑한 자체 기준이다.
 * 청년 정책 문서에서 흔히 쓰이는 "기준 중위소득 X% 이하" 문구와 맞춰 봤을 때
 * 합리적인 순서만 보장하며, 세밀한 경계값은 참고용이다.
 */
const BRACKET_THRESHOLDS: { maxPercent: number; bracket: number }[] = [
  { maxPercent: 50, bracket: 1 },
  { maxPercent: 75, bracket: 2 },
  { maxPercent: 100, bracket: 3 },
  { maxPercent: 120, bracket: 4 },
  { maxPercent: 150, bracket: 5 },
  { maxPercent: 180, bracket: 6 },
  { maxPercent: 220, bracket: 7 },
  { maxPercent: 300, bracket: 8 },
  { maxPercent: 400, bracket: 9 },
];

/** 중위소득 대비 % → 1~10 소득분위 근사값. */
export function percentToBracket(percentOfMedian: number): number {
  for (const { maxPercent, bracket } of BRACKET_THRESHOLDS) {
    if (percentOfMedian <= maxPercent) return bracket;
  }
  return 10;
}

export interface IncomeEstimate {
  /** 입력한 가구원수 */
  householdSize: number;
  /** 입력한 월 소득(원) */
  monthlyIncomeWon: number;
  /** 해당 가구원수의 기준 중위소득(원/월) */
  medianIncomeWon: number;
  /** 기준 중위소득 대비 비율(%), 반올림 */
  percentOfMedian: number;
  /** 근사 소득분위 (1=최저 ~ 10=최고) */
  bracket: number;
}

/**
 * 가구원수 + 월 소득(원)으로 대략적인 기준 중위소득 %와 소득분위를 추정한다.
 * 정확한 자격 판정이 아닌 "대략 이 구간" 안내용.
 */
export function estimateIncomeBracket(
  householdSize: number,
  monthlyIncomeWon: number
): IncomeEstimate {
  const medianIncomeWon = getMedianIncome(householdSize);
  const percentOfMedian = Math.round(
    (monthlyIncomeWon / medianIncomeWon) * 100
  );
  const bracket = percentToBracket(percentOfMedian);
  return {
    householdSize: Math.max(1, Math.round(householdSize)),
    monthlyIncomeWon,
    medianIncomeWon,
    percentOfMedian,
    bracket,
  };
}

/** 만원 단위 숫자 문자열 → 원 단위 정수. 잘못된 입력은 0. */
export function manwonToWon(manwonInput: string): number {
  const parsed = parseFloat(manwonInput.replace(/[^0-9.]/g, ""));
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 10_000);
}
