# codex advisor artifact

- Provider: codex
- Exit code: 0
- Created at: 2026-03-21T02:06:51.497Z

## Original task

iOS 시뮬레이터에서 카카오 OAuth 로그인 페이지 한글이 ?로 깨지는 문제. 환경: Expo SDK 52, EAS Development Build, iOS 시뮬레이터 (iPhone 17 Pro). 시도한 것: 1) expo-auth-session useAuthRequest → 깨짐 2) WebBrowser.openAuthSessionAsync → 깨짐 3) 시뮬레이터 언어 한국어(ko-KR) 설정 → 여전히 깨짐 4) presentationStyle FULL_SCREEN → 깨짐. 질문: 1) iOS 시뮬레이터의 ASWebAuthenticationSession에서 한글이 깨지는 근본 원인은? 2) Xcode 시뮬레이터에 한글 폰트를 설치하는 방법이 있는지 3) EAS Development Build vs Expo Go에서 차이가 있는지 4) 다른 개발자들이 이 문제를 어떻게 해결했는지 (웹 검색해서) 5) 카카오 SDK(react-native-kakao-login)를 쓰면 이 문제가 해결되는지 6) 근본적 해결책 vs 우회 방법. 한국어로 답변.

## Final prompt

iOS 시뮬레이터에서 카카오 OAuth 로그인 페이지 한글이 ?로 깨지는 문제. 환경: Expo SDK 52, EAS Development Build, iOS 시뮬레이터 (iPhone 17 Pro). 시도한 것: 1) expo-auth-session useAuthRequest → 깨짐 2) WebBrowser.openAuthSessionAsync → 깨짐 3) 시뮬레이터 언어 한국어(ko-KR) 설정 → 여전히 깨짐 4) presentationStyle FULL_SCREEN → 깨짐. 질문: 1) iOS 시뮬레이터의 ASWebAuthenticationSession에서 한글이 깨지는 근본 원인은? 2) Xcode 시뮬레이터에 한글 폰트를 설치하는 방법이 있는지 3) EAS Development Build vs Expo Go에서 차이가 있는지 4) 다른 개발자들이 이 문제를 어떻게 해결했는지 (웹 검색해서) 5) 카카오 SDK(react-native-kakao-login)를 쓰면 이 문제가 해결되는지 6) 근본적 해결책 vs 우회 방법. 한국어로 답변.

## Raw output

