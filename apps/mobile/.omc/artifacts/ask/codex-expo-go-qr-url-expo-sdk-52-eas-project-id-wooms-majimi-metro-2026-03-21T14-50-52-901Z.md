# codex advisor artifact

- Provider: codex
- Exit code: 0
- Created at: 2026-03-21T14:50:52.902Z

## Original task

Expo Go에서 QR 스캔이 안 되고 직접 URL 입력도 실패할 때 폰에서 테스트하는 모든 가능한 방법. 환경: Expo SDK 52, EAS project ID 있음 (@wooms/majimi), Metro 서버 실행 중, 같은 WiFi인데 AP 격리 의심. 구체적 해결방법 5가지 이상. 한국어로.

## Final prompt

Expo Go에서 QR 스캔이 안 되고 직접 URL 입력도 실패할 때 폰에서 테스트하는 모든 가능한 방법. 환경: Expo SDK 52, EAS project ID 있음 (@wooms/majimi), Metro 서버 실행 중, 같은 WiFi인데 AP 격리 의심. 구체적 해결방법 5가지 이상. 한국어로.

## Raw output

```text
2026-03-21 기준, 지금 상황이 `같은 Wi‑Fi인데도 Expo Go에서 QR 스캔/직접 URL 입력 둘 다 실패`라면 가장 유력한 원인은 말씀하신 대로 AP 격리(client isolation)입니다. 이 경우 핵심은 `로컬 LAN 접속을 버리거나`, `USB/개별 빌드로 우회`하는 겁니다.

가장 실전적인 방법부터 적으면 이 순서입니다.

1. `--tunnel`로 Metro를 외부 URL로 노출해서 Expo Go 또는 dev build에서 접속  
   `npx expo start --tunnel`  
   Expo 공식 문서도 LAN이 막히는 공용/제한 네트워크에서는 Tunnel을 쓰라고 안내합니다. 단점은 LAN보다 느립니다.  
   지금 조건에서는 제일 먼저 시도할 값어치가 있습니다.  
   출처: https://docs.expo.dev/get-started/start-developing/ , https://docs.expo.dev/develop/development-builds/development-workflows/

2. Expo Go를 포기하고 `development build`로 전환  
   SDK 52에서는 `expo-dev-client` + dev build가 사실상 정석 우회책입니다.  
   `npx expo install expo-dev-client`  
   `eas build --platform android --profile development`  
   `eas build --platform ios --profile development`  
   설치 후에는 `npx expo start`만 다시 띄우면 되고, Expo 문서상 `expo-dev-client`가 있으면 개발 빌드를 대상으로 동작합니다.  
   EAS project가 이미 있으니 이 경로가 잘 맞습니다.  
   출처: https://docs.expo.dev/develop/development-builds/create-a-build/ , https://docs.expo.dev/develop/development-builds/expo-go-to-dev-build/

3. Android 폰 USB 직결 + 로컬 빌드로 바로 설치  
   Android는 네트워크를 완전히 우회할 수 있어서 AP 격리 의심일 때 강합니다.  
   `npx expo run:android --device`  
   Expo 공식 문서상 `run:android`는 앱을 기기에 설치하고 Metro까지 같이 시작하며, `--device`로 연결된 실기기를 선택할 수 있습니다.  
   추가 실전 팁: Android는 `adb reverse tcp:8081 tcp:8081` 조합이 잘 먹습니다. 이건 Expo 문서의 직접 문구는 아니고 React Native/ADB 계열에서 널리 쓰는 실무 우회입니다. 이 경우 `npx expo start --localhost`와 같이 쓰면 LAN 없이도 붙는 경우가 많습니다.  
   출처: https://docs.expo.dev/guides/local-app-development/ , https://docs.expo.dev/more/expo-cli/

4. iPhone USB 직결 + 로컬 dev build 설치  
   macOS라면  
   `npx expo run:ios --device`  
   로 실기기에 바로 올릴 수 있습니다. iOS 16+는 `Developer Mode`를 켜야 dev/internal build 실행이 됩니다.  
   네트워크가 막혀도 “설치” 자체는 USB로 해결되고, 이후 Metro는 Tunnel 또는 다른 네트워크 우회와 조합하면 됩니다.  
   출처: https://docs.expo.dev/more/expo-cli/ , https://docs.expo.dev/guides/ios-developer-mode/

5. EAS Build 산출물을 폰에 직접 설치해서 테스트  
   로컬 네트워크 대신 빌드 파일 자체를 폰에 넣는 방식입니다.  
   Android는 APK로 빌드해서 링크로 직접 다운로드하거나 `adb install` 할 수 있습니다.  
   iOS dev build는 EAS 대시보드의 `Install` QR 또는 `Expo Orbit`로 설치할 수 있습니다. Orbit는 USB 연결 설치도 지원합니다.  
   출처: https://docs.expo.dev/build-reference/apk/ , https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/ , https://docs.expo.dev/develop/development-builds/share-with-your-team/

6. Metro 자체를 안 쓰고 `EAS Update`로 폰 테스트  
   네트워크가 계속 말썽이면 아예 JS 번들을 Expo 서버에 올리고 폰에서 그 업데이트를 받게 하면 됩니다.  
   `eas update --channel preview --message "test"`  
   development build에서는 수동 URL 입력으로 특정 채널 업데이트를 열 수 있습니다. 형식은:  
   `https://u.expo.dev/[project-id]?channel-name=[channel]`  
   즉, 로컬 Metro가 안 보여도 폰 테스트는 가능합니다.  
   단, 이 방식은 “코드 변경을 즉시 라이브로 본다”보다는 “업데이트 배포 후 확인” 흐름입니다.  
   출처: https://docs.expo.dev/develop/development-builds/development-workflows/ , https://docs.expo.dev/eas-update/getting-started/ , https://docs.expo.dev/build/updates/

