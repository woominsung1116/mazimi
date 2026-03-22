# codex advisor artifact

- Provider: codex
- Exit code: 0
- Created at: 2026-03-21T01:55:24.276Z

## Original task

마지미 프로젝트 코드 검증. /Users/woominseong/Desktop/창업 디렉토리의 모바일 앱(apps/mobile)을 검증해줘. 특히: 1) app/(tabs) 4개 탭 화면의 네비게이션 흐름이 일관적인지 2) lib/api.ts의 API 엔드포인트와 crates/api/src/routes/ 의 실제 라우트가 매칭되는지 3) store/auth.ts와 _layout.tsx의 인증 흐름이 정상인지 4) 모든 화면에서 import가 깨진 게 없는지 5) 신청 어시스턴트(apply-assistant.tsx) → 상세페이지(programs/[id].tsx) → 자동채우기(auto-fill.tsx) 흐름이 매끄러운지. 파일들을 읽고 검증해줘. 한국어로 답변.

## Final prompt

마지미 프로젝트 코드 검증. /Users/woominseong/Desktop/창업 디렉토리의 모바일 앱(apps/mobile)을 검증해줘. 특히: 1) app/(tabs) 4개 탭 화면의 네비게이션 흐름이 일관적인지 2) lib/api.ts의 API 엔드포인트와 crates/api/src/routes/ 의 실제 라우트가 매칭되는지 3) store/auth.ts와 _layout.tsx의 인증 흐름이 정상인지 4) 모든 화면에서 import가 깨진 게 없는지 5) 신청 어시스턴트(apply-assistant.tsx) → 상세페이지(programs/[id].tsx) → 자동채우기(auto-fill.tsx) 흐름이 매끄러운지. 파일들을 읽고 검증해줘. 한국어로 답변.

## Raw output

```text
**검증 결과**

주요 문제부터 적습니다.

1. 인증 복원 흐름이 현재는 정상 동작하지 않습니다. [`store/auth.ts`](/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts#L58)에서 세션 복원 시 `GET /api/v1/auth/me`를 호출하는데, 서버 라우터에는 이 엔드포인트가 등록되어 있지 않습니다. 실제 등록된 auth 라우트는 [`crates/api/src/lib.rs`](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs#L40)와 [`crates/api/src/routes/auth.rs`](/Users/woominseong/Desktop/창업/crates/api/src/routes/auth.rs#L36)에 있는 `POST /api/v1/auth/kakao`뿐입니다. 결과적으로 앱 재시작 후 저장된 토큰이 있어도 세션이 복원되지 않고 로그아웃 상태로 떨어집니다.

2. 인증 게이트가 없습니다. 루트 레이아웃은 세션 복원만 하고 어떤 화면으로 보낼지 결정하지 않습니다. [`app/_layout.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx#L16)에는 `restoreSession()`만 있고, 토큰 유무에 따라 `/login` 또는 `/(tabs)`로 리다이렉트하는 로직이 없습니다. 반대로 로그인 성공과 “둘러보기” 둘 다 바로 `/(tabs)`로 보냅니다: [`app/login.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx#L58), [`app/login.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx#L70). 서버의 `dashboard/profile/bookmark/my/*`는 보호 라우트인데 [`crates/api/src/lib.rs`](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs#L51), 클라이언트에는 401 뒤 `/login`으로 보내는 `AuthGate`가 없습니다. `lib/api.ts` 주석은 “AuthGate redirects”라고 적혀 있지만 실제 구현은 없습니다: [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L38). 이 상태면 비로그인 진입도 탭 접근이 가능하고, 보호 API는 실패 후 화면별로 오프라인/에러처럼 보일 가능성이 큽니다.

