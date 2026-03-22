# gemini advisor artifact

- Provider: gemini
- Exit code: 0
- Created at: 2026-03-22T12:00:06.075Z

## Original task

마지미 프로젝트 최종 UX/품질 검토. 디렉토리: /Users/woominseong/Desktop/창업. 1) 모바일 앱 UX 흐름에 끊기는 곳이 있는지 2) 사용자가 혼란을 느낄 수 있는 화면 전환 3) 오프라인 모드가 모든 화면에서 일관적인지 4) 에러 핸들링이 사용자 친화적인지 5) 접근성(accessibility) 이슈 6) 성능 최적화가 필요한 곳 7) 앱스토어 출시 전 필수 체크리스트. 한국어로 답변.

## Final prompt

마지미 프로젝트 최종 UX/품질 검토. 디렉토리: /Users/woominseong/Desktop/창업. 1) 모바일 앱 UX 흐름에 끊기는 곳이 있는지 2) 사용자가 혼란을 느낄 수 있는 화면 전환 3) 오프라인 모드가 모든 화면에서 일관적인지 4) 에러 핸들링이 사용자 친화적인지 5) 접근성(accessibility) 이슈 6) 성능 최적화가 필요한 곳 7) 앱스토어 출시 전 필수 체크리스트. 한국어로 답변.

## Raw output