7. Wi‑Fi를 바꾸거나 테더링으로 같은 “단일 네트워크”를 강제로 만들기  
   이건 공식 Expo 명령은 아니지만 AP 격리 의심일 때 매우 자주 해결됩니다.  
   방법은:
   - 공유기 관리자에서 AP isolation / client isolation 끄기
   - 회사/학교/카페 Wi‑Fi 대신 개인 공유기 사용
   - 노트북 또는 폰 핫스팟으로 둘 다 같은 핫스팟에 물리기
   - Android USB 테더링으로 노트북과 폰을 사실상 같은 네트워크로 만들기  
   그 뒤 `npx expo start --lan` 또는 `--tunnel` 재시도

지금 환경에 맞는 추천 우선순서는 이렇습니다.

1. `npx expo start --tunnel`
2. 안 되면 `expo-dev-client` 넣고 EAS dev build 생성
3. Android면 `npx expo run:android --device` + 필요 시 `adb reverse`
4. iPhone이면 `npx expo run:ios --device` + Developer Mode
5. 계속 막히면 `eas update --channel preview`로 OTA 테스트 전환

직접 URL 입력이 실패하는 이유도 구분해야 합니다.

- Expo Go에서 로컬 `exp://...` URL이 실패하면 대개 LAN 차단 문제입니다.
- development build의 “Enter URL manually”는 로컬 dev server URL 말고도 `https://u.expo.dev/[project-id]?channel-name=[channel]` 형태의 EAS Update URL을 넣을 수 있습니다. 이건 로컬 네트워크를 안 타므로 성격이 다릅니다.

원하시면 다음 단계로 바로 이어서, 지금 프로젝트 `@wooms/majimi` 기준으로
`Android 우선 최소 절차`
또는
`iPhone 우선 최소 절차`
형태로 명령어만 추린 5분짜리 실행 순서를 적어드리겠습니다.