```text
결론부터 말하면, 이건 **Expo 코드 문제라기보다 iOS 시뮬레이터의 `ASWebAuthenticationSession`/Safari(WebKit) 쪽 렌더링 문제**로 보는 게 가장 타당합니다. 질문하신 4가지 시도에서 전부 동일하게 깨졌다면 더더욱 그렇습니다.

1. `ASWebAuthenticationSession`에서 한글이 깨지는 근본 원인  
`expo-auth-session`의 `useAuthRequest()`도, `expo-web-browser`의 `openAuthSessionAsync()`도 iOS에서는 결국 같은 `ASWebAuthenticationSession`을 탑니다. Expo 문서도 iOS에서 `openAuthSessionAsync()`가 `ASWebAuthenticationSession`으로 열린다고 명시합니다. 그래서 두 API를 바꿔도 증상이 같으면, 앱 코드가 아니라 **동일한 시스템 인증 세션**에서 깨지는 겁니다.  
제가 찾은 공식 문서 중 Apple이 “시뮬레이터에서 한국어가 물음표로 깨진다”를 직접 인정한 문서는 없었습니다. 다만 Apple 포럼에는 WebKit/font 로딩 쪽을 Apple 엔지니어가 “bug”라고 본 사례가 있고, 시뮬레이터/웹뷰/폰트 관련 이슈가 반복됩니다. 따라서 이 케이스는 **시뮬레이터 런타임의 폰트 fallback 또는 WebKit 렌더링 버그**라는 해석이 가장 안전합니다.  
즉, 근본 원인은 대체로:
- `ASWebAuthenticationSession`이 앱 내부 폰트가 아니라 **시스템 Safari 계열 렌더러**를 사용함
- 시뮬레이터 런타임에서 **한글 fallback/font cascade가 비정상**
- 그래서 글리프를 못 찾아 `?` 또는 fallback 형태로 보이는 것  
으로 보는 게 맞습니다. 이 부분은 **`presentationStyle`, Expo SDK, redirect 설정**으로 고칠 성격이 아닙니다.

2. Xcode 시뮬레이터에 한글 폰트를 설치할 수 있나  
실무적으로는 **신뢰할 수 있는 방법이 없다고 보는 게 맞습니다**.  
Apple의 공식 폰트 문서는 “앱 번들에 커스텀 폰트를 넣는 방법”은 안내하지만, **시뮬레이터 런타임 자체에 시스템 한글 폰트를 추가 설치해서 Safari/ASWebAuthenticationSession에 먹이는 방법**은 찾지 못했습니다.  
즉:
- 앱 UI용 폰트 추가: 가능
- `ASWebAuthenticationSession` 내부 웹 로그인 화면용 시스템 폰트 보강: 사실상 불가/비권장

3. EAS Development Build vs Expo Go 차이  
이 증상 자체에는 **거의 차이 없을 가능성이 큽니다**. 이유는 둘 다 해당 OAuth 흐름에서 iOS 시스템 인증 세션을 쓰기 때문입니다.  
차이는 여기서 생깁니다:
- `expo-auth-session`/`WebBrowser.openAuthSessionAsync` 사용 시: 둘 다 결국 같은 iOS 인증 세션
- **네이티브 카카오 SDK 사용 가능 여부**: Expo Go는 불가, Development Build는 가능  
즉,  
- **한글 깨짐 문제만 놓고 보면** Expo Go vs Dev Build 차이는 작고  
- **카카오 네이티브 SDK로 우회할 수 있느냐**에서는 Dev Build가 유리합니다.

4. 다른 개발자들은 어떻게 해결했나  
검색 결과, 완전한 “수정”보다는 아래 패턴이 많았습니다.
- **실기기에서 테스트/검증**  
  카카오 DevTalk에도 시뮬레이터에서만 로그인 이상, 흰 화면, 키보드 미표시 같은 사례가 반복됩니다. 실기기는 정상인 경우가 많았습니다.
- **시뮬레이터 상태 초기화**  
  쿠키/시간/네트워크 문제를 의심해서 시뮬레이터 재생성, Safari 데이터 초기화, 날짜/시간 정상화, 네트워크 정책 확인
- **네이티브 공급자 SDK 사용**  
  Expo도 공식적으로 가능하면 범용 OAuth 래퍼보다 공급자 전용 라이브러리를 권장합니다.
- **이 문제는 시뮬레이터 버그로 간주하고 QA 범위를 실기기로 옮김**  
  OAuth, 결제, SSO, Safari 연동 계열은 원래 실기기 검증 비중이 큽니다.

5. `react-native-kakao-login`을 쓰면 해결되나  
**조건부로만 해결됩니다.**
- 실기기 + 카카오톡 설치됨: 해결 가능성이 큼  
  카카오 SDK의 `loginWithKakaoTalk()`는 카카오톡 앱을 써서 로그인하므로, 웹 계정 입력 화면을 아예 안 거칠 수 있습니다.
- iOS 시뮬레이터: 근본 해결 안 될 가능성이 큼  
  시뮬레이터에는 보통 카카오톡 앱이 없으니 `loginWithKakaoAccount()` 또는 웹 로그인 fallback으로 가고, 그러면 다시 기본 브라우저/웹 인증 세션 문제를 밟을 수 있습니다.

즉 정리하면:
- **실기기 사용자 경험 개선용**으로는 네이티브 카카오 SDK가 맞음
- **시뮬레이터의 한글 깨짐 자체**를 없애는 만능 해결책은 아님

6. 근본적 해결책 vs 우회 방법  
근본적 해결책:
- **실기기에서 카카오 로그인 검증**
- 가능하면 **카카오 네이티브 SDK(`@react-native-seoul/kakao-login` 등)** 로 전환
- iOS 시뮬레이터의 OAuth 웹 화면은 참고용으로만 보고, 최종 QA는 실기기로 이동

우회 방법:
- 시뮬레이터에서는 “텍스트가 깨져도 로그인 플로우만 확인”
- 카카오 로그인 버튼을 눌렀을 때, 실기기에서는 `loginWithKakaoTalk()` 우선
- 시뮬레이터 전용으로 안내 문구 추가: “iOS Simulator의 OAuth 웹뷰/인증 세션에서 한글이 깨질 수 있음”
- 시뮬레이터 초기화, Safari 데이터 삭제, 새 시뮬레이터 생성, 다른 iOS runtime 테스트

제 판단:
- **질문하신 현상은 앱 버그가 아니라 iOS 시뮬레이터 한정 시스템 렌더링 이슈일 가능성이 높습니다.**
- **근본 대응은 실기기 검증 + 네이티브 카카오 SDK 도입**입니다.
- **시뮬레이터에서 웹 로그인 한글 표시까지 완벽히 맞추는 건 현실적으로 어렵습니다.**

참고 링크:
- Expo WebBrowser: https://docs.expo.dev/versions/latest/sdk/webbrowser/
- Expo AuthSession: https://docs.expo.dev/versions/latest/sdk/auth-session/
- Expo development build 소개: https://docs.expo.dev/develop/development-builds/introduction/
- Expo custom native code / Expo Go 제한: https://docs.expo.dev/workflow/customizing/
- Kakao iOS 로그인 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/ios
- `@react-native-seoul/kakao-login`: https://github.com/crossplatformkorea/react-native-kakao-login
- Apple 포럼 WebKit/font bug 사례: https://developer.apple.com/forums/thread/671608
- Kakao DevTalk 시뮬레이터 로그인 이상 사례 1: https://devtalk.kakao.com/t/ios-xcode/118901
- Kakao DevTalk 시뮬레이터 로그인 이상 사례 2: https://devtalk.kakao.com/t/ios-xcode-10-2-1-ios-12-2-2/78717
- Kakao DevTalk 시뮬레이터 키보드 이상 사례: https://devtalk.kakao.com/t/max/87615

원하시면 다음 답변에서 바로
1. **Expo SDK 52 + EAS Dev Build 기준으로 `@react-native-seoul/kakao-login` 붙이는 최소 설정**  
2. **시뮬레이터/실기기 분기 처리 예제 코드**  
로 이어서 정리해드리겠습니다.


OpenAI Codex v0.115.0 (research preview)
--------
workdir: /Users/woominseong/Desktop/창업/apps/mobile
model: gpt-5.4
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: none
reasoning summaries: none
session id: 019d0e22-e784-75d2-b3f0-67a5df501419
--------
user
iOS 시뮬레이터에서 카카오 OAuth 로그인 페이지 한글이 ?로 깨지는 문제. 환경: Expo SDK 52, EAS Development Build, iOS 시뮬레이터 (iPhone 17 Pro). 시도한 것: 1) expo-auth-session useAuthRequest → 깨짐 2) WebBrowser.openAuthSessionAsync → 깨짐 3) 시뮬레이터 언어 한국어(ko-KR) 설정 → 여전히 깨짐 4) presentationStyle FULL_SCREEN → 깨짐. 질문: 1) iOS 시뮬레이터의 ASWebAuthenticationSession에서 한글이 깨지는 근본 원인은? 2) Xcode 시뮬레이터에 한글 폰트를 설치하는 방법이 있는지 3) EAS Development Build vs Expo Go에서 차이가 있는지 4) 다른 개발자들이 이 문제를 어떻게 해결했는지 (웹 검색해서) 5) 카카오 SDK(react-native-kakao-login)를 쓰면 이 문제가 해결되는지 6) 근본적 해결책 vs 우회 방법. 한국어로 답변.
mcp startup: no servers
codex
문제 원인과 실제 사례를 분리해서 확인하겠습니다. 먼저 Apple 쪽 `ASWebAuthenticationSession`/시뮬레이터 이슈와, 그다음 Expo·카카오 관련 개발자 사례를 웹에서 교차 확인하겠습니다.
🌐 Searching the web...
🌐 Searched: ASWebAuthenticationSession simulator Korean question marks site:developer.apple.com
🌐 Searching the web...
🌐 Searched: site:developer.apple.com/forums ASWebAuthenticationSession simulator Korean
🌐 Searching the web...
🌐 Searched: site:developer.apple.com/forums iOS simulator install fonts
🌐 Searching the web...
🌐 Searched: Apple Simulator runtime Korean fonts missing iOS 18
🌐 Searching the web...
🌐 Searched: github expo auth session kakao simulator korean broken
🌐 Searching the web...
🌐 Searched: 카카오 로그인 iOS 시뮬레이터 한글 깨짐 ASWebAuthenticationSession
🌐 Searching the web...
🌐 Searched: "question marks" "iOS Simulator" Safari Korean
🌐 Searching the web...
🌐 Searched: site:docs.expo.dev Expo Go development build native libraries auth session
🌐 Searching the web...
🌐 Searched: https://docs.expo.dev/versions/latest/sdk/webbrowser
🌐 Searching the web...
🌐 Searched: 'Expo Go' in https://github.com/crossplatformkorea/react-native-kakao-login
🌐 Searching the web...
🌐 Searched: site:github.com/issues "ASWebAuthenticationSession" simulator Korean font
🌐 Searching the web...
🌐 Searched: "iOS Simulator" install fonts site:stackoverflow.com
🌐 Searching the web...
🌐 Searched: site:devtalk.kakao.com iOS 시뮬레이터 카카오 로그인 실제 기기 정상
🌐 Searching the web...
🌐 Searched: https://devtalk.kakao.com/t/ios-xcode/118901
🌐 Searching the web...
🌐 Searched: "ASWebAuthenticationSession" simulator broken fonts workaround "real device"
🌐 Searching the web...
🌐 Searched: site:developer.apple.com LastResort font Apple
codex
결론부터 말하면, 이건 **Expo 코드 문제라기보다 iOS 시뮬레이터의 `ASWebAuthenticationSession`/Safari(WebKit) 쪽 렌더링 문제**로 보는 게 가장 타당합니다. 질문하신 4가지 시도에서 전부 동일하게 깨졌다면 더더욱 그렇습니다.

1. `ASWebAuthenticationSession`에서 한글이 깨지는 근본 원인  
`expo-auth-session`의 `useAuthRequest()`도, `expo-web-browser`의 `openAuthSessionAsync()`도 iOS에서는 결국 같은 `ASWebAuthenticationSession`을 탑니다. Expo 문서도 iOS에서 `openAuthSessionAsync()`가 `ASWebAuthenticationSession`으로 열린다고 명시합니다. 그래서 두 API를 바꿔도 증상이 같으면, 앱 코드가 아니라 **동일한 시스템 인증 세션**에서 깨지는 겁니다.  
제가 찾은 공식 문서 중 Apple이 “시뮬레이터에서 한국어가 물음표로 깨진다”를 직접 인정한 문서는 없었습니다. 다만 Apple 포럼에는 WebKit/font 로딩 쪽을 Apple 엔지니어가 “bug”라고 본 사례가 있고, 시뮬레이터/웹뷰/폰트 관련 이슈가 반복됩니다. 따라서 이 케이스는 **시뮬레이터 런타임의 폰트 fallback 또는 WebKit 렌더링 버그**라는 해석이 가장 안전합니다.  
즉, 근본 원인은 대체로:
- `ASWebAuthenticationSession`이 앱 내부 폰트가 아니라 **시스템 Safari 계열 렌더러**를 사용함
- 시뮬레이터 런타임에서 **한글 fallback/font cascade가 비정상**
- 그래서 글리프를 못 찾아 `?` 또는 fallback 형태로 보이는 것  
으로 보는 게 맞습니다. 이 부분은 **`presentationStyle`, Expo SDK, redirect 설정**으로 고칠 성격이 아닙니다.

2. Xcode 시뮬레이터에 한글 폰트를 설치할 수 있나  
실무적으로는 **신뢰할 수 있는 방법이 없다고 보는 게 맞습니다**.  
Apple의 공식 폰트 문서는 “앱 번들에 커스텀 폰트를 넣는 방법”은 안내하지만, **시뮬레이터 런타임 자체에 시스템 한글 폰트를 추가 설치해서 Safari/ASWebAuthenticationSession에 먹이는 방법**은 찾지 못했습니다.  
즉:
- 앱 UI용 폰트 추가: 가능
- `ASWebAuthenticationSession` 내부 웹 로그인 화면용 시스템 폰트 보강: 사실상 불가/비권장

3. EAS Development Build vs Expo Go 차이  
이 증상 자체에는 **거의 차이 없을 가능성이 큽니다**. 이유는 둘 다 해당 OAuth 흐름에서 iOS 시스템 인증 세션을 쓰기 때문입니다.  
차이는 여기서 생깁니다:
- `expo-auth-session`/`WebBrowser.openAuthSessionAsync` 사용 시: 둘 다 결국 같은 iOS 인증 세션
- **네이티브 카카오 SDK 사용 가능 여부**: Expo Go는 불가, Development Build는 가능  
즉,  
- **한글 깨짐 문제만 놓고 보면** Expo Go vs Dev Build 차이는 작고  
- **카카오 네이티브 SDK로 우회할 수 있느냐**에서는 Dev Build가 유리합니다.

4. 다른 개발자들은 어떻게 해결했나  
검색 결과, 완전한 “수정”보다는 아래 패턴이 많았습니다.
- **실기기에서 테스트/검증**  
  카카오 DevTalk에도 시뮬레이터에서만 로그인 이상, 흰 화면, 키보드 미표시 같은 사례가 반복됩니다. 실기기는 정상인 경우가 많았습니다.
- **시뮬레이터 상태 초기화**  
  쿠키/시간/네트워크 문제를 의심해서 시뮬레이터 재생성, Safari 데이터 초기화, 날짜/시간 정상화, 네트워크 정책 확인
- **네이티브 공급자 SDK 사용**  
  Expo도 공식적으로 가능하면 범용 OAuth 래퍼보다 공급자 전용 라이브러리를 권장합니다.
- **이 문제는 시뮬레이터 버그로 간주하고 QA 범위를 실기기로 옮김**  
  OAuth, 결제, SSO, Safari 연동 계열은 원래 실기기 검증 비중이 큽니다.

5. `react-native-kakao-login`을 쓰면 해결되나  
**조건부로만 해결됩니다.**
- 실기기 + 카카오톡 설치됨: 해결 가능성이 큼  
  카카오 SDK의 `loginWithKakaoTalk()`는 카카오톡 앱을 써서 로그인하므로, 웹 계정 입력 화면을 아예 안 거칠 수 있습니다.
- iOS 시뮬레이터: 근본 해결 안 될 가능성이 큼  
  시뮬레이터에는 보통 카카오톡 앱이 없으니 `loginWithKakaoAccount()` 또는 웹 로그인 fallback으로 가고, 그러면 다시 기본 브라우저/웹 인증 세션 문제를 밟을 수 있습니다.

즉 정리하면:
- **실기기 사용자 경험 개선용**으로는 네이티브 카카오 SDK가 맞음
- **시뮬레이터의 한글 깨짐 자체**를 없애는 만능 해결책은 아님

6. 근본적 해결책 vs 우회 방법  
근본적 해결책:
- **실기기에서 카카오 로그인 검증**
- 가능하면 **카카오 네이티브 SDK(`@react-native-seoul/kakao-login` 등)** 로 전환
- iOS 시뮬레이터의 OAuth 웹 화면은 참고용으로만 보고, 최종 QA는 실기기로 이동

우회 방법:
- 시뮬레이터에서는 “텍스트가 깨져도 로그인 플로우만 확인”
- 카카오 로그인 버튼을 눌렀을 때, 실기기에서는 `loginWithKakaoTalk()` 우선
- 시뮬레이터 전용으로 안내 문구 추가: “iOS Simulator의 OAuth 웹뷰/인증 세션에서 한글이 깨질 수 있음”
- 시뮬레이터 초기화, Safari 데이터 삭제, 새 시뮬레이터 생성, 다른 iOS runtime 테스트

제 판단:
- **질문하신 현상은 앱 버그가 아니라 iOS 시뮬레이터 한정 시스템 렌더링 이슈일 가능성이 높습니다.**
- **근본 대응은 실기기 검증 + 네이티브 카카오 SDK 도입**입니다.
- **시뮬레이터에서 웹 로그인 한글 표시까지 완벽히 맞추는 건 현실적으로 어렵습니다.**

참고 링크:
- Expo WebBrowser: https://docs.expo.dev/versions/latest/sdk/webbrowser/
- Expo AuthSession: https://docs.expo.dev/versions/latest/sdk/auth-session/
- Expo development build 소개: https://docs.expo.dev/develop/development-builds/introduction/
- Expo custom native code / Expo Go 제한: https://docs.expo.dev/workflow/customizing/
- Kakao iOS 로그인 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/ios
- `@react-native-seoul/kakao-login`: https://github.com/crossplatformkorea/react-native-kakao-login
- Apple 포럼 WebKit/font bug 사례: https://developer.apple.com/forums/thread/671608
- Kakao DevTalk 시뮬레이터 로그인 이상 사례 1: https://devtalk.kakao.com/t/ios-xcode/118901
- Kakao DevTalk 시뮬레이터 로그인 이상 사례 2: https://devtalk.kakao.com/t/ios-xcode-10-2-1-ios-12-2-2/78717
- Kakao DevTalk 시뮬레이터 키보드 이상 사례: https://devtalk.kakao.com/t/max/87615

원하시면 다음 답변에서 바로
1. **Expo SDK 52 + EAS Dev Build 기준으로 `@react-native-seoul/kakao-login` 붙이는 최소 설정**  
2. **시뮬레이터/실기기 분기 처리 예제 코드**  
로 이어서 정리해드리겠습니다.
tokens used
99,606

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