3. `lib/api.ts`의 프로그램 목록 필터 파라미터가 서버와 매칭되지 않습니다. 클라이언트는 `program_type`을 보냅니다: [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L321). 서버는 `category`를 받습니다: [`crates/api/src/routes/programs.rs`](/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs#L15). 따라서 모바일에서 프로그램 타입 필터를 붙여 호출하면 백엔드에서 무시됩니다. `region`은 맞습니다.

4. `lib/api.ts`에 서버에 없는 엔드포인트가 더 있습니다. `registerPushToken`/`unregisterPushToken`은 `/api/v1/push/register`를 호출하지만, 서버 라우터에는 해당 경로가 없습니다: [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L453), [`crates/api/src/lib.rs`](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs#L40). 지금 당장 호출되지 않더라도 API 매칭 기준으로는 불일치입니다.

5. `apply-assistant → 상세페이지 → auto-fill`이라는 선형 흐름은 구현되어 있지 않습니다. 실제 라우팅은 상세페이지에서 어시스턴트/자동채우기로 각각 분기합니다: [`app/programs/[id].tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx#L1010). `apply-assistant` 내부에는 상세페이지로 이동하는 CTA가 없고, 첫 단계에서 뒤로 가면 그냥 `router.back()`입니다: [`app/apply-assistant.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx#L1481). 즉 실제 흐름은 `상세 → apply-assistant` 또는 `상세 → auto-fill`이고, 요청하신 3단계 연쇄 흐름은 자연스럽게 이어지지 않습니다.

6. 인증 관련 URL 관리도 일관적이지 않습니다. 인증 스토어는 하드코딩된 `http://localhost:8080`을 사용하고 [`store/auth.ts`](/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts#L23), 나머지 API 클라이언트는 `EXPO_PUBLIC_API_URL`을 우선 사용합니다 [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L14). 실제 기기/에뮬레이터 환경에서는 로그인만 실패하고 나머지 API는 다른 주소를 보는 식의 분리 장애가 날 수 있습니다.

**항목별 판정**

1. 4개 탭 네비게이션 흐름  
탭 자체 구성은 일관적입니다. 4개 탭 등록은 [`app/(tabs)/_layout.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx)에 정상이고, 홈/탐색은 상세로 이동하는 흐름도 자연스럽습니다: [`app/(tabs)/index.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx#L458), [`app/(tabs)/explore.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx#L405). 다만 프로필 탭의 로그인/로그아웃 처리는 인증 게이트가 없어서 전체 앱 흐름 기준으로는 일관성이 깨집니다: [`app/(tabs)/profile.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx#L313).

2. `lib/api.ts`와 `crates/api/src/routes/` 매칭  
부분 불일치입니다.  
맞는 것:
- `/api/v1/auth/kakao`
- `/api/v1/programs`
- `/api/v1/programs/{id}`
- `/api/v1/programs/{id}/bookmark`
- `/api/v1/recommend/preview`
- `/api/v1/dashboard`
- `/api/v1/alerts`
- `/api/v1/alerts/preferences`
- `/api/v1/profile`
- `/api/v1/profile/{user_id}`
- `/api/v1/my/applications`
- `/api/v1/my/applications/{program_id}`

안 맞는 것:
- `/api/v1/auth/me` 없음
- `/api/v1/push/register` 없음
- `getPrograms()`의 `program_type` 쿼리명 불일치

3. `store/auth.ts`와 `_layout.tsx` 인증 흐름  
정상이라고 보기 어렵습니다. 세션 복원 엔드포인트가 없고, 복원 후/미복원 시 화면 분기가 없고, 401 시 로그인 화면으로 강제 이동하는 중앙 게이트도 없습니다.

4. 모든 화면 import  
정적 기준으로는 깨진 import를 찾지 못했습니다. `npx tsc --noEmit`가 `apps/mobile`에서 통과했습니다. 경로 alias도 [`tsconfig.json`](/Users/woominseong/Desktop/창업/apps/mobile/tsconfig.json)에 정상 설정돼 있습니다.

5. `apply-assistant → programs/[id] → auto-fill` 흐름  
현재 UX는 “상세페이지 중심 분기형”입니다.  
- `programs/[id]`에서 `apply-assistant`로 이동 가능
- `programs/[id]`에서 `auto-fill`로 이동 가능
- `apply-assistant`에서 완료 후 홈으로 가는 동선은 있음 [`app/apply-assistant.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx#L1486)
- 하지만 `apply-assistant`에서 `programs/[id]`나 `auto-fill`로 이어주는 명시적 연결은 없음  
그래서 요청하신 3단계 연쇄 흐름은 매끄럽다기보다 “중간 상세페이지를 허브로 둔 별도 분기”에 가깝습니다.

검증 중 확인한 범위에서는 import/타입 오류는 없었고, 실제 위험도는 인증 흐름과 API 계약 불일치에 집중돼 있습니다. 원하시면 다음 턴에서 이 3가지를 바로 고칠 수 있습니다: `auth/me` 정리, 클라이언트 AuthGate 추가, `getPrograms` 쿼리명 수정.


OpenAI Codex v0.115.0 (research preview)
--------
workdir: /Users/woominseong/Desktop/창업
model: gpt-5.4
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: none
reasoning summaries: none
session id: 019d0e18-7e3e-7490-8462-fc372bab1a9c
--------
user
마지미 프로젝트 코드 검증. /Users/woominseong/Desktop/창업 디렉토리의 모바일 앱(apps/mobile)을 검증해줘. 특히: 1) app/(tabs) 4개 탭 화면의 네비게이션 흐름이 일관적인지 2) lib/api.ts의 API 엔드포인트와 crates/api/src/routes/ 의 실제 라우트가 매칭되는지 3) store/auth.ts와 _layout.tsx의 인증 흐름이 정상인지 4) 모든 화면에서 import가 깨진 게 없는지 5) 신청 어시스턴트(apply-assistant.tsx) → 상세페이지(programs/[id].tsx) → 자동채우기(auto-fill.tsx) 흐름이 매끄러운지. 파일들을 읽고 검증해줘. 한국어로 답변.
mcp startup: no servers
codex
`apps/mobile` 중심으로 구조와 관련 파일들을 먼저 읽겠습니다. 탭 네비게이션, 인증 흐름, API 매칭, 주요 화면 import/흐름을 순서대로 대조해서 검증하겠습니다.
Plan update
  → 모바일 앱과 API 라우트 구조 확인
  • 탭 네비게이션 및 인증 흐름 검증
  • API 엔드포인트 매칭과 주요 화면 import/흐름 검증
  • 결과 정리 및 리스크 보고
exec
/bin/zsh -lc "ls -la '/Users/woominseong/Desktop/창업/apps/mobile/app'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "pwd && rg --files '/Users/woominseong/Desktop/창업' | rg '("'^|/)apps/mobile/|(''^|/)crates/api/src/routes/|lib/api'"\\.ts"'$|store/auth'"\\.ts"'$|_layout'"\\.tsx"'$|apply-assistant'"\\.tsx"'$|programs/'"\\[id\\]\\.tsx"'$|auto-fill'"\\.tsx"'$'"'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "find '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)' -maxdepth 2 -type f | sort" in /Users/woominseong/Desktop/창업 succeeded in 375ms:
total 656
drwxr-xr-x   7 woominseong  staff    224 Mar 21 10:52 (tabs)
drwxr-xr-x  15 woominseong  staff    480 Mar 21 10:14 .
drwxr-xr-x  19 woominseong  staff    608 Mar 21 10:19 ..
-rw-r--r--   1 woominseong  staff   2659 Mar 21 10:13 _layout.tsx
-rw-r--r--   1 woominseong  staff  56251 Mar 21 10:14 apply-assistant.tsx
-rw-r--r--   1 woominseong  staff  49949 Mar 21 10:14 auto-fill.tsx
-rw-r--r--   1 woominseong  staff  23346 Mar 21 09:25 calculator.tsx
-rw-r--r--   1 woominseong  staff  48456 Mar 21 09:50 document-vault.tsx
-rw-r--r--   1 woominseong  staff  39127 Mar 21 10:14 generated-form.tsx
-rw-r--r--   1 woominseong  staff   7691 Mar 21 00:43 login.tsx
drwxr-xr-x   5 woominseong  staff    160 Mar 21 01:00 onboarding
-rw-r--r--   1 woominseong  staff  12178 Mar 21 00:52 preview.tsx
drwxr-xr-x   3 woominseong  staff     96 Mar 21 10:13 programs
-rw-r--r--   1 woominseong  staff  29990 Mar 21 01:13 region-compare.tsx
-rw-r--r--   1 woominseong  staff  49710 Mar 21 10:00 stack-calculator.tsx
 succeeded in 389ms:
/Users/woominseong/Desktop/창업
/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts
/Users/woominseong/Desktop/창업/apps/mobile/store/onboarding.ts
/Users/woominseong/Desktop/창업/apps/mobile/store/notifications.ts
/Users/woominseong/Desktop/창업/apps/mobile/assets/adaptive-icon.png
/Users/woominseong/Desktop/창업/apps/mobile/assets/splash.png
/Users/woominseong/Desktop/창업/apps/mobile/assets/favicon.png
/Users/woominseong/Desktop/창업/apps/mobile/assets/icon.png
/Users/woominseong/Desktop/창업/apps/mobile/tsconfig.json
/Users/woominseong/Desktop/창업/apps/mobile/lib/cache.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/pdf-generator.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/crypto.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/notifications.ts
/Users/woominseong/Desktop/창업/apps/mobile/package.json
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json
/Users/woominseong/Desktop/창업/apps/mobile/components/BenefitAmount.tsx
/Users/woominseong/Desktop/창업/apps/mobile/components/DeadlineBadge.tsx
/Users/woominseong/Desktop/창업/apps/mobile/components/RecommendationCard.tsx
/Users/woominseong/Desktop/창업/apps/mobile/eas.json
 succeeded in 356ms:
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/manage.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx
codex
구조는 확인했습니다. 이제 실제 흐름을 보려면 `_layout`, `store/auth`, 4개 탭, `lib/api.ts`, 백엔드 라우트, 그리고 `apply-assistant → programs/[id] → auto-fill` 세 화면의 코드와 import를 직접 대조하겠습니다.
exec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "for f in '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/manage.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx'; do echo \"FILE:"'$f"; sed -n '"'1,260p' \""'$f"; done' in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx'" in /Users/woominseong/Desktop/창업 succeeded in 423ms:
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

/** Restores auth session on app start. No navigation — just reads SecureStore. */
function SessionRestore() {
  const { restoreSession } = useAuthStore();
  const restored = useRef(false);

 succeeded in 413ms:
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const SECURE_STORE_TOKEN_KEY = "majimi_auth_token";

export interface AuthUser {
  id: string;
  nickname: string;
  image: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;

  login: (kakaoAccessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  _setToken: (token: string | null) => void;
 succeeded in 414ms:
import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { colors, layout, typography } from "../../constants/theme";

// ---------------------------------------------------------------------------
// Geometric icon shapes — no external icon package required.
// Each icon is a small View-based shape that communicates the tab's function.
// ---------------------------------------------------------------------------

type IconProps = { focused: boolean };

/** 홈 (Home): classic house silhouette — triangle roof + rect body */
function IconHome({ focused }: IconProps) {
  const color = focused ? colors.tabBarActive : colors.tabBarInactive;
  return (
    <View
      style={{
        width: 20,
        height: 20,
        alignItems: "center",
 succeeded in 419ms:
FILE:/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx
/**
 * 홈 탭 — 개인화 대시보드
 *
 * Data sources:
 *   - api.getDashboard(USER_ID)  → summary counts + upcoming deadlines
 *   - api.getRecommendPreview()  → recommendation cards
 *
 * On API failure the screen falls back to static mock data and shows an
 * "오프라인 모드" banner so the user always sees something useful.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
codex
지금 단계에서 핵심은 실제 라우팅 호출과 import 해석입니다. 다음으로 각 화면의 `router.push/replace`, `href`, API 메서드 정의, 백엔드 `Router` 등록, 그리고 TypeScript 검사를 같이 보겠습니다.
exec
/bin/zsh -lc "sed -n '220,420p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,320p' '/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc 'for f in /Users/woominseong/Desktop/창업/crates/api/src/routes/*.rs; do echo "FILE:$f"; sed -n '"'1,240p' \""'$f"; done' in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "cd '/Users/woominseong/Desktop/창업/apps/mobile' && npx tsc --noEmit" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"router\\.(push|replace|back)|Link|href|navigate\" '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)' '/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding'" in /Users/woominseong/Desktop/창업 succeeded in 472ms:
}: {
  icon: React.ReactNode;
  focused: boolean;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20, // px-5 = 20px
        paddingVertical: 8,    // py-2 = 8px
        borderRadius: layout.tabBarTopRadius * 2, // rounded-full
        backgroundColor: focused ? colors.tabBarActiveBackground : "transparent",
        minWidth: 40,
        minHeight: layout.touchTargetMin,
      }}
    >
      {icon}
    </View>
  );
 succeeded in 477ms:
// ---------------------------------------------------------------------------
// API client — connects to the Rust/Axum backend at API_BASE_URL.
//
// Auth token flow:
//   Call api.setToken(token) after login. All subsequent requests will
//   include `Authorization: Bearer <token>`. Call api.clearToken() on logout.
//
// TODO: replace USER_ID fallback with real auth session once Kakao login lands.
// ---------------------------------------------------------------------------

import { useAuthStore } from "../store/auth";
import { cachedFetch, TTL } from "./cache";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

/** Read the current JWT synchronously from the Zustand auth store. */
function getToken(): string | null {
  return useAuthStore.getState().token;
}
 succeeded in 489ms:
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1015:            onPress={() => router.back()}
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1179:                router.push(`/generated-form?programId=${programId}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1240:            if (programId) router.push(`/generated-form?programId=${programId}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:23:  Linking,
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:982:  if (error || !program) return <ErrorScreen onBack={() => router.back()} />;
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1007:    if (program?.official_url) Linking.openURL(program.official_url);
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1011:    router.push(`/apply-assistant?programId=${program!.id}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1015:    router.push(`/auto-fill?programId=${program!.id}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1024:            onPress={() => router.back()}
/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx:62:      router.replace("/(tabs)");
/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx:71:    router.replace("/(tabs)");
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:14: * Navigation: router.push('/apply-assistant?programId=xxx')
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:587:                  <Text style={stepStyles.docIssueLink}>지금 발급하기</Text>
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:1304:  docIssueLink: {
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:1483:    else router.back();
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:1488:    router.replace("/(tabs)" as any);
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:51:    router.replace("/onboarding");
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:59:    router.push("/calculator");
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:63:    router.back();
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx:407:      router.push(`/programs/${id}`);
 succeeded in 496ms:
FILE:/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::Program;

/// POST /api/v1/admin/sync
pub async fn trigger_sync(
    State(pool): State<PgPool>,
) -> Json<Value> {
    tokio::spawn(async move {
        tracing::info!("manual sync triggered via admin API");

        match majimi_worker::sources::youth_center::YouthCenterSource::from_env() {
 succeeded in 1.84s:

codex
타입체크는 아직 돌고 있습니다. 동시에 실제 문제 가능성이 높은 지점인 `auth/me`, 탭 간 라우팅 문자열, 그리고 `programs/[id]` 기준 진입/복귀 흐름을 더 좁혀서 확인하겠습니다.
exec
/bin/zsh -lc "sed -n '320,520p' '/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "rg -n \"from ['\\\"](@/|\\.\\.?/)\" '/Users/woominseong/Desktop/창업/apps/mobile/app' '/Users/woominseong/Desktop/창업/apps/mobile/components' '/Users/woominseong/Desktop/창업/apps/mobile/lib' '/Users/woominseong/Desktop/창업/apps/mobile/store' | sed -n '1,260p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/mod.rs'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx' && printf '\\n@@SEP@@\\n' && sed -n '260,420p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '940,1080p' '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx' && printf '\\n@@SEP@@\\n' && sed -n '1450,1515p' '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx' && printf '\\n@@SEP@@\\n' && sed -n '1000,1260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx'" in /Users/woominseong/Desktop/창업 succeeded in 545ms:

  getPrograms: (params?: {
    program_type?: string;
    region?: string;
  }): Promise<ProgramListResponse> => {
    const query = new URLSearchParams();
    if (params?.program_type) query.set("program_type", params.program_type);
    if (params?.region) query.set("region", params.region);
    const qs = query.toString();
    const cacheKey = `programs:list${qs ? `:${qs}` : ""}`;
    return cachedFetch(
      cacheKey,
      () => request<ProgramListResponse>(`/api/v1/programs${qs ? `?${qs}` : ""}`),
      TTL.PROGRAMS
    );
  },

  getProgram: (id: string): Promise<ApiProgram> =>
    request<ApiProgram>(`/api/v1/programs/${id}`),

 succeeded in 530ms:
pub mod admin;
pub mod alerts;
pub mod auth;
pub mod bookmark;
pub mod dashboard;
pub mod health;
pub mod my;
pub mod profile;
pub mod programs;
pub mod recommend;
pub mod state;
 succeeded in 531ms:
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuthRequest, makeRedirectUri } from "expo-auth-session";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/auth";
import { colors, typography, borderRadius, layout, shadows } from "../constants/theme";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? "";
 succeeded in 533ms:
/Users/woominseong/Desktop/창업/apps/mobile/components/RecommendationCard.tsx:22:import type { RecommendationItem } from "@/lib/api";
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:20:import { useOnboardingStore } from "@/store/onboarding";
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:21:import { colors, typography, borderRadius, layout } from "@/constants/theme";
/Users/woominseong/Desktop/창업/apps/mobile/store/notifications.ts:16:} from "../lib/notifications";
/Users/woominseong/Desktop/창업/apps/mobile/store/notifications.ts:17:import { useAuthStore } from "./auth";
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/index.tsx:20:import { useOnboardingStore } from "@/store/onboarding";
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/index.tsx:21:import { colors, typography, spacing, borderRadius, shadows, layout } from "@/constants/theme";
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:41:import { api, USER_ID, type ApiProgram, type ApplicationStatus } from "@/lib/api";
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:42:import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:51:} from "@/constants/theme";
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:11:import { useAuthStore } from "../store/auth";
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:12:import { cachedFetch, TTL } from "./cache";
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step2.tsx:22:import { useOnboardingStore } from "@/store/onboarding";
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step2.tsx:23:import { colors, typography, borderRadius, layout } from "@/constants/theme";
/Users/woominseong/Desktop/창업/apps/mobile/lib/notifications.ts:16:import { api } from "./api";
/Users/woominseong/Desktop/창업/apps/mobile/lib/notifications.ts:17:import { useAuthStore } from "../store/auth";
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:31:import { api, USER_ID, formatBenefit, programStatusLabel, type ApiProgram } from "@/lib/api";
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:32:import { useOnboardingStore, getBirthYear } from "@/store/onboarding";
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:41:} from "@/constants/theme";
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:49:} from "@/lib/pdf-generator";
 succeeded in 531ms:
    queryFn: () => api.getProgram(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  // Fetch current application status (null = not tracked yet)
  const { data: applicationDetail } = useQuery({
    queryKey: ["applicationStatus", id, USER_ID],
    queryFn: () => api.getApplicationStatus(USER_ID, id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const currentStatus: ApplicationStatus | null =
    applicationDetail?.current_status ?? null;

codex
타입스크립트 기준으로는 현재 `apps/mobile` import/타입 해석이 통과합니다. 이제 실제 검증 포인트는 런타임 흐름과 API 계약 불일치라서, 서버 라우터 등록부와 `programs/profile/my` 라우트를 직접 대조해 결론을 내리겠습니다.
exec
/bin/zsh -lc "rg -n \"route\\(|Router::new|nest\\(|merge\\(|/api/v1|auth/me|push/register\" '/Users/woominseong/Desktop/창업/crates/api/src'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/profile.rs' && printf '\\n@@SEP@@\\n' && sed -n '1,280p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs' && printf '\\n@@SEP@@\\n' && sed -n '1,280p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/apps/mobile/tsconfig.json'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '360,520p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx' && printf '\\n@@SEP@@\\n' && sed -n '380,460p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx' && printf '\\n@@SEP@@\\n' && sed -n '640,720p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/manage.tsx'" in /Users/woominseong/Desktop/창업 succeeded in 353ms:
/Users/woominseong/Desktop/창업/crates/api/src/routes/recommend.rs:13:/// POST /api/v1/recommend/preview
/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs:81:// ── GET /api/v1/programs ─────────────────────────────────────────────────────
/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs:245:// ── GET /api/v1/programs/{id} ────────────────────────────────────────────────
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs:12:/// POST /api/v1/admin/sync
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs:97:/// GET /api/v1/admin/programs
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs:137:/// POST /api/v1/admin/programs
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs:212:/// PUT /api/v1/admin/programs/{id}
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs:319:/// POST /api/v1/admin/programs/{id}/publish
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs:365:/// GET /api/v1/admin/stats
/Users/woominseong/Desktop/창업/crates/api/src/routes/bookmark.rs:16:/// POST /api/v1/programs/{program_id}/bookmark
/Users/woominseong/Desktop/창업/crates/api/src/routes/dashboard.rs:17:/// GET /api/v1/dashboard?user_id=UUID
/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs:37:/// Body for PUT /api/v1/my/applications/{program_id}
/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs:142:/// POST /api/v1/programs/{program_id}/state
/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs:185:/// GET /api/v1/my/applications?user_id=UUID
/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs:246:/// GET /api/v1/my/applications/{program_id}?user_id=UUID
/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs:310:/// PUT /api/v1/my/applications/{program_id}?user_id=UUID
/Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs:94:/// GET /api/v1/alerts?user_id=UUID&limit=20&offset=0
/Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs:155:/// POST /api/v1/alerts/preferences
/Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs:238:/// GET /api/v1/alerts/notification-preferences?user_id=UUID
/Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs:300:/// PUT /api/v1/alerts/notification-preferences
 succeeded in 373ms:
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./*"
      ]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
 succeeded in 376ms:
          <View key={tag} style={styles.recommendTag}>
            <Text style={styles.recommendTagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function DocumentItemRow({ item }: { item: DocumentItem }) {
  const isMissing = item.status === "missing";
  return (
    <View style={[styles.docItem, !isMissing && styles.docItemDone]}>
      <View
        style={[
          styles.docIconBox,
          { backgroundColor: isMissing ? "#ffebee" : colors.surfaceContainer },
        ]}
      >
        {isMissing ? (
 succeeded in 376ms:
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::{ProfileInput, UserProfile};

/// POST /api/v1/profile
/// Accepts an optional `user_id` field; creates a new user when absent.
pub async fn save_profile(
    State(pool): State<PgPool>,
    Json(payload): Json<SaveProfileRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = match payload.user_id {
        Some(id) => id,
        None => {
            // Create a new anonymous user
codex
핵심 리스크가 보입니다. 인증 게이트 부재와 API 계약 불일치가 실제 사용자 흐름을 깨뜨릴 수 있어서, 관련 줄 번호를 정확히 찍기 위해 마지막으로 근거 라인만 정리해서 읽겠습니다.
exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts' | sed -n '1,220p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts' | sed -n '320,520p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx' | sed -n '1000,1020p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx' | sed -n '1478,1495p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx' | sed -n '1170,1245p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx' | sed -n '1,220p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx' | sed -n '45,85p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/crates/api/src/lib.rs' | sed -n '35,115p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs' | sed -n '1,140p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/crates/api/src/routes/auth.rs' | sed -n '1,120p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx' | sed -n '452,470p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx' | sed -n '402,412p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx' | sed -n '310,320p'" in /Users/woominseong/Desktop/창업 succeeded in 568ms:
     1	import { create } from "zustand";
     2	import * as SecureStore from "expo-secure-store";
     3	
     4	const SECURE_STORE_TOKEN_KEY = "majimi_auth_token";
     5	
     6	export interface AuthUser {
     7	  id: string;
     8	  nickname: string;
     9	  image: string | null;
    10	}
    11	
    12	interface AuthState {
    13	  token: string | null;
    14	  user: AuthUser | null;
    15	  isLoading: boolean;
    16	
    17	  login: (kakaoAccessToken: string) => Promise<void>;
    18	  logout: () => Promise<void>;
    19	  restoreSession: () => Promise<void>;
    20	  _setToken: (token: string | null) => void;
 succeeded in 571ms:
   320	
   321	  getPrograms: (params?: {
   322	    program_type?: string;
   323	    region?: string;
   324	  }): Promise<ProgramListResponse> => {
   325	    const query = new URLSearchParams();
   326	    if (params?.program_type) query.set("program_type", params.program_type);
   327	    if (params?.region) query.set("region", params.region);
   328	    const qs = query.toString();
   329	    const cacheKey = `programs:list${qs ? `:${qs}` : ""}`;
   330	    return cachedFetch(
   331	      cacheKey,
   332	      () => request<ProgramListResponse>(`/api/v1/programs${qs ? `?${qs}` : ""}`),
   333	      TTL.PROGRAMS
   334	    );
   335	  },
   336	
   337	  getProgram: (id: string): Promise<ApiProgram> =>
   338	    request<ApiProgram>(`/api/v1/programs/${id}`),
   339	
 succeeded in 571ms:
    35	
    36	pub fn build_app(pool: PgPool, jwt_secret: String) -> Router {
    37	    let state = AppState { pool, jwt_secret };
    38	
    39	    // ── Public routes (no auth required) ──
    40	    let public = Router::new()
    41	        .route("/health", get(routes::health::health))
    42	        .route("/api/v1/health", get(routes::health::health_detail))
    43	        // Auth
    44	        .route("/api/v1/auth/kakao", post(routes::auth::kakao_login))
    45	        // Programs (read-only, public)
    46	        .route("/api/v1/programs", get(routes::programs::list_programs))
    47	        .route("/api/v1/programs/{id}", get(routes::programs::get_program))
    48	        // Recommend preview (no account needed)
    49	        .route("/api/v1/recommend/preview", post(routes::recommend::preview));
    50	
    51	    // ── Protected routes (require valid JWT) ──
    52	    let protected = Router::new()
    53	        // Profile
    54	        .route("/api/v1/profile", post(routes::profile::save_profile))
 succeeded in 572ms:
  1000	      setBookmarked((v) => !v);
  1001	    } finally {
  1002	      setBookmarkLoading(false);
  1003	    }
  1004	  }
  1005	
  1006	  function handleViewDetail() {
  1007	    if (program?.official_url) Linking.openURL(program.official_url);
  1008	  }
  1009	
  1010	  function handleApply() {
  1011	    router.push(`/apply-assistant?programId=${program!.id}`);
  1012	  }
  1013	
  1014	  function handleAutoFill() {
  1015	    router.push(`/auto-fill?programId=${program!.id}`);
  1016	  }
  1017	
  1018	  return (
  1019	    <View style={styles.root}>
 succeeded in 574ms:
     1	import { Stack } from "expo-router";
     2	import { StatusBar } from "expo-status-bar";
     3	import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
     4	import { useEffect, useRef } from "react";
     5	import { useAuthStore } from "../store/auth";
     6	
     7	const queryClient = new QueryClient({
     8	  defaultOptions: {
     9	    queries: {
    10	      staleTime: 1000 * 60 * 5,
    11	      retry: 2,
    12	    },
    13	  },
    14	});
    15	
    16	/** Restores auth session on app start. No navigation — just reads SecureStore. */
    17	function SessionRestore() {
    18	  const { restoreSession } = useAuthStore();
    19	  const restored = useRef(false);
    20	
 succeeded in 576ms:
   452	
   453	  const documentItems: DocumentItem[] =
   454	    dashboardQuery.data
   455	      ? buildDocumentItems(dashboardQuery.data)
   456	      : MOCK_DOCUMENT_ITEMS;
   457	
   458	  const handleAllRecommendations = useCallback(() => {
   459	    router.push("/(tabs)/explore");
   460	  }, [router]);
   461	
   462	  const handleFindMoreBenefits = useCallback(() => {
   463	    router.push("/onboarding");
   464	  }, [router]);
   465	
   466	  const handleFAB = useCallback(() => {
   467	    router.push("/onboarding");
   468	  }, [router]);
   469	
   470	  return (

codex
남은 포인트는 세 화면 사이의 연결이 실제로는 어떻게 시작되는지입니다. `programId` 파라미터 해석과 누락 시 처리만 보고 마무리하겠습니다.
exec
/bin/zsh -lc "rg -n \"useLocalSearchParams|programId|router\\.back\\(|router\\.push\\(|router\\.replace\\(\" '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx' '/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx' | sed -n '1,260p'" in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx' | sed -n '1410,1478p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx' | sed -n '880,980p' && printf '\\n@@SEP@@\\n' && nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx' | sed -n '920,1005p'" in /Users/woominseong/Desktop/창업 succeeded in 353ms:
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:28:import { useLocalSearchParams, useRouter } from "expo-router";
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:921:  const { id } = useLocalSearchParams<{ id: string }>();
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:982:  if (error || !program) return <ErrorScreen onBack={() => router.back()} />;
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1011:    router.push(`/apply-assistant?programId=${program!.id}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1015:    router.push(`/auto-fill?programId=${program!.id}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx:1024:            onPress={() => router.back()}
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:2: * Auto-Fill Screen — /auto-fill?programId=xxx
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:37:import { useLocalSearchParams, useRouter } from "expo-router";
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:881:  const { programId } = useLocalSearchParams<{ programId: string }>();
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:900:    queryKey: ["program", programId],
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:901:    queryFn: () => api.getProgram(programId!),
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:902:    enabled: !!programId,
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1015:            onPress={() => router.back()}
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1178:              if (programId) {
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1179:                router.push(`/generated-form?programId=${programId}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx:1240:            if (programId) router.push(`/generated-form?programId=${programId}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:2: * Apply Assistant Screen — /apply-assistant?programId=xxx
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:14: * Navigation: router.push('/apply-assistant?programId=xxx')
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:37:import { useLocalSearchParams, useRouter } from "expo-router";
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx:1404:  const { programId } = useLocalSearchParams<{ programId: string }>();
 succeeded in 326ms:
  1410	  const [step, setStep] = useState(1);
  1411	  const [docChecked, setDocChecked] = useState<Record<string, boolean>>(
  1412	    () => Object.fromEntries(DEFAULT_DOCS.map((d) => [d.id, false]))
  1413	  );
  1414	
  1415	  // Onboarding store + server profile
  1416	  const localStore = useOnboardingStore();
  1417	
  1418	  const { data: profileResponse } = useQuery({
  1419	    queryKey: ["profile", USER_ID],
  1420	    queryFn: () => api.getProfile(USER_ID),
  1421	    staleTime: 5 * 60 * 1000,
  1422	    gcTime: 30 * 60 * 1000,
  1423	    retry: 1,
  1424	  });
  1425	
  1426	  const [editableProfile, setEditableProfile] = useState<MergedProfile | null>(null);
  1427	
  1428	  // Build the merged profile once server data arrives
  1429	  const serverProfile = profileResponse?.profile ?? null;
Plan update
  ✓ 모바일 앱과 API 라우트 구조 확인
  ✓ 탭 네비게이션 및 인증 흐름 검증
  ✓ API 엔드포인트 매칭과 주요 화면 import/흐름 검증
  → 결과 정리 및 리스크 보고
codex
**검증 결과**

주요 문제부터 적습니다.

1. 인증 복원 흐름이 현재는 정상 동작하지 않습니다. [`store/auth.ts`](/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts#L58)에서 세션 복원 시 `GET /api/v1/auth/me`를 호출하는데, 서버 라우터에는 이 엔드포인트가 등록되어 있지 않습니다. 실제 등록된 auth 라우트는 [`crates/api/src/lib.rs`](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs#L40)와 [`crates/api/src/routes/auth.rs`](/Users/woominseong/Desktop/창업/crates/api/src/routes/auth.rs#L36)에 있는 `POST /api/v1/auth/kakao`뿐입니다. 결과적으로 앱 재시작 후 저장된 토큰이 있어도 세션이 복원되지 않고 로그아웃 상태로 떨어집니다.

2. 인증 게이트가 없습니다. 루트 레이아웃은 세션 복원만 하고 어떤 화면으로 보낼지 결정하지 않습니다. [`app/_layout.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx#L16)에는 `restoreSession()`만 있고, 토큰 유무에 따라 `/login` 또는 `/(tabs)`로 리다이렉트하는 로직이 없습니다. 반대로 로그인 성공과 “둘러보기” 둘 다 바로 `/(tabs)`로 보냅니다: [`app/login.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx#L58), [`app/login.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx#L70). 서버의 `dashboard/profile/bookmark/my/*`는 보호 라우트인데 [`crates/api/src/lib.rs`](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs#L51), 클라이언트에는 401 뒤 `/login`으로 보내는 `AuthGate`가 없습니다. `lib/api.ts` 주석은 “AuthGate redirects”라고 적혀 있지만 실제 구현은 없습니다: [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L38). 이 상태면 비로그인 진입도 탭 접근이 가능하고, 보호 API는 실패 후 화면별로 오프라인/에러처럼 보일 가능성이 큽니다.

3. `lib/api.ts`의 프로그램 목록 필터 파라미터가 서버와 매칭되지 않습니다. 클라이언트는 `program_type`을 보냅니다: [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L321). 서버는 `category`를 받습니다: [`crates/api/src/routes/programs.rs`](/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs#L15). 따라서 모바일에서 프로그램 타입 필터를 붙여 호출하면 백엔드에서 무시됩니다. `region`은 맞습니다.

4. `lib/api.ts`에 서버에 없는 엔드포인트가 더 있습니다. `registerPushToken`/`unregisterPushToken`은 `/api/v1/push/register`를 호출하지만, 서버 라우터에는 해당 경로가 없습니다: [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L453), [`crates/api/src/lib.rs`](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs#L40). 지금 당장 호출되지 않더라도 API 매칭 기준으로는 불일치입니다.

5. `apply-assistant → 상세페이지 → auto-fill`이라는 선형 흐름은 구현되어 있지 않습니다. 실제 라우팅은 상세페이지에서 어시스턴트/자동채우기로 각각 분기합니다: [`app/programs/[id].tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx#L1010). `apply-assistant` 내부에는 상세페이지로 이동하는 CTA가 없고, 첫 단계에서 뒤로 가면 그냥 `router.back()`입니다: [`app/apply-assistant.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx#L1481). 즉 실제 흐름은 `상세 → apply-assistant` 또는 `상세 → auto-fill`이고, 요청하신 3단계 연쇄 흐름은 자연스럽게 이어지지 않습니다.

6. 인증 관련 URL 관리도 일관적이지 않습니다. 인증 스토어는 하드코딩된 `http://localhost:8080`을 사용하고 [`store/auth.ts`](/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts#L23), 나머지 API 클라이언트는 `EXPO_PUBLIC_API_URL`을 우선 사용합니다 [`lib/api.ts`](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts#L14). 실제 기기/에뮬레이터 환경에서는 로그인만 실패하고 나머지 API는 다른 주소를 보는 식의 분리 장애가 날 수 있습니다.

**항목별 판정**

1. 4개 탭 네비게이션 흐름  
탭 자체 구성은 일관적입니다. 4개 탭 등록은 [`app/(tabs)/_layout.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx)에 정상이고, 홈/탐색은 상세로 이동하는 흐름도 자연스럽습니다: [`app/(tabs)/index.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx#L458), [`app/(tabs)/explore.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx#L405). 다만 프로필 탭의 로그인/로그아웃 처리는 인증 게이트가 없어서 전체 앱 흐름 기준으로는 일관성이 깨집니다: [`app/(tabs)/profile.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx#L313).

2. `lib/api.ts`와 `crates/api/src/routes/` 매칭  
부분 불일치입니다.  
맞는 것:
- `/api/v1/auth/kakao`
- `/api/v1/programs`
- `/api/v1/programs/{id}`
- `/api/v1/programs/{id}/bookmark`
- `/api/v1/recommend/preview`
- `/api/v1/dashboard`
- `/api/v1/alerts`
- `/api/v1/alerts/preferences`
- `/api/v1/profile`
- `/api/v1/profile/{user_id}`
- `/api/v1/my/applications`
- `/api/v1/my/applications/{program_id}`

안 맞는 것:
- `/api/v1/auth/me` 없음
- `/api/v1/push/register` 없음
- `getPrograms()`의 `program_type` 쿼리명 불일치

3. `store/auth.ts`와 `_layout.tsx` 인증 흐름  
정상이라고 보기 어렵습니다. 세션 복원 엔드포인트가 없고, 복원 후/미복원 시 화면 분기가 없고, 401 시 로그인 화면으로 강제 이동하는 중앙 게이트도 없습니다.

4. 모든 화면 import  
정적 기준으로는 깨진 import를 찾지 못했습니다. `npx tsc --noEmit`가 `apps/mobile`에서 통과했습니다. 경로 alias도 [`tsconfig.json`](/Users/woominseong/Desktop/창업/apps/mobile/tsconfig.json)에 정상 설정돼 있습니다.

5. `apply-assistant → programs/[id] → auto-fill` 흐름  
현재 UX는 “상세페이지 중심 분기형”입니다.  
- `programs/[id]`에서 `apply-assistant`로 이동 가능
- `programs/[id]`에서 `auto-fill`로 이동 가능
- `apply-assistant`에서 완료 후 홈으로 가는 동선은 있음 [`app/apply-assistant.tsx`](/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx#L1486)
- 하지만 `apply-assistant`에서 `programs/[id]`나 `auto-fill`로 이어주는 명시적 연결은 없음  
그래서 요청하신 3단계 연쇄 흐름은 매끄럽다기보다 “중간 상세페이지를 허브로 둔 별도 분기”에 가깝습니다.

검증 중 확인한 범위에서는 import/타입 오류는 없었고, 실제 위험도는 인증 흐름과 API 계약 불일치에 집중돼 있습니다. 원하시면 다음 턴에서 이 3가지를 바로 고칠 수 있습니다: `auth/me` 정리, 클라이언트 AuthGate 추가, `getPrograms` 쿼리명 수정.
tokens used
70,771

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