```text
저는 마지미(Majimi) 모바일 앱의 UX 및 품질 검토를 위해 코드베이스 분석을 시작합니다. 먼저 전체적인 구조와 주요 기능을 파악하여 요청하신 7가지 항목에 대해 체계적으로 진단하겠습니다.

먼저 `codebase_investigator`를 사용하여 앱의 아키텍처와 주요 흐름을 파악하겠습니다.

마지미(Majimi) 모바일 앱의 UX 및 품질 검토 결과입니다. 코드베이스 분석을 통해 7가지 요청 사항에 대해 다음과 같이 진단 및 개선 방향을 도출했습니다.

---

### 1. 모바일 앱 UX 흐름 및 화면 전환 (1 & 2)
**진단:**
*   **네비게이션 구조:** Expo Router를 기반으로 `(tabs)`와 `onboarding/`이 명확히 분리되어 있습니다.
*   **연속성:** `app/_layout.tsx`에서 세션 복구(`SessionRestore`) 로직이 포함되어 있어, 앱 재시작 시 로그인 상태가 유지되며 적절한 화면(로그인 vs 메인)으로 분기됩니다.
*   **잠재적 이슈:** 온보딩 단계(`index` -> `step2` -> `step3`)에서 뒤로 가기 시 데이터 유실 여부를 확인해야 합니다. 현재 Zustand(`store/onboarding.ts`)를 사용하므로 데이터는 유지되지만, 마지막 단계 완료 후 메인 화면으로 진입할 때의 전환 애니메이션이 매끄러운지(Stack Reset 여부) 점검이 필요합니다.

### 2. 오프라인 모드 일관성 (3)
**진단:**
*   **구현 방식:** `lib/cache.ts`의 `cachedFetch`를 통해 **Stale-While-Revalidate** 패턴이 적용되어 있습니다. 네트워크 실패 시 `AsyncStorage`에 저장된 이전 데이터를 즉시 보여줍니다.
*   **일관성:** `lib/api.ts`에서 대부분의 GET 요청이 `cachedFetch`를 경유하도록 설계되어 있으나, `programs/[id].tsx`와 같은 상세 페이지에서 최신 데이터가 필수적인 경우 오프라인 시 '데이터가 오래되었음'을 알리는 UI 인디케이터가 부족합니다.
*   **개선 필요:** 모든 화면에서 오프라인 상태임을 인지할 수 있는 공통 배너나 토스트 알림이 일관되게 나타나야 합니다.

### 3. 에러 핸들링 및 사용자 친화성 (4)
**진단:**
*   **패턴:** `lib/api.ts`의 인터셉터가 401(토큰 만료) 에러를 전역적으로 처리하여 자동으로 로그아웃 시킵니다.
*   **UI 피드백:** `Alert.alert`를 주로 사용하며, 일부 복잡한 화면(`auto-fill.tsx`)에서는 커스텀 `Toast`를 개별 구현하여 사용 중입니다.
*   **문제점:** 에러 메시지가 "네트워크 오류", "서버 응답 없음" 등 기술적인 용어일 수 있습니다. 사용자에게 "잠시 후 다시 시도해 주세요"와 같은 행동 지침을 포함한 메시지로 순화가 필요합니다. 또한, 앱 전체를 감싸는 **Error Boundary**가 없어 런타임 에러 시 앱이 완전히 멈출 위험이 있습니다.

### 4. 접근성(Accessibility) 이슈 (5)
**진단:**
*   **현재 상태:** `accessibilityLabel`과 `accessibilityRole`이 주요 버튼에 적용되어 있어 기본적인 스크린 리더 대응은 되어 있습니다.
*   **개선 포인트:**
    *   **터치 영역:** `hitSlop`이 일부 버튼에만 적용되어 있습니다. 작은 아이콘 버튼들에 일괄 적용이 필요합니다.
    *   **명도 대비:** `constants/theme.ts`의 브랜드 컬러와 배경색 간의 대비가 저시력자를 위해 충분한지(WCAG 기준) 검토가 필요합니다.

### 5. 성능 최적화 (6)
**진단:**
*   **리스트 렌더링:** `explore.tsx` 등에서 대량의 프로그램을 보여줄 때 `FlatList`를 사용하고 있으나, 아이템 컴포넌트(`RecommendationCard.tsx`)에 `React.memo`가 적용되지 않아 스크롤 시 불필요한 재렌더링이 발생할 수 있습니다.
*   **이미지 최적화:** `expo-image`를 사용하여 캐싱과 부드러운 전환을 처리하고 있는 점은 훌륭합니다.

---

### 6. 앱스토어 출시 전 필수 체크리스트 (7)

#### ✅ 기능 및 UX
- [ ] **전역 Toast 통합:** `auto-fill.tsx` 등에 중복 구현된 Toast 로직을 공통 라이브러리(예: `react-native-toast-message`)로 통합.
- [ ] **오프라인 인디케이터:** 네트워크 연결 끊김 시 상단에 "오프라인 모드입니다" 알림 표시.
- [ ] **온보딩 Stack Reset:** 온보딩 완료 후 메인으로 이동할 때 `router.replace`를 사용하여 뒤로 가기로 온보딩에 재진입하지 못하도록 설정.

#### ✅ 안정성 및 에러
- [ ] **Global Error Boundary 구현:** 예기치 못한 크래시 발생 시 사용자에게 사과 메시지와 '앱 재시작' 버튼을 제공하는 화면 추가.
- [ ] **API 에러 메시지 검토:** 모든 에러 메시지를 사용자 친화적인 한국어 문구로 변경.

#### ✅ 성능 및 접근성
- [ ] **FlatList 최적화:** `getItemLayout` 적용 및 카드 컴포넌트 `Memoization`.
- [ ] **이미지 플레이스홀더:** 네트워크가 느릴 때 보여줄 뼈대 UI(Skeleton) 또는 기본 이미지 설정.
- [ ] **터치 영역 확장:** 모든 인터랙티브 요소에 `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` 적용.

#### ✅ 스토어 준비
- [ ] **개인정보 처리방침:** `app/privacy-policy.tsx` 내용이 최신 법규에 맞는지 최종 확인.
- [ ] **앱 아이콘 및 스플래시:** `assets/` 내 이미지들이 해상도별로 누락 없는지 확인 (`app.json` 설정).
- [ ] **권한 요청 문구:** 카메라, 갤러리 접근 등 권한 요청 시 사용자가 납득할 수 있는 구체적인 이유 명시 (`Info.plist` / `AndroidManifest.xml`).

마지미 프로젝트는 전반적으로 견고한 아키텍처를 가지고 있으나, **에러 핸들링의 일관성**과 **오프라인 상태에 대한 시각적 피드백**을 강화한다면 훨씬 높은 완성도로 출시할 수 있을 것으로 보입니다.


YOLO mode is enabled. All tool calls will be automatically approved.
Loaded cached credentials.
YOLO mode is enabled. All tool calls will be automatically approved.

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