OpenAI Codex v0.115.0 (research preview)
--------
workdir: /Users/woominseong/Desktop/창업/apps/mobile
model: gpt-5.4
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: none
reasoning summaries: none
session id: 019d10df-b316-7fa2-bc99-bd2030d57f2f
--------
user
Expo Go에서 QR 스캔이 안 되고 직접 URL 입력도 실패할 때 폰에서 테스트하는 모든 가능한 방법. 환경: Expo SDK 52, EAS project ID 있음 (@wooms/majimi), Metro 서버 실행 중, 같은 WiFi인데 AP 격리 의심. 구체적 해결방법 5가지 이상. 한국어로.
mcp startup: no servers
codex
Expo SDK 52 기준으로, Expo Go에서 QR/직접 URL 모두 막힐 때 폰 테스트 우회 경로를 공식 문서 기준으로 확인하겠습니다. 먼저 Expo 문서에서 SDK 52의 로컬 개발 접속 방식과 EAS/개발 빌드 관련 옵션을 확인한 뒤, 지금 환경에 맞는 실전 절차로 정리하겠습니다.
🌐 Searching the web...
🌐 Searched: site:docs.expo.dev Expo SDK 52 Expo Go tunnel lan localhost USB Android iOS development build EAS
🌐 Searching the web...
🌐 Searched: https://docs.expo.dev/get-started/start-developing
🌐 Searching the web...
🌐 Searched: site:docs.expo.dev expo start --localhost physical device adb reverse expo docs
🌐 Searching the web...
🌐 Searched: site:docs.expo.dev eas update channel-name docs expo development build update URL
🌐 Searching the web...
🌐 Searched: site:docs.expo.dev npx expo run:android physical device usb docs
codex
2026-03-21 기준, 지금 상황이 `같은 Wi‑Fi인데도 Expo Go에서 QR 스캔/직접 URL 입력 둘 다 실패`라면 가장 유력한 원인은 말씀하신 대로 AP 격리(client isolation)입니다. 이 경우 핵심은 `로컬 LAN 접속을 버리거나`, `USB/개별 빌드로 우회`하는 겁니다.

가장 실전적인 방법부터 적으면 이 순서입니다.

1. `--tunnel`로 Metro를 외부 URL로 노출해서 Expo Go 또는 dev build에서 접속  
   `npx expo start --tunnel`  
   Expo 공식 문서도 LAN이 막히는 공용/제한 네트워크에서는 Tunnel을 쓰라고 안내합니다. 단점은 LAN보다 느립니다.  
   지금 조건에서는 제일 먼저 시도할 값어치가 있습니다.  
   출처: https://docs.expo.dev/get-started/start-developing/ , https://docs.expo.dev/develop/development-builds/development-workflows/

2. Expo Go를 포기하고 `development build`로 전환  
   SDK 52에서는 `expo-dev-client` + dev build가 사실상 정석 우회책입니다.  
   `npx expo install expo-dev-client`  
   `eas build --platform android --profile development`  
   `eas build --platform ios --profile development`  
   설치 후에는 `npx expo start`만 다시 띄우면 되고, Expo 문서상 `expo-dev-client`가 있으면 개발 빌드를 대상으로 동작합니다.  
   EAS project가 이미 있으니 이 경로가 잘 맞습니다.  
   출처: https://docs.expo.dev/develop/development-builds/create-a-build/ , https://docs.expo.dev/develop/development-builds/expo-go-to-dev-build/

3. Android 폰 USB 직결 + 로컬 빌드로 바로 설치  
   Android는 네트워크를 완전히 우회할 수 있어서 AP 격리 의심일 때 강합니다.  
   `npx expo run:android --device`  
   Expo 공식 문서상 `run:android`는 앱을 기기에 설치하고 Metro까지 같이 시작하며, `--device`로 연결된 실기기를 선택할 수 있습니다.  
   추가 실전 팁: Android는 `adb reverse tcp:8081 tcp:8081` 조합이 잘 먹습니다. 이건 Expo 문서의 직접 문구는 아니고 React Native/ADB 계열에서 널리 쓰는 실무 우회입니다. 이 경우 `npx expo start --localhost`와 같이 쓰면 LAN 없이도 붙는 경우가 많습니다.  
   출처: https://docs.expo.dev/guides/local-app-development/ , https://docs.expo.dev/more/expo-cli/

4. iPhone USB 직결 + 로컬 dev build 설치  
   macOS라면  
   `npx expo run:ios --device`  
   로 실기기에 바로 올릴 수 있습니다. iOS 16+는 `Developer Mode`를 켜야 dev/internal build 실행이 됩니다.  
   네트워크가 막혀도 “설치” 자체는 USB로 해결되고, 이후 Metro는 Tunnel 또는 다른 네트워크 우회와 조합하면 됩니다.  
   출처: https://docs.expo.dev/more/expo-cli/ , https://docs.expo.dev/guides/ios-developer-mode/

5. EAS Build 산출물을 폰에 직접 설치해서 테스트  
   로컬 네트워크 대신 빌드 파일 자체를 폰에 넣는 방식입니다.  
   Android는 APK로 빌드해서 링크로 직접 다운로드하거나 `adb install` 할 수 있습니다.  
   iOS dev build는 EAS 대시보드의 `Install` QR 또는 `Expo Orbit`로 설치할 수 있습니다. Orbit는 USB 연결 설치도 지원합니다.  
   출처: https://docs.expo.dev/build-reference/apk/ , https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/ , https://docs.expo.dev/develop/development-builds/share-with-your-team/

6. Metro 자체를 안 쓰고 `EAS Update`로 폰 테스트  
   네트워크가 계속 말썽이면 아예 JS 번들을 Expo 서버에 올리고 폰에서 그 업데이트를 받게 하면 됩니다.  
   `eas update --channel preview --message "test"`  
   development build에서는 수동 URL 입력으로 특정 채널 업데이트를 열 수 있습니다. 형식은:  
   `https://u.expo.dev/[project-id]?channel-name=[channel]`  
   즉, 로컬 Metro가 안 보여도 폰 테스트는 가능합니다.  
   단, 이 방식은 “코드 변경을 즉시 라이브로 본다”보다는 “업데이트 배포 후 확인” 흐름입니다.  
   출처: https://docs.expo.dev/develop/development-builds/development-workflows/ , https://docs.expo.dev/eas-update/getting-started/ , https://docs.expo.dev/build/updates/

7. Wi‑Fi를 바꾸거나 테더링으로 같은 “단일 네트워크”를 강제로 만들기  
   이건 공식 Expo 명령은 아니지만 AP 격리 의심일 때 매우 자주 해결됩니다.  
   방법은:
   - 공유기 관리자에서 AP isolation / client isolation 끄기
   - 회사/학교/카페 Wi‑Fi 대신 개인 공유기 사용
   - 노트북 또는 폰 핫스팟으로 둘 다 같은 핫스팟에 물리기
   - Android USB 테더링으로 노트북과 폰을 사실상 같은 네트워크로 만들기  
   그 뒤 `npx expo start --lan` 또는 `--tunnel` 재시도

지금 환경에 맞는 추천 우선순서는 이렇습니다.

1. `npx expo start --tunnel`
2. 안 되면 `expo-dev-client` 넣고 EAS dev build 생성
3. Android면 `npx expo run:android --device` + 필요 시 `adb reverse`
4. iPhone이면 `npx expo run:ios --device` + Developer Mode
5. 계속 막히면 `eas update --channel preview`로 OTA 테스트 전환

직접 URL 입력이 실패하는 이유도 구분해야 합니다.

- Expo Go에서 로컬 `exp://...` URL이 실패하면 대개 LAN 차단 문제입니다.
- development build의 “Enter URL manually”는 로컬 dev server URL 말고도 `https://u.expo.dev/[project-id]?channel-name=[channel]` 형태의 EAS Update URL을 넣을 수 있습니다. 이건 로컬 네트워크를 안 타므로 성격이 다릅니다.

원하시면 다음 단계로 바로 이어서, 지금 프로젝트 `@wooms/majimi` 기준으로
`Android 우선 최소 절차`
또는
`iPhone 우선 최소 절차`
형태로 명령어만 추린 5분짜리 실행 순서를 적어드리겠습니다.
tokens used
24,579

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
