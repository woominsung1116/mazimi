# codex advisor artifact

- Provider: codex
- Exit code: 0
- Created at: 2026-03-22T12:05:03.737Z

## Original task

마지미 프로젝트 최종 검토. 디렉토리: /Users/woominseong/Desktop/창업. 전체 파일을 읽고 빠진 것, 연결 안 된 것, 보완할 것을 찾아줘. 특히: 1) 모바일 앱 21개 화면의 네비게이션 흐름에 빠진 연결이 있는지 2) 백엔드 라우터에 등록 안 된 핸들러가 있는지 3) DB 마이그레이션 순서 충돌 4) Worker가 실제로 7개 소스를 모두 호출하는지 5) 관리자 대시보드와 백엔드 API가 매칭되는지 6) 배포 스크립트가 정상인지 7) 보안 수정이 제대로 적용됐는지 (IDOR, CORS, RLS). 한국어로 답변.

## Final prompt

마지미 프로젝트 최종 검토. 디렉토리: /Users/woominseong/Desktop/창업. 전체 파일을 읽고 빠진 것, 연결 안 된 것, 보완할 것을 찾아줘. 특히: 1) 모바일 앱 21개 화면의 네비게이션 흐름에 빠진 연결이 있는지 2) 백엔드 라우터에 등록 안 된 핸들러가 있는지 3) DB 마이그레이션 순서 충돌 4) Worker가 실제로 7개 소스를 모두 호출하는지 5) 관리자 대시보드와 백엔드 API가 매칭되는지 6) 배포 스크립트가 정상인지 7) 보안 수정이 제대로 적용됐는지 (IDOR, CORS, RLS). 한국어로 답변.

## Raw output

```text
**핵심 발견사항**

1. 관리자 웹과 백엔드 API 계약이 여러 곳에서 깨져 있어서, 대시보드/내 정보/신청 상태 화면은 실서버에 붙이면 정상 동작하지 않을 가능성이 높습니다. 웹은 응답을 `{ programs }`, `{ saved }`, `{ applications }` 같은 형태로 기대하지만, 백엔드는 대부분 `{ items, total, ... }`를 반환합니다. `PATCH`로 보내는 신청 상태 수정도 백엔드는 `PUT`만 받습니다. 인증 헤더도 웹 API 클라이언트에서 전혀 붙이지 않아 admin 라우트는 기본적으로 401/403입니다. 관련 파일: [apps/web/src/lib/api.ts](/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts), [crates/api/src/lib.rs](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs), [crates/api/src/routes/dashboard.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/dashboard.rs), [crates/api/src/routes/my.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs), [crates/api/src/routes/state.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs)

2. Worker는 문서상 “7개 소스”가 아니라 현재 코드상 6개 소스만 실제 호출합니다. 스케줄 루프와 `sources/mod.rs` 기준으로 `YouthCenter`, `GovBenefits`, `Worknet`, `Scholarship`, `LocalScraper`, `FssFinancial`만 실행됩니다. 7번째 소스가 빠졌거나 문서가 과장된 상태입니다. 관련 파일: [crates/worker/src/main.rs](/Users/woominseong/Desktop/창업/crates/worker/src/main.rs), [crates/worker/src/sources/mod.rs](/Users/woominseong/Desktop/창업/crates/worker/src/sources/mod.rs)

3. RLS는 SQL 정책은 들어가 있지만, 애플리케이션이 요청별 사용자 ID를 DB 세션에 주입하지 않아 실효성이 약합니다. 현재 정책은 service role에는 광범위 허용이고, 코드에서는 `app.current_user_id`를 세팅하는 흐름을 찾지 못했습니다. 즉 “RLS 추가” 자체는 되었지만, 런타임에서 per-request 강제가 연결되지 않았습니다. 관련 파일: [infra/migrations/20260322000001_rls_policies.sql](/Users/woominseong/Desktop/창업/infra/migrations/20260322000001_rls_policies.sql)

4. 배포/CI 경로가 실제 저장소 상태와 어긋납니다. 웹 앱은 `package-lock.json`만 있는데 Dockerfile과 GitHub Actions는 `pnpm-lock.yaml`을 전제로 작성돼 있습니다. 로컬 `npm run build`는 성공했지만, 컨테이너 빌드와 CI 캐시/설정은 깨질 수 있습니다. 관련 파일: [apps/web/package-lock.json](/Users/woominseong/Desktop/창업/apps/web/package-lock.json), [infra/docker/Dockerfile.web](/Users/woominseong/Desktop/창업/infra/docker/Dockerfile.web), [.github/workflows/ci.yml](/Users/woominseong/Desktop/창업/.github/workflows/ci.yml)

5. DB 마이그레이션 순서는 대체로 정상인데, 초기 확장에서 `uuid-ossp`만 켜고 실제 코드에서는 `gen_random_uuid()`를 사용합니다. `pgcrypto`가 따로 보장되지 않으면 관리자에서 프로그램 생성 시 런타임 실패 가능성이 있습니다. 관련 파일: [infra/migrations/20260320000001_init.sql](/Users/woominseong/Desktop/창업/infra/migrations/20260320000001_init.sql), [crates/api/src/routes/admin.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs)

6. 모바일 내비게이션에는 실제로 연결이 빠진 화면이 있습니다. `preview`는 스택에는 등록돼 있지만 들어가는 링크를 찾지 못했습니다. `apply-assistant`의 “지금 발급하기”, 프로필의 “프로필 편집”은 UI만 있고 `onPress` 연결이 없습니다. 관련 파일: [apps/mobile/app/_layout.tsx](/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx), [apps/mobile/app/apply-assistant.tsx](/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx), [apps/mobile/app/(tabs)/profile.tsx](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx)

7. “21개 화면” 기준과 실제 라우트 파일 수가 맞지 않습니다. `_layout` 제외 기준으로 확인된 화면은 19개였습니다. 요구사항 문서와 구현 수가 어긋난 상태라면, 검토 기준부터 다시 맞춰야 합니다. 관련 경로: [apps/mobile/app](/Users/woominseong/Desktop/창업/apps/mobile/app)

8. 백엔드에는 등록되지 않은 핸들러가 있습니다. `routes/my.rs`의 `get_applications`는 구현돼 있지만 라우터에서는 사용되지 않고, 실제 `/my/applications`는 `routes::state::list_applications`에 연결돼 있습니다. `payment.rs`는 모듈만 있고 실핸들러/라우팅이 없습니다. 관련 파일: [crates/api/src/routes/my.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs), [crates/api/src/lib.rs](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs), [crates/api/src/routes/payment.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/payment.rs)

9. 모바일/웹 클라이언트는 보안 수정 이후 백엔드 계약을 따라가지 못하고 있습니다. 많은 요청이 여전히 `user_id`를 보내는데, 서버는 JWT 기반 사용자만 신뢰합니다. 특히 푸시 토큰 등록은 모바일이 `{ user_id, token }`를 보내지만 서버는 `{ token, platform }`를 기대합니다. IDOR 자체는 서버 쪽에서 상당 부분 막혔지만, 클라이언트는 낡은 계약 위에 있습니다. 관련 파일: [apps/mobile/lib/api.ts](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts), [apps/web/src/lib/api.ts](/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts), [crates/api/src/routes/push.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/push.rs)

10. CORS는 최소 허용만 들어가 있어 웹 운영엔 괜찮을 수 있지만, 모바일 개발 환경/Expo 계열 origin까지 고려한 설정으로 보이진 않습니다. 프로덕션 도메인과 로컬호스트 외 사용 시 확인이 필요합니다. 관련 파일: [crates/api/src/lib.rs](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs)

**검증 결과**

- `cargo check --workspace`: 성공
- `npm run build` (`apps/web`): 성공
- `cargo test --workspace`: 실패. 테스트 픽스처가 `Program` 구조체 변경을 따라가지 못했습니다. 관련 파일: [crates/core/src/rule_engine.rs](/Users/woominseong/Desktop/창업/crates/core/src/rule_engine.rs)

**요청하신 7개 항목별 결론**

1. 모바일 21개 화면 네비게이션: 빠진 연결 있음. 특히 `preview`, 발급 CTA, 프로필 편집 CTA.
2. 백엔드 라우터 미등록 핸들러: 있음. `my::get_applications`, 사실상 비어 있는 `payment`.
3. DB 마이그레이션 순서 충돌: 큰 순서 충돌은 안 보였지만 `gen_random_uuid()`/extension 불일치 위험 존재.
4. Worker 7개 소스 호출: 아니고 현재 6개만 확인됨.
5. 관리자 대시보드와 백엔드 API 매칭: 다수 불일치.
6. 배포 스크립트/설정: 웹 패키지 매니저 설정 불일치로 정상 보장 어려움.
7. 보안 수정(IDOR, CORS, RLS): IDOR은 서버 쪽 상당 부분 반영, CORS는 범위 제한적, RLS는 정책만 있고 런타임 연결이 부족.

원하시면 다음 단계로 바로 이어서 할 수 있습니다:  
1. 이 이슈들을 `치명적/높음/중간` 우선순위로 재정렬한 수정 체크리스트 작성  
2. 실제 수정 패치 적용  
3. 수정 후 재검증까지 진행


OpenAI Codex v0.115.0 (research preview)
--------
workdir: /Users/woominseong/Desktop/창업/apps/mobile
model: gpt-5.4
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: none
reasoning summaries: none
session id: 019d1569-7cc3-7a72-bfe0-e595b80be76c
--------
user
마지미 프로젝트 최종 검토. 디렉토리: /Users/woominseong/Desktop/창업. 전체 파일을 읽고 빠진 것, 연결 안 된 것, 보완할 것을 찾아줘. 특히: 1) 모바일 앱 21개 화면의 네비게이션 흐름에 빠진 연결이 있는지 2) 백엔드 라우터에 등록 안 된 핸들러가 있는지 3) DB 마이그레이션 순서 충돌 4) Worker가 실제로 7개 소스를 모두 호출하는지 5) 관리자 대시보드와 백엔드 API가 매칭되는지 6) 배포 스크립트가 정상인지 7) 보안 수정이 제대로 적용됐는지 (IDOR, CORS, RLS). 한국어로 답변.
mcp startup: no servers
codex
`/Users/woominseong/Desktop/창업` 전체를 기준으로 모바일, 백엔드, 관리자, 배포 구성을 먼저 식별하겠습니다. 그다음 요청하신 7개 항목을 각각 대조해서 누락 연결과 충돌을 찾겠습니다.
Plan update
  → 리포지토리 구조와 핵심 앱/서버/배포 디렉토리 식별
  • 모바일 21개 화면 네비게이션 흐름과 누락 연결 점검
  • 백엔드 라우터/핸들러/마이그레이션/워커 호출 구조 점검
  • 관리자 대시보드 API 매칭, 배포 스크립트, 보안 수정 적용 여부 점검
  • 발견사항을 심각도 순으로 정리해 최종 리뷰 작성
exec
/bin/zsh -lc pwd in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'rg --files /Users/woominseong/Desktop/창업' in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'find /Users/woominseong/Desktop/창업 -maxdepth 3 -type d | sort' in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 409ms:
/Users/woominseong/Desktop/창업/apps/mobile
 succeeded in 415ms:
/Users/woominseong/Desktop/창업
/Users/woominseong/Desktop/창업/.claude
/Users/woominseong/Desktop/창업/.claude/agents
/Users/woominseong/Desktop/창업/.git
/Users/woominseong/Desktop/창업/.git/hooks
/Users/woominseong/Desktop/창업/.git/info
/Users/woominseong/Desktop/창업/.git/logs
/Users/woominseong/Desktop/창업/.git/logs/refs
/Users/woominseong/Desktop/창업/.git/objects
/Users/woominseong/Desktop/창업/.git/objects/00
/Users/woominseong/Desktop/창업/.git/objects/01
/Users/woominseong/Desktop/창업/.git/objects/02
/Users/woominseong/Desktop/창업/.git/objects/03
/Users/woominseong/Desktop/창업/.git/objects/04
/Users/woominseong/Desktop/창업/.git/objects/05
/Users/woominseong/Desktop/창업/.git/objects/07
/Users/woominseong/Desktop/창업/.git/objects/08
/Users/woominseong/Desktop/창업/.git/objects/09
/Users/woominseong/Desktop/창업/.git/objects/0a
/Users/woominseong/Desktop/창업/.git/objects/0b
 succeeded in 421ms:
/Users/woominseong/Desktop/창업/CLAUDE.md
/Users/woominseong/Desktop/창업/compose.dev.yml
/Users/woominseong/Desktop/창업/compose.yml
/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts
/Users/woominseong/Desktop/창업/apps/mobile/store/onboarding.ts
/Users/woominseong/Desktop/창업/apps/mobile/store/notifications.ts
/Users/woominseong/Desktop/창업/apps/mobile/assets/adaptive-icon.png
/Users/woominseong/Desktop/창업/apps/mobile/assets/splash.png
/Users/woominseong/Desktop/창업/apps/mobile/assets/favicon.png
/Users/woominseong/Desktop/창업/apps/mobile/assets/icon.png
/Users/woominseong/Desktop/창업/apps/mobile/tsconfig.json
/Users/woominseong/Desktop/창업/apps/mobile/lib/cache.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/logger.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/pdf-generator.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/crypto.ts
/Users/woominseong/Desktop/창업/apps/mobile/lib/notifications.ts
/Users/woominseong/Desktop/창업/apps/mobile/package.json
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json
/Users/woominseong/Desktop/창업/apps/mobile/components/BenefitAmount.tsx
codex
구조는 `apps/mobile`, `apps/web`, `crates/api`, `crates/worker`, `infra/migrations`, `scripts` 중심입니다. 이제 화면/라우터/마이그레이션/워커/API 소비 지점을 서로 대조해서 실제 연결 상태를 확인하겠습니다.
exec
/bin/zsh -lc 'git -C /Users/woominseong/Desktop/창업 status --short' in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'find /Users/woominseong/Desktop/창업/apps/mobile/app -type f | sort' in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'find /Users/woominseong/Desktop/창업/infra/migrations -type f | sort' in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'find /Users/woominseong/Desktop/창업/crates/worker/src -type f | sort' in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'find /Users/woominseong/Desktop/창업/crates/api/src/routes -type f | sort' in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 590ms:
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/manage.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/auto-fill.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/calculator.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/document-vault.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/index.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step2.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/preview.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/privacy-policy.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/region-compare.tsx
/Users/woominseong/Desktop/창업/apps/mobile/app/stack-calculator.tsx
 succeeded in 606ms:
 M .github/workflows/ci.yml
 M .gitignore
 M .omc/project-memory.json
 D .omc/state/agent-replay-1649b6d1-fda2-4de0-b3c6-54893914f814.jsonl
 M .omc/state/hud-state.json
 M .omc/state/hud-stdin-cache.json
 D .omc/state/idle-notif-cooldown.json
 D .omc/state/last-tool-error.json
 M .omc/state/mission-state.json
 D .omc/state/subagent-tracking.json
 M CLAUDE.md
 M Cargo.lock
 M Makefile
 M apps/mobile/.expo/devices.json
 M apps/mobile/.expo/types/router.d.ts
 M apps/mobile/.omc/state/agent-replay-1649b6d1-fda2-4de0-b3c6-54893914f814.jsonl
 M apps/mobile/.omc/state/idle-notif-cooldown.json
 M apps/mobile/.omc/state/last-tool-error.json
 M apps/mobile/.omc/state/mission-state.json
 M apps/mobile/.omc/state/subagent-tracking.json
 succeeded in 581ms:
/Users/woominseong/Desktop/창업/crates/worker/src/alerts.rs
/Users/woominseong/Desktop/창업/crates/worker/src/lib.rs
/Users/woominseong/Desktop/창업/crates/worker/src/main.rs
/Users/woominseong/Desktop/창업/crates/worker/src/notifications/expo_push.rs
/Users/woominseong/Desktop/창업/crates/worker/src/notifications/fcm.rs
/Users/woominseong/Desktop/창업/crates/worker/src/notifications/kakao.rs
/Users/woominseong/Desktop/창업/crates/worker/src/notifications/mod.rs
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/financial.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/gov_benefits.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/local_scraper.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/mod.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/scholarship.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/worknet.rs
/Users/woominseong/Desktop/창업/crates/worker/src/sources/youth_center.rs
 succeeded in 584ms:
/Users/woominseong/Desktop/창업/infra/migrations/20260320000001_init.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260320000002_seed.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260320000003_bookmarks_states.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260320000004_ingestion.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260320000006_seed_extended.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000001_eligibility_and_profile.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000002_programs_search_tsv_trigger.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000003_corporate_benefits.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000004_financial_products.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000005_application_status.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000006_document_checklists.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000007_more_financial_products.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000008_eligibility_rules_seed.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000009_notification_preferences.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000010_application_steps.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260321000011_push_tokens.sql
/Users/woominseong/Desktop/창업/infra/migrations/20260322000001_rls_policies.sql
 succeeded in 583ms:
/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/auth.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/bookmark.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/dashboard.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/health.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/mod.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/payment.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/profile.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/push.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/recommend.rs
/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs
codex
이제 실제 구현 기준을 잡기 위해 모바일 라우트 정의, 백엔드 라우터 조립, 기능 흐름 문서를 함께 읽겠습니다. 이 단계에서 화면 수와 기대 플로우를 먼저 확정합니다.
exec
/bin/zsh -lc "sed -n '1,240p' /Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' /Users/woominseong/Desktop/창업/crates/api/src/lib.rs" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' /Users/woominseong/Desktop/창업/docs/기능흐름.md" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' /Users/woominseong/Desktop/창업/crates/api/src/routes/mod.rs" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,240p' /Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 535ms:
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

 succeeded in 534ms:
# 마지미 전체 기능 흐름 — 사용자 스토리

> 부산 대학생 김지수(24세)가 마지미를 설치하고, 정책/장학금을 찾고, 실제로 신청 완료하기까지의 전체 흐름.

---

## 등장인물

**김지수** (24세, 부산대 경영학과 3학년, 자취, 취업 준비 중)

---

## 1. 온보딩 (첫 실행)

지수가 에브리타임에서 "부산 대학생 장학금 정리" 글을 보고 마지미를 설치합니다.

```
앱 실행 → 온보딩 시작

Step 1/3: "어느 지역에 거주하시나요?"
 exited 1 in 534ms:
zsh:1: no matches found: /Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx
 succeeded in 537ms:
use axum::{
    extract::State,
    http::{header, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post, put},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::PeerIpKeyExtractor, GovernorLayer,
};
use tower_http::cors::CorsLayer;

pub mod auth;
mod routes;

// ── Shared application state ──
//
 succeeded in 538ms:
pub mod admin;
pub mod alerts;
pub mod auth;
pub mod bookmark;
pub mod dashboard;
pub mod health;
pub mod my;
pub mod payment;
pub mod profile;
pub mod programs;
pub mod push;
pub mod recommend;
pub mod state;
exec
/bin/zsh -lc "sed -n '1,240p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/_layout.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"router\\.|href=|Link|navigate|push\\(|replace\\(|back\\(\" /Users/woominseong/Desktop/창업/apps/mobile/app /Users/woominseong/Desktop/창업/apps/mobile/components" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"fetch\\(|api\\.|/api/v1/|http\" /Users/woominseong/Desktop/창업/apps/mobile /Users/woominseong/Desktop/창업/apps/web/src" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 401ms:
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
 succeeded in 413ms:
/Users/woominseong/Desktop/창업/apps/mobile/app/terms.tsx:36:          onPress={() => router.back()}
/Users/woominseong/Desktop/창업/apps/mobile/components/RecommendationCard.tsx:16:  Linking,
/Users/woominseong/Desktop/창업/apps/mobile/components/RecommendationCard.tsx:97:      Linking.openURL(official_url);
/Users/woominseong/Desktop/창업/apps/mobile/components/RecommendationCard.tsx:102:    router.push(`/programs/${program_id}`);
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:181:    base.push({ name: "성적증명서 (최근 학기)", required: true, prepared: false });
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:182:    base.push({ name: "장학금 신청서 (기관 양식)", required: true, prepared: false });
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:186:    base.push({ name: "사업계획서 또는 활동계획서", required: false, prepared: false });
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:238:  const show = useCallback(
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:700:  const toggleDoc = useCallback((name: string) => {
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:712:  const handleGenerateFull = useCallback(async () => {
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:728:  const handleGenerateSimple = useCallback(async () => {
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:744:  const handleShare = useCallback(async () => {
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:767:  const handlePrint = useCallback(async () => {
/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx:802:            onPress={() => router.back()}
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:51:    router.replace("/onboarding");
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:57:  const handleNext = useCallback(() => {
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:59:    router.push("/calculator");
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:62:  const handleBack = useCallback(() => {
/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx:63:    router.back();
/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx:65:            router.replace("/(tabs)");
 succeeded in 406ms:
/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts:23:const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts:33:      const res = await fetch(`${API_BASE_URL}/api/v1/auth/kakao`, {
/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts:64:        const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:2:  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:8:  const res = await fetch(`${API_BASE_URL}${path}`, {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:104:      `/api/v1/programs${qs ? `?${qs}` : ""}`
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:109:    request<Program>(`/api/v1/programs/${id}`),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:112:    request<PreviewResponse>("/api/v1/recommend/preview", {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:119:    return request<{ count: number }>(`/api/v1/programs/count${qs}`);
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:123:    request<DashboardData>(`/api/v1/dashboard?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:126:    request<{ saved: SavedProgram[] }>(`/api/v1/my/saved?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:130:      `/api/v1/my/applications?user_id=${userId}`
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:135:      `/api/v1/programs/${programId}/bookmark`,
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:148:    request<ApplicationItem>(`/api/v1/my/applications/${applicationId}`, {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:154:    request<Alert[]>(`/api/v1/alerts?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:157:    request<void>("/api/v1/alerts/preferences", {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:254:  getStats: () => request<AdminStats>("/api/v1/admin/stats"),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:257:    request<{ status: string; message: string }>("/api/v1/admin/sync", {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:267:      `/api/v1/admin/programs${qs ? `?${qs}` : ""}`
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:272:    request<AdminProgram>(`/api/v1/programs/${id}`),
codex
모바일 쪽은 라우트 문자열과 실제 화면 파일을 맞춰 보면서 역참조도 보겠습니다. 특히 “파일은 있는데 진입 버튼이 없는 화면”과 “버튼은 있는데 대상 화면이 빠진 경우”를 찾는 방식으로 확인합니다.
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/login.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,240p' '/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/index.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,240p' '/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step2.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/calculator.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,240p' '/Users/woominseong/Desktop/창업/apps/mobile/app/onboarding/step3.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/preview.tsx'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 528ms:
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
import { makeRedirectUri } from "expo-auth-session";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/auth";
import { colors, typography, borderRadius, layout, shadows } from "../constants/theme";

WebBrowser.maybeCompleteAuthSession();

const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID ?? "";
 succeeded in 544ms:
/**
 * Onboarding Step 2 — Age + University Status
 * Matches Stitch "Onboarding / Profile Setup" design exactly.
 */
import React, { useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
 succeeded in 545ms:
/**
 * Onboarding Step 1 — Region Selection
 * Matches Stitch "Onboarding / Profile Setup" design exactly.
 */
import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "@/store/onboarding";
 succeeded in 545ms:
/**
 * Preview Screen — shows recommendation results after onboarding.
 *
 * Data source: api.getRecommendPreview(ProfileInput)
 *   POST /api/v1/recommend/preview
 *   Response: RecommendationResult { total_available, estimated_monthly,
 *             estimated_semester, items: RecommendationItem[] }
 *
 * Offline: caches the last successful result in AsyncStorage and shows
 * a banner when the cached copy is being used.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
 succeeded in 546ms:
/**
 * 놓친 돈 계산기 — shown once after onboarding step 3 completes.
 *
 * Flow: onboarding/step3 → /calculator → /(tabs)
 *
 * - Fetches recommendation preview using the onboarding profile
 * - Animated counter counts up from 0 to the estimated annual benefit
 * - Breakdown cards by program_type
 * - CTA and secondary link both navigate to /(tabs)
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
 succeeded in 545ms:
/**
 * Onboarding Step 3 — Employment Status
 * Matches Stitch "Onboarding / Profile Setup" design exactly.
 */
import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "@/store/onboarding";
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/manage.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 506ms:
/**
 * Explore / Search Page
 *
 * Data source: api.getPrograms({ program_type?, region? })
 *
 * On API failure the list falls back to static mock data and shows an
 * "오프라인 모드" banner. Client-side search/tab filtering is applied on top
 * of whatever data is available (live or mock).
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
 succeeded in 506ms:
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
  StatusBar,
 succeeded in 474ms:
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
 succeeded in 477ms:
/**
 * Manage Tab — "추천 패키지" screen
 *
 * Data sources:
 *   - api.getRecommendPreview()  → scholarship / support recommendations
 *   - api.getDashboard(USER_ID)  → overall score, deadline items
 *
 * On API failure the screen falls back to static mock data and shows an
 * "오프라인 모드" banner.
 */

import React, { useCallback, useState } from "react";
import {
  Alert as RNAlert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
 succeeded in 478ms:
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
 succeeded in 480ms:
/**
 * 내 정보 (Profile) Screen
 *
 * Data source: api.getProfile(userId)
 *
 * On API failure the screen falls back to static mock profile data and shows
 * an "오프라인 모드" banner. Alert preferences are still editable and saved
 * via api.upsertAlertPreference when a programId is known; the save button
 * is disabled in offline mode.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
exec
/bin/zsh -lc "sed -n '260,520p' '/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '260,620p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '260,760p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/manage.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '260,620p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/index.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '260,620p' '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/explore.tsx'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 600ms:

  const profileQuery = useQuery({
    queryKey: ["profile", USER_ID],
    queryFn: () => api.getProfile(USER_ID),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  const isOffline = profileQuery.isError && !profileQuery.isLoading;

  // Resolve display profile — API data or mock fallback
  const profile: Partial<UserProfile> =
    profileQuery.data?.profile ?? MOCK_PROFILE;

  const birthYear = profile.birth_year ?? 2001;
  const age = CURRENT_YEAR - birthYear;
  const region = regionLabel(profile.region_code);
  const enrollment = enrollmentLabel(profile.enrollment_status);
  const employment = employmentLabel(profile.employment_status);
 succeeded in 605ms:
// ---------------------------------------------------------------------------

/** Format a benefit amount into a human-readable Korean label. */
export function formatBenefit(program: ApiProgram): string {
  if (program.benefit_amount_monthly) {
    const m = Math.round(program.benefit_amount_monthly / 10000);
    return `월 ${m}만원`;
  }
  if (program.benefit_amount_semester) {
    const s = Math.round(program.benefit_amount_semester / 10000);
    return `학기 ${s}만원`;
  }
  if (program.benefit_amount_once) {
    const o = Math.round(program.benefit_amount_once / 10000);
    return `최대 ${o}만원`;
  }
  return "혜택 확인";
}

/** Map program_type English key to Korean display label. */
 succeeded in 614ms:
  BadgeVariant,
  { label: string; bg: string; textColor: string }
> = {
  recommended: {
    label: "추천",
    bg: colors.primaryFixed,
    textColor: colors.primary,
  },
  available: {
    label: "신청 가능",
    bg: "#e8f5e9",
    textColor: "#2e7d32",
  },
  deadline: {
    label: "마감 임박",
    bg: "#fff3e0",
    textColor: "#ef6c00",
  },
};

 succeeded in 614ms:
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: strokeWidth,
                borderColor: fillColor,
                transform: [{ rotate: `${filled - 180}deg` }],
              }}
            />
          </View>
        </View>
      )}

      <Text style={[styles.progressLabel, { color: fillColor }]}>
        {progress}%
 succeeded in 630ms:
    <View style={styles.segmentedControl} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.segmentItem, isActive && styles.segmentItemActive]}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab}
          >
            <Text
              style={[
                styles.segmentText,
                isActive
                  ? styles.segmentTextActive
                  : styles.segmentTextInactive,
              ]}
codex
화면 연결성은 수작업만으로 놓치기 쉬워서, 라우트 파일 목록과 코드 내 푸시/리플레이스 대상을 한 번 더 비교하겠습니다. 여기서 “진입점 없음”, “나가기만 있고 들어오기 없음”, “TODO만 있고 실제 액션 없음”을 골라냅니다.
exec
/bin/zsh -lc "node - <<'NODE'
const fs=require('fs');
const path=require('path');
const base='/Users/woominseong/Desktop/창업/apps/mobile/app';
function walk(dir){let out=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()) out=out.concat(walk(p)); else if(e.isFile()&&/\\.tsx"'$/.test(e.name)&&!e.name.startsWith('"'_')) out.push(p);}return out;}
const files=walk(base).sort();
for(const f of files){const rel=path.relative(base,f);console.log(rel)}
console.error('count='+files.length)
NODE" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n 'router\\.(push|replace)\\(|href=|Link' '/Users/woominseong/Desktop/창업/apps/mobile/app' '/Users/woominseong/Desktop/창업/apps/mobile/components' | sed 's#"'^/Users/woominseong/Desktop/창업/apps/mobile/##'"'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 364ms:
(tabs)/explore.tsx
(tabs)/index.tsx
(tabs)/manage.tsx
(tabs)/profile.tsx
apply-assistant.tsx
auto-fill.tsx
calculator.tsx
document-vault.tsx
generated-form.tsx
login.tsx
onboarding/index.tsx
onboarding/step2.tsx
onboarding/step3.tsx
preview.tsx
privacy-policy.tsx
programs/[id].tsx
region-compare.tsx
stack-calculator.tsx
terms.tsx
count=19
 succeeded in 348ms:
app/calculator.tsx:208:    router.replace("/onboarding");
app/calculator.tsx:272:    router.replace("/(tabs)");
app/calculator.tsx:315:          style={styles.skipLink}
app/calculator.tsx:319:          <Text style={styles.skipLinkText}>건너뛰기</Text>
app/calculator.tsx:533:  skipLink: {
app/calculator.tsx:538:  skipLinkText: {
app/auto-fill.tsx:1179:                router.push(`/generated-form?programId=${programId}`);
app/auto-fill.tsx:1240:            if (programId) router.push(`/generated-form?programId=${programId}`);
app/document-vault.tsx:30:  Linking,
app/document-vault.tsx:544:            onPress={() => Linking.openURL(cfg.issuerUrl)}
app/document-vault.tsx:632:          onPress={() => Linking.openURL(benefit.matchUrl!)}
app/onboarding/step2.tsx:55:    router.replace("/onboarding");
app/onboarding/step2.tsx:63:    router.push("/onboarding/step3");
components/RecommendationCard.tsx:16:  Linking,
components/RecommendationCard.tsx:97:      Linking.openURL(official_url);
components/RecommendationCard.tsx:102:    router.push(`/programs/${program_id}`);
app/login.tsx:65:            router.replace("/(tabs)");
app/login.tsx:81:    router.replace("/(tabs)");
app/login.tsx:148:            style={styles.legalNoteLink}
app/login.tsx:149:            onPress={() => router.push("/terms")}
exec
/bin/zsh -lc "sed -n '1180,1270p' '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1460,1510p' '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"onPress=\\{|TouchableOpacity|Pressable|router\\.push|router\\.replace\" '/Users/woominseong/Desktop/창업/apps/mobile/app/generated-form.tsx' | sed -n '1,160p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '560,620p' '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"onPress=\\{|router\\.|Linking\\.openURL|api\\.\" '/Users/woominseong/Desktop/창업/apps/mobile/app/document-vault.tsx' | sed -n '1,220p'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 434ms:
    },
  });

  function handleStepPress(status: ApplicationStatus) {
    if (status === currentStatus) return;
    updateStatus(status);
  }

  function handleQuickAction() {
    const action = getQuickAction(currentStatus);
    if (action.nextStatus) {
      updateStatus(action.nextStatus);
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (error || !program) return <ErrorScreen onBack={() => router.back()} />;

  const typeConfig = getProgramTypeConfig(program.program_type);
  const applicationPeriod = formatApplicationPeriod(
 succeeded in 433ms:
  // Status mutation — update to "applying" on Step 5
  const { mutate: updateStatus } = useMutation({
    mutationFn: (status: ApplicationStatus) =>
      api.updateApplicationStatus(USER_ID, programId!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["applicationStatus", programId, USER_ID],
      });
    },
  });

  // Step 4 → Step 5: mark as "applying"
  function handleFillDone() {
    updateStatus("applying");
    setStep(5);
  }

  function handleNext() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }
 succeeded in 426ms:
                    >
                      <Text
                        style={[
                          stepStyles.docBadgeText,
                          doc.required
                            ? stepStyles.docBadgeTextRequired
                            : stepStyles.docBadgeTextOptional,
                        ]}
                      >
                        {doc.required ? "필수" : "선택"}
                      </Text>
                    </View>
                  </View>
                  <Text style={stepStyles.docIssuer}>
                    {doc.issuer} · 약 {doc.daysNeeded}일 소요
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Issue link for unprepared docs */}
 succeeded in 428ms:
19:  TouchableOpacity,
375:    <TouchableOpacity
377:      onPress={() => onToggle(doc.name)}
394:    </TouchableOpacity>
543:      <TouchableOpacity
545:        onPress={onPress}
569:      </TouchableOpacity>
574:    <TouchableOpacity
576:      onPress={onPress}
588:    </TouchableOpacity>
800:          <TouchableOpacity
802:            onPress={() => router.back()}
808:          </TouchableOpacity>
930:            onPress={handleGenerateFull}
941:            onPress={handleGenerateSimple}
954:                onPress={handleShare}
963:                onPress={handlePrint}
983:        <TouchableOpacity
985:          onPress={handleShare}
994:        </TouchableOpacity>
 succeeded in 428ms:
544:            onPress={() => Linking.openURL(cfg.issuerUrl)}
632:          onPress={() => Linking.openURL(benefit.matchUrl!)}
794:            onPress={onRetake}
805:            onPress={() => {
1143:      <Pressable style={modalStyles.overlay} onPress={handleClose}>
1152:            onPress={(e) => e.stopPropagation()}
1178:                    onPress={() => setSelectedType(type)}
1212:              onPress={showAddOptions}
1230:                onPress={handleClose}
1238:                onPress={handleSave}
1409:        onPress={onAdd}
1527:            onPress={() => router.back()}
1594:              onPress={() => setShowAddModal(true)}
1670:            onPress={() => setShowAddModal(true)}
codex
이제 백엔드와 관리자 쪽을 보겠습니다. 라우터에 노출된 엔드포인트, 실제 핸들러 함수, 웹 대시보드가 호출하는 경로를 서로 교차 검증합니다.
exec
/bin/zsh -lc "sed -n '1,340p' '/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,320p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,320p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/profile.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,320p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/auth.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,340p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "for f in /Users/woominseong/Desktop/창업/crates/api/src/routes/*.rs; do echo '---' "'$f; rg -n '"'pub async fn|async fn' \""'$f"; done' in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 520ms:
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
 succeeded in 496ms:
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::UserProgramState;

use crate::auth::AuthUser;

const VALID_STATES: &[&str] = &[
    "interested",
    "planning",
    "applying",
    "applied",
    "waiting",
 succeeded in 500ms:
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::{ProfileInput, UserProfile};

use crate::auth::AuthUser;

/// POST /api/v1/profile
///
/// Upserts the authenticated user's profile.
/// The user's ID is taken from the JWT — the client must be authenticated.
pub async fn save_profile(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<SaveProfileRequest>,
 succeeded in 501ms:
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

use crate::auth::AdminUser;

/// POST /api/v1/admin/sync
pub async fn trigger_sync(
    _admin: AdminUser,
    State(pool): State<PgPool>,
) -> Json<Value> {
    tokio::spawn(async move {
        tracing::info!("manual sync triggered via admin API");
 succeeded in 499ms:
use axum::{extract::State, http::StatusCode, Extension, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{auth::{create_token, AuthUser}, AppState};

// ── Request / Response types ──

#[derive(Debug, Deserialize)]
pub struct KakaoLoginRequest {
    pub access_token: String,
}

// ── Kakao API response shape (minimum fields we need) ──

#[derive(Debug, serde::Deserialize)]
struct KakaoUserMe {
    id: i64,
    kakao_account: Option<KakaoAccount>,
 succeeded in 525ms:
--- /Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs
15:pub async fn trigger_sync(
101:pub async fn list_admin_programs(
142:pub async fn create_program(
218:pub async fn update_program(
326:pub async fn toggle_publish(
373:pub async fn get_stats(
--- /Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs
90:pub async fn list_alerts(
153:pub async fn upsert_preferences(
239:pub async fn get_notification_preferences(
303:pub async fn update_notification_preferences(
--- /Users/woominseong/Desktop/창업/crates/api/src/routes/auth.rs
40:pub async fn kakao_login(
118:pub async fn me(
--- /Users/woominseong/Desktop/창업/crates/api/src/routes/bookmark.rs
15:pub async fn toggle_bookmark(
--- /Users/woominseong/Desktop/창업/crates/api/src/routes/dashboard.rs
15:pub async fn get_dashboard(
92:async fn build_todo_items(pool: &PgPool, user_id: Uuid) -> Result<Vec<String>, sqlx::Error> {
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,360p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/alerts.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,360p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/programs.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,240p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/bookmark.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/dashboard.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/push.rs'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 508ms:
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

// ── Notification preferences types ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct NotifChannels {
    pub in_app: bool,
    pub push: bool,
    pub kakao: bool,
 succeeded in 511ms:
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::{Program, UserProgramState};

#[derive(Debug, Deserialize)]
pub struct UserQuery {
    pub user_id: Uuid,
}

/// GET /api/v1/my/saved?user_id=UUID
/// Returns bookmarked programs with full program data.
pub async fn get_saved(
    State(pool): State<PgPool>,
 succeeded in 486ms:
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

// ── Query parameters ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ProgramQuery {
    /// Full-text search query (searches against search_tsv)
    pub q: Option<String>,
    /// Filter by program_type: policy | welfare | scholarship
    pub category: Option<String>,
    /// Filter by region (matched against regions TEXT[])
 succeeded in 487ms:
use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::Program;

use crate::auth::AuthUser;

/// GET /api/v1/dashboard
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn get_dashboard(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

 succeeded in 487ms:
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

/// POST /api/v1/programs/{program_id}/bookmark
/// Toggle bookmark: insert if not exists, delete if exists.
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn toggle_bookmark(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;
 succeeded in 489ms:
use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{auth::AuthUser, AppState};

// ── Request types ──

#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub token: String,
    pub platform: String,
}

// ── Handlers ──

/// POST /api/v1/push/register
///
/// Upserts an Expo push token for the authenticated user/device pair.
/// The user's ID is taken from the JWT — no client-supplied user_id accepted.
exec
/bin/zsh -lc "find '/Users/woominseong/Desktop/창업/apps/web/src/app/admin' -type f | sort | xargs -I{} sh -c \"echo '--- {}'; sed -n '1,260p' '{}'\"" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "find '/Users/woominseong/Desktop/창업/apps/web/src/app' -path '*/dashboard/page.tsx' -o -path '*/alerts/page.tsx' -o -path '*/my/*/page.tsx' -o -path '*/settings/page.tsx' | sort | xargs -I{} sh -c \"echo '--- {}'; sed -n '1,240p' '{}'\"" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 366ms:
--- /Users/woominseong/Desktop/창업/apps/web/src/app/alerts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { api, USER_ID, Alert } from "@/lib/api";
import AlertCard from "@/components/AlertCard";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getAlerts(USER_ID)
      .then(setAlerts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

 succeeded in 373ms:
--- /Users/woominseong/Desktop/창업/apps/web/src/app/admin/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/programs", label: "프로그램 관리" },
  { href: "/admin/sync", label: "데이터 동기화" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
codex
마이그레이션은 파일명 순서와 실제 참조 순서를 같이 봐야 합니다. 먼저 각 SQL이 어떤 테이블/컬럼을 만들거나 참조하는지 추려서 의존성 충돌 여부를 확인하겠습니다.
exec
/bin/zsh -lc "for f in /Users/woominseong/Desktop/창업/infra/migrations/*.sql; do echo '---' "'$(basename "$f"); rg -n '"'CREATE TABLE|ALTER TABLE|INSERT INTO|CREATE POLICY|ENABLE ROW LEVEL SECURITY|REFERENCES|ADD COLUMN|CREATE INDEX|CREATE OR REPLACE FUNCTION|CREATE TRIGGER' \""'$f"; done' in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/infra/migrations/20260320000001_init.sql'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/infra/migrations/20260321000010_application_steps.sql'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/infra/migrations/20260322000001_rls_policies.sql'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/infra/migrations/20260321000001_eligibility_and_profile.sql'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 482ms:
-- RLS (Row Level Security) policies for all Majimi tables.
--
-- Auth model:
--   - The Rust API server connects as the 'wello' PostgreSQL role (or postgres
--     in local dev). It sets a session-local claim before every query:
--       SET LOCAL app.current_user_id = '<uuid>';
--     This lets RLS policies read the caller's identity without relying on the
--     Supabase JWT flow.
--   - Service-level bypass: any query running as the 'wello' DB user (the API
--     server connection role) or 'postgres' (local dev superuser) skips user-
--     level restrictions automatically via the BYPASSRLS attribute OR via the
--     explicit bypass policy added to each table.
--   - End-user identity is read from current_setting('app.current_user_id', true).
--     The second argument (true) makes the function return NULL instead of
--     raising an error when the setting is absent (e.g. during migrations).
--
-- Policy naming convention:
--   "<table>_<operation>_<who>"
--   e.g. "users_select_own", "programs_select_public", "users_all_service"

 succeeded in 483ms:
-- Migration: eligibility_and_profile
-- Adds missing profile fields, eligibility_rules, program_documents tables,
-- and unique constraint on users(auth_provider, auth_provider_id).

-- ── 1. user_profiles: add missing fields ──

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS has_disability          BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_multicultural_family BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_low_income_household BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS veteran_family          BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS preferred_categories    TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS school_type             TEXT,
    ADD COLUMN IF NOT EXISTS age_band                TEXT;

-- ── 2. eligibility_rules ──

CREATE TABLE IF NOT EXISTS eligibility_rules (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id       UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
 succeeded in 483ms:
-- Migration: application_steps
-- Adds application_steps JSONB column to programs and seeds step-by-step guides
-- for 13 major programs across scholarship, rent, loan, employment, startup categories.

ALTER TABLE programs ADD COLUMN IF NOT EXISTS application_steps JSONB;

-- ============================================================
-- 장학금 (scholarship)
-- ============================================================

-- 국가장학금 1유형 — 한국장학재단 온라인 신청
UPDATE programs SET application_steps = '[
  {"step": 1, "title": "서류 준비", "description": "재학증명서, 성적증명서, 소득금액증명원, 주민등록등본을 미리 발급해 두세요. 정부24(gov.kr)·홈택스에서 온라인 발급 가능합니다.", "url": null},
  {"step": 2, "title": "한국장학재단 로그인", "description": "한국장학재단 홈페이지에 접속한 뒤 공동인증서 또는 간편인증으로 로그인합니다.", "url": "https://www.kosaf.go.kr"},
  {"step": 3, "title": "장학금 신청", "description": "상단 메뉴 [장학금] → [국가장학금 신청]을 클릭하고 신청서를 작성합니다. 가구원 동의도 같은 기간 안에 완료해야 합니다.", "url": "https://www.kosaf.go.kr/ko/scholar.do"},
  {"step": 4, "title": "가구원 동의", "description": "부모(또는 배우자)가 공동인증서로 가구원 정보 제공에 동의해야 심사가 진행됩니다.", "url": "https://www.kosaf.go.kr"},
  {"step": 5, "title": "심사 대기", "description": "신청 완료 후 소득분위 산정까지 약 4~6주가 소요됩니다. 진행 상황은 홈페이지에서 확인할 수 있습니다.", "url": null},
  {"step": 6, "title": "장학금 수혜 확인", "description": "심사 결과가 문자로 통보됩니다. 수혜 확정 후 등록금 고지서에서 자동 차감 또는 계좌로 입금됩니다.", "url": null}
]'
WHERE title = '국가장학금 1유형';
 succeeded in 485ms:
-- Initial schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    phone TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'kakao',
    auth_provider_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    birth_year INT,
    region_code TEXT,
    city_code TEXT,
    school_name TEXT,
 succeeded in 570ms:
--- 20260320000001_init.sql
4:CREATE TABLE users (
15:CREATE TABLE user_profiles (
16:    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
33:CREATE TABLE programs (
64:CREATE INDEX idx_programs_type ON programs(program_type);
65:CREATE INDEX idx_programs_status ON programs(program_status);
66:CREATE INDEX idx_programs_deadline ON programs(deadline_at);
67:CREATE INDEX idx_programs_active ON programs(is_active);
68:CREATE INDEX idx_programs_regions ON programs USING GIN(regions);
69:CREATE INDEX idx_programs_search ON programs USING GIN(search_tsv);
70:CREATE INDEX idx_programs_age ON programs(min_age, max_age);
--- 20260320000002_seed.sql
4:INSERT INTO programs (
18:INSERT INTO programs (
32:INSERT INTO programs (
46:INSERT INTO programs (
60:INSERT INTO programs (
74:INSERT INTO programs (
88:INSERT INTO programs (
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/worker/src/lib.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/worker/src/main.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/worker/src/sources/mod.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,360p' '/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "for f in /Users/woominseong/Desktop/창업/crates/worker/src/sources/*.rs; do echo '---' "'$(basename "$f"); sed -n '"'1,220p' \""'$f"; done' in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 447ms:
mod alerts;
mod notifications;
mod pipeline;
mod sources;

use sqlx::postgres::PgPoolOptions;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing_subscriber::EnvFilter;

use majimi_core::AppConfig;

use crate::notifications::NotificationDispatcher;
use crate::sources::financial::FssFinancialSource;
use crate::sources::gov_benefits::GovBenefitsSource;
use crate::sources::local_scraper::LocalScraperSource;
use crate::sources::scholarship::ScholarshipSource;
use crate::sources::worknet::WorknetSource;
use crate::sources::youth_center::YouthCenterSource;

#[tokio::main]
 succeeded in 452ms:
pub mod pipeline;
pub mod sources;
 succeeded in 437ms:
pub mod financial;
pub mod gov_benefits;
pub mod local_scraper;
pub mod scholarship;
pub mod worknet;
pub mod youth_center;

use anyhow::Result;
use serde_json::Value;
use std::collections::BTreeMap;

/// A raw record fetched from an external data source.
#[derive(Debug, Clone)]
pub struct RawRecord {
    /// Stable identifier within the source (e.g. service code)
    pub source_id: String,
    /// Raw JSON payload as returned by the API
    pub payload: Value,
    /// Hex digest of the canonical JSON bytes (change detection)
    pub content_hash: String,
 succeeded in 438ms:
//! Normalize pipeline: fetch → save raw → hash compare → normalize → upsert programs → log

use anyhow::Result;
use chrono::Utc;
use sqlx::PgPool;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::sources::{DataSource, RawRecord};

/// Run the full ingestion pipeline for a single source.
pub async fn run_ingestion<S: DataSource>(pool: &PgPool, source: &S) -> Result<()> {
    let source_name = source.name();
    let run_id = Uuid::new_v4();
    let started_at = Utc::now();

    info!(source = source_name, run_id = %run_id, "ingestion run started");

    // Insert ingestion_run row (status = running)
    sqlx::query(
 succeeded in 456ms:
--- financial.rs
//! 금융감독원 금융상품 비교공시 API client
//!
//! APIs:
//!   예금: https://finlife.fss.or.kr/finlifeapi/depositProductsSearch.json
//!   적금: https://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json
//!   대출: https://finlife.fss.or.kr/finlifeapi/mortgageLoanProductsSearch.json
//!
//! Env: FSS_API_KEY  (금융감독원 금융상품 비교공시 API 인증키)
//! Auth: query param `auth`
//!
//! Filters: only products with "청년" in name or description.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/README.md'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"7개|7 sources|seven|source\" '/Users/woominseong/Desktop/창업/docs' '/Users/woominseong/Desktop/창업/README.md' '/Users/woominseong/Desktop/창업/CLAUDE.md' '/Users/woominseong/Desktop/창업/crates/worker/src'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 365ms:
# 웰로 (Wello)

부산·대구 청년을 위한 **정책·장학금 맞춤 추천 플랫폼**

프로필(학교, 전공, 소득분위, 거주지 등)을 입력하면 공공 API에서 수집한 정책·장학금 데이터를 기반으로 맞춤 추천을 제공합니다.

## 아키텍처

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Caddy   │────▶│ Next.js  │     │  Worker  │
│ (Reverse │     │ Frontend │     │ (Cron /  │
│  Proxy)  │──┐  └──────────┘     │  Ingest) │
└──────────┘  │                   └────┬─────┘
              │  ┌──────────┐         │
              └─▶│ Rust API │         │
                 │ (Axum)   │         │
                 └────┬─────┘         │
                      │               │
              ┌───────▼───────┐       │
 succeeded in 370ms:
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:9:use crate::sources::{DataSource, RawRecord};
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:11:/// Run the full ingestion pipeline for a single source.
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:12:pub async fn run_ingestion<S: DataSource>(pool: &PgPool, source: &S) -> Result<()> {
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:13:    let source_name = source.name();
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:17:    info!(source = source_name, run_id = %run_id, "ingestion run started");
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:21:        "INSERT INTO ingestion_runs (id, source_name, status, started_at) \
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:25:    .bind(source_name)
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:30:    let result = process_source(pool, source, run_id).await;
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:47:                source = source_name,
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:65:            error!(source = source_name, run_id = %run_id, error = %e, "ingestion run failed");
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:74:async fn process_source<S: DataSource>(
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:76:    source: &S,
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:79:    let source_name = source.name();
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:82:    let records = source.fetch_all().await?;
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:88:        match process_record(pool, source_name, run_id, record).await {
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:96:                    source = source_name,
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:97:                    source_id = %record.source_id,
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:103:                         (id, run_id, source_id, status, error_message, created_at) \
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:105:                     ON CONFLICT (run_id, source_id) DO UPDATE \
/Users/woominseong/Desktop/창업/crates/worker/src/pipeline.rs:110:                .bind(&record.source_id)
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/scripts/deploy.sh'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,220p' '/Users/woominseong/Desktop/창업/Makefile'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/compose.yml'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/compose.dev.yml'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "for f in /Users/woominseong/Desktop/창업/infra/docker/Dockerfile.* /Users/woominseong/Desktop/창업/infra/caddy/Caddyfile /Users/woominseong/Desktop/창업/infra/caddy/Caddyfile.dev /Users/woominseong/Desktop/창업/.github/workflows/*; do echo '---' "'$f; sed -n '"'1,260p' \""'$f"; done' in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 466ms:
#!/bin/bash
# =============================================================================
# Majimi — One-Command Production Deployment
# Usage: ./scripts/deploy.sh
# Prerequisites: Docker, Docker Compose v2, domain DNS A record pointing to VPS
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production"
ENV_EXAMPLE="$REPO_ROOT/.env.production.example"
COMPOSE="docker compose -f $REPO_ROOT/compose.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

 succeeded in 469ms:
.PHONY: dev dev-up dev-down dev-logs prod prod-up prod-down prod-logs db-shell redis-shell scrape clean \
        deploy backup logs restart status

# Development
dev: dev-up
dev-up:
	docker compose -f compose.dev.yml up --build
dev-down:
	docker compose -f compose.dev.yml down
dev-logs:
	docker compose -f compose.dev.yml logs -f

# Production
prod: prod-up
prod-up:
	docker compose -f compose.yml up --build -d
prod-down:
	docker compose -f compose.yml down
prod-logs:
	docker compose -f compose.yml logs -f
 succeeded in 469ms:
name: majimi

services:
  web:
    build:
      context: .
      dockerfile: infra/docker/Dockerfile.web
    restart: unless-stopped
    env_file: .env.production
    environment:
      - NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api
      - NEXTAUTH_URL=https://${DOMAIN}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - KAKAO_CLIENT_ID=${KAKAO_CLIENT_ID}
      - KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET}
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
 succeeded in 469ms:
name: majimi

services:
  web:
    build:
      context: .
      dockerfile: infra/docker/Dockerfile.web
      target: deps
    command: sh -c "npm run dev"
    working_dir: /app
    volumes:
      - ./apps/web:/app
      - web_node_modules:/app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
      - WATCHPACK_POLLING=true
    depends_on:
 succeeded in 479ms:
--- /Users/woominseong/Desktop/창업/infra/docker/Dockerfile.api
FROM rust:slim AS chef
RUN cargo install cargo-chef
WORKDIR /app

FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY infra/migrations/ infra/migrations/
RUN cargo build --release --bin api

FROM debian:bookworm-slim AS runtime
codex
보안은 “정책 파일 존재”보다 “런타임에서 실제로 적용되는지”가 핵심입니다. 그래서 IDOR 방어 핸들러, CORS allowlist, 그리고 DB 세션에서 RLS 식별자를 실제로 세팅하는 코드까지 추적하겠습니다.
exec
/bin/zsh -lc "sed -n '1,320p' '/Users/woominseong/Desktop/창업/crates/api/src/auth.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"app\\.current_user_id|SET LOCAL|set_config|BYPASSRLS|current_user|RLS|FORCE ROW LEVEL SECURITY|CORS|allow_origin|auth_user\\.id "'!=|role != '"\\\"admin\\\"|user_id\" '/Users/woominseong/Desktop/창업/crates/api' '/Users/woominseong/Desktop/창업/crates/core' '/Users/woominseong/Desktop/창업/infra/migrations'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc 'cargo check --workspace' in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc 'cargo test --workspace' in /Users/woominseong/Desktop/창업exec
/bin/zsh -lc "sed -n '240,520p' '/Users/woominseong/Desktop/창업/crates/api/src/lib.rs'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 467ms:
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;

// ── Token lifetime: 7 days ──
// TODO: Implement refresh token flow so short-lived access tokens can be
// renewed without forcing the user to re-authenticate. Access tokens should
// stay at 7 days (or shorter) once refresh tokens are in place.
const TOKEN_EXPIRY_SECS: usize = 7 * 24 * 60 * 60; // 604800 seconds

// ── Claims stored inside the JWT ──

 succeeded in 459ms:
    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| unauthorized("Authorization header must use Bearer scheme"))?;

    let claims = auth::verify_token(token, &state.jwt_secret)
        .map_err(|_| unauthorized("Invalid or expired token"))?;

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| unauthorized("Malformed token subject"))?;

    let auth_user = auth::AuthUser {
        id: user_id,
        role: claims.role,
    };

    // Make AuthUser available to handlers via request extensions
    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}
 succeeded in 473ms:
/Users/woominseong/Desktop/창업/infra/migrations/20260321000011_push_tokens.sql:9:    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
/Users/woominseong/Desktop/창업/infra/migrations/20260321000011_push_tokens.sql:18:CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens (user_id);
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:8:    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:13:    UNIQUE(user_id, program_id)
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:16:CREATE INDEX idx_alert_subs_user    ON alert_subscriptions(user_id);
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:22:-- (user_id, program_id, alert_type, alert_date) UNIQUE → 중복 발송 방지.
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:26:    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:31:    UNIQUE(user_id, program_id, alert_type, alert_date)
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:34:CREATE INDEX idx_alert_del_user    ON alert_deliveries(user_id);
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:37:-- 하루 2회 제한 체크용: (user_id, alert_date) 빠른 COUNT
/Users/woominseong/Desktop/창업/infra/migrations/20260320000005_alerts.sql:38:CREATE INDEX idx_alert_del_user_date ON alert_deliveries(user_id, alert_date);
/Users/woominseong/Desktop/창업/crates/api/src/routes/recommend.rs:73:    // A synthetic user_id is used since this is a preview (no login required).
/Users/woominseong/Desktop/창업/crates/api/src/routes/recommend.rs:214:        user_id: Uuid::nil(), // preview mode — no real user
/Users/woominseong/Desktop/창업/crates/core/src/models.rs:24:    pub user_id: Uuid,
/Users/woominseong/Desktop/창업/crates/core/src/models.rs:147:    pub user_id: Uuid,
/Users/woominseong/Desktop/창업/crates/core/src/models.rs:157:    pub user_id: Uuid,
/Users/woominseong/Desktop/창업/crates/core/src/models.rs:365:            user_id: fixed_uuid(),
/Users/woominseong/Desktop/창업/crates/core/src/models.rs:401:            user_id: fixed_uuid(),
/Users/woominseong/Desktop/창업/crates/core/src/models.rs:405:        assert_eq!(bookmark.user_id, fixed_uuid());
/Users/woominseong/Desktop/창업/infra/migrations/20260321000005_application_status.sql:6:    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 exited 101 in 9.08s:
    Blocking waiting for file lock on package cache
    Blocking waiting for file lock on package cache
    Blocking waiting for file lock on package cache
   Compiling stable_deref_trait v1.2.1
   Compiling foldhash v0.2.0
   Compiling rand v0.8.5
   Compiling siphasher v1.0.2
   Compiling yoke v0.8.1
   Compiling crossbeam-utils v0.8.21
   Compiling ring v0.17.14
   Compiling concurrent-queue v2.5.0
   Compiling indexmap v2.13.0
   Compiling tokio-stream v0.1.18
   Compiling crossbeam-queue v0.3.12
   Compiling byteorder v1.5.0
   Compiling new_debug_unreachable v1.0.6
   Compiling mac v0.1.1
   Compiling precomputed-hash v0.1.1
   Compiling hashbrown v0.16.1
   Compiling zerovec v0.11.5
 succeeded in 9.21s:
    Blocking waiting for file lock on package cache
    Blocking waiting for file lock on package cache
    Blocking waiting for file lock on package cache
    Blocking waiting for file lock on build directory
warning: constant `EXPO_RECEIPTS_URL` is never used
  --> crates/worker/src/notifications/expo_push.rs:18:7
   |
18 | const EXPO_RECEIPTS_URL: &str = "https://exp.host/--/api/v2/push/getReceipts";
   |       ^^^^^^^^^^^^^^^^^
   |
   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default

warning: struct `ReceiptRequest` is never constructed
   --> crates/worker/src/notifications/expo_push.rs:107:8
    |
107 | struct ReceiptRequest {
    |        ^^^^^^^^^^^^^^

warning: struct `ReceiptResponse` is never constructed
   --> crates/worker/src/notifications/expo_push.rs:112:8
exec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/recommend.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "rg -n \"registerPushToken|unregisterPushToken|getNotificationPreferences|update_notification_preferences|alerts/preferences|dashboard\\?|my/saved|my/applications|programs/count|PATCH|/api/v1/programs/count|adminApi|getStats|triggerSync\" '/Users/woominseong/Desktop/창업/apps/mobile' '/Users/woominseong/Desktop/창업/apps/web/src'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/crates/api/tests/api_tests.rs'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '320,520p' '/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 419ms:
    })?;

    Ok(Json(program))
}

/// POST /api/v1/admin/programs/{id}/publish
pub async fn toggle_publish(
    _admin: AdminUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let program = sqlx::query_as::<_, Program>("SELECT * FROM programs WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
 succeeded in 431ms:
use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use majimi_core::models::{
    EligibilityRule, ProfileInput, Program, RecommendationItem, RecommendationResult, UserProfile,
};
use majimi_core::rule_engine;

/// POST /api/v1/recommend/preview
/// Returns recommendations based on profile input without requiring login.
pub async fn preview(
    State(pool): State<PgPool>,
    Json(input): Json<ProfileInput>,
) -> Result<Json<RecommendationResult>, (StatusCode, Json<Value>)> {
    let now = Utc::now();
    let current_year = now.format("%Y").to_string().parse::<i32>().unwrap_or(2026);
 succeeded in 421ms:
use reqwest::Client;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tokio::net::TcpListener;

const DATABASE_URL: &str = "postgres://wello:wello@localhost:5432/wello";

/// Starts the app on a random port, returns the base URL.
async fn start_test_server() -> String {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(DATABASE_URL)
        .await
        .expect("Failed to connect to test database");

    let app = api::build_app(pool);

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
 succeeded in 454ms:
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:119:    return request<{ count: number }>(`/api/v1/programs/count${qs}`);
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:123:    request<DashboardData>(`/api/v1/dashboard?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:126:    request<{ saved: SavedProgram[] }>(`/api/v1/my/saved?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:130:      `/api/v1/my/applications?user_id=${userId}`
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:148:    request<ApplicationItem>(`/api/v1/my/applications/${applicationId}`, {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:149:      method: "PATCH",
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:157:    request<void>("/api/v1/alerts/preferences", {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:253:export const adminApi = {
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:254:  getStats: () => request<AdminStats>("/api/v1/admin/stats"),
/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts:256:  triggerSync: () =>
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:146:/** GET /api/v1/dashboard?user_id=UUID response */
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:230:/** GET /api/v1/my/applications/{program_id}?user_id=UUID */
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:242:/** GET /api/v1/my/applications?user_id=UUID */
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:248:/** PUT /api/v1/my/applications/{program_id}?user_id=UUID response */
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:378:      () => request<DashboardData>(`/api/v1/dashboard?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:399:    request("/api/v1/alerts/preferences", {
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:426:   * GET /api/v1/my/applications?user_id=UUID
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:429:    request<ApplicationListResponse>(`/api/v1/my/applications?user_id=${userId}`),
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:435:   * GET /api/v1/my/applications/{programId}?user_id=UUID
/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts:443:        `/api/v1/my/applications/${programId}?user_id=${userId}`
exec
/bin/zsh -lc "rg -n \"21개|21 화면|21개 화면|21 screens|21\" '/Users/woominseong/Desktop/창업/docs' '/Users/woominseong/Desktop/창업/apps/mobile'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/docs/stitch-designs/onboarding.html'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "sed -n '1,260p' '/Users/woominseong/Desktop/창업/docs/stitch-designs/dashboard.html'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 379ms:
<!DOCTYPE html>

<html lang="ko"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Manrope:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-secondary-container": "#4f5f7f",
              "on-secondary": "#ffffff",
              "surface": "#f8f9fa",
              "secondary-container": "#cadaff",
              "primary-container": "#0070eb",
 succeeded in 379ms:
<!DOCTYPE html>

<html lang="ko"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Manrope:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-secondary-container": "#4f5f7f",
              "on-secondary": "#ffffff",
              "surface": "#f8f9fa",
              "secondary-container": "#cadaff",
              "primary-container": "#0070eb",
 succeeded in 397ms:
/Users/woominseong/Desktop/창업/apps/mobile/lib/pdf-generator.ts:70:  primaryLight: rgb(216 / 255, 226 / 255, 255 / 255), // #d8e2ff
/Users/woominseong/Desktop/창업/apps/mobile/package.json:48:    "react-native-web": "^0.21.0",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:44:        "react-native-web": "^0.21.0",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:281:      "integrity": "sha512-7fiA521aVw8lSPeI4ZOD3vRFkoqkJcS+z4hFo82bFSH/2tNd6eJ5qCVMS5OzDmZh/kaHQeBaeyxK6wljcPtveA==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:871:      "integrity": "sha512-G5eDKsu50udECw7DL2AcsysXiQyB7Nfg521t2OAJ4tbfTJ27doHLeF/vlI1NZGlLdbb/v+ibvtL1YBQqYOwJGg==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:1144:      "integrity": "sha512-ykDdF5yI4f1WrAolLqeF3hmYU12j9ntLQl/AOG1HAS21jxyg1Q0/J/tpREuYLfatGdGmXp/3yS0ZA76kOlVq9Q==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:1831:      "integrity": "sha512-+rP+/GieOzkt97hSJ0MrPOuAH/jpaS21ZDvL9DJ35QYRDlQcwzcvUlGUf79AnQxq/2NPiS/AULhhM4TKutIt8Q==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3079:      "integrity": "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3252:      "integrity": "sha512-0dbCC2aTjNW7MvG1fY7zeq6eYvmmaFCEnBDXPuMPJ8uKgfs9lFGXIQFIfBdmcBVX6vHhS+K213VCsuHSIv5jYw==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3509:      "version": "21.0.3",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3510:      "resolved": "https://registry.npmjs.org/@types/yargs-parser/-/yargs-parser-21.0.3.tgz",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3587:        "type-fest": "^0.21.3"
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3597:      "version": "0.21.3",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3598:      "resolved": "https://registry.npmjs.org/type-fest/-/type-fest-0.21.3.tgz",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3711:      "integrity": "sha512-Y1IQok9821cC9onCx5otgFfRm7Lm+I+wwxOx738M/WLPZ9Q42m4IG5W0FNX8WLL2gYMZo3JkuXIH2DOpWM+qwA==",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3788:      "version": "0.21.2",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3789:      "resolved": "https://registry.npmjs.org/babel-plugin-react-native-web/-/babel-plugin-react-native-web-0.21.2.tgz",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:3861:        "babel-plugin-react-native-web": "~0.21.0",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:4678:      "version": "1.5.321",
/Users/woominseong/Desktop/창업/apps/mobile/package-lock.json:4679:      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.321.tgz",
codex
컴파일/테스트도 병행 중입니다. 그 결과까지 포함해서 “설계상 문제”가 아니라 “지금 실제로 깨지는 지점”까지 확인하겠습니다.
exec
/bin/zsh -lc 'npm run build' in /Users/woominseong/Desktop/창업/apps/webexec
/bin/zsh -lc "cat '/Users/woominseong/Desktop/창업/apps/web/package.json'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/crates/worker/src/main.rs' | sed -n '1,180p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts' | sed -n '300,520p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/crates/api/src/lib.rs' | sed -n '70,170p'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 440ms:
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.67.0",
    "next": "16.2.1",
    "next-auth": "^4.24.13",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-grab": "^0.1.28",
    "zod": "^3.24.0",
    "zustand": "^5.0.0"
  },
 succeeded in 434ms:
   300	      (new Date(deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
   301	    );
   302	    if (days <= 0) return "마감";
   303	    if (days <= 30) return `D-${days}`;
   304	    return "신청 중";
   305	  }
   306	  return "신청 중";
   307	}
   308	
   309	// ---------------------------------------------------------------------------
   310	// Auth helpers
   311	// ---------------------------------------------------------------------------
   312	
   313	/**
   314	 * Returns the current user's ID from the Zustand auth store.
   315	 * Throws if no user is authenticated — callers must ensure the user is logged
   316	 * in before invoking any API method that requires a user ID.
   317	 */
   318	export function getCurrentUserId(): string {
   319	  const userId = useAuthStore.getState().userId;
 succeeded in 434ms:
     1	mod alerts;
     2	mod notifications;
     3	mod pipeline;
     4	mod sources;
     5	
     6	use sqlx::postgres::PgPoolOptions;
     7	use tokio_cron_scheduler::{Job, JobScheduler};
     8	use tracing_subscriber::EnvFilter;
     9	
    10	use majimi_core::AppConfig;
    11	
    12	use crate::notifications::NotificationDispatcher;
    13	use crate::sources::financial::FssFinancialSource;
    14	use crate::sources::gov_benefits::GovBenefitsSource;
    15	use crate::sources::local_scraper::LocalScraperSource;
    16	use crate::sources::scholarship::ScholarshipSource;
    17	use crate::sources::worknet::WorknetSource;
    18	use crate::sources::youth_center::YouthCenterSource;
    19	
    20	#[tokio::main]
 succeeded in 434ms:
    70	
    71	    let admin_governor_conf = std::sync::Arc::new(
    72	        GovernorConfigBuilder::default()
    73	            .per_second(2)
    74	            .burst_size(30)
    75	            .key_extractor(PeerIpKeyExtractor)
    76	            .finish()
    77	            .expect("admin rate-limiter config"),
    78	    );
    79	
    80	    let api_governor_conf = std::sync::Arc::new(
    81	        GovernorConfigBuilder::default()
    82	            .per_millisecond(600)
    83	            .burst_size(100)
    84	            .key_extractor(PeerIpKeyExtractor)
    85	            .finish()
    86	            .expect("api rate-limiter config"),
    87	    );
    88	
    89	    // ── Auth routes: strict limit (5/min per IP) ──
 succeeded in 8.73s:

> web@0.1.0 build
> next build

   ▲ Next.js 15.2.4
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/18) ...
   Generating static pages (4/18) 
   Generating static pages (8/18) 
   Generating static pages (13/18) 
 ✓ Generating static pages (18/18)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx' | sed -n '1,140p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx' | sed -n '570,600p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/store/auth.ts' | sed -n '1,140p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/programs/[id].tsx' | sed -n '1200,1240p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx' | sed -n '330,420p'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 445ms:
   570	                      </Text>
   571	                    </View>
   572	                  </View>
   573	                  <Text style={stepStyles.docIssuer}>
   574	                    {doc.issuer} · 약 {doc.daysNeeded}일 소요
   575	                  </Text>
   576	                </View>
   577	              </TouchableOpacity>
   578	
   579	              {/* Issue link for unprepared docs */}
   580	              {!isChecked && doc.issueUrl ? (
   581	                <View style={stepStyles.docIssueRow}>
   582	                  <Ionicons
   583	                    name="open-outline"
   584	                    size={14}
   585	                    color={colors.primary}
   586	                  />
   587	                  <Text style={stepStyles.docIssueLink}>지금 발급하기</Text>
   588	                </View>
   589	              ) : null}
 succeeded in 459ms:
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
 succeeded in 441ms:
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
 succeeded in 441ms:
   330	    >
   331	      {isOffline && <OfflineBanner />}
   332	
   333	      {/* Profile header */}
   334	      <View style={styles.profileHeader}>
   335	        <View style={styles.headerBlob} pointerEvents="none" />
   336	
   337	        {profileQuery.isLoading ? (
   338	          <ActivityIndicator color={colors.primary} />
   339	        ) : (
   340	          <>
   341	            <AvatarCircle initial={initial} />
   342	            <View style={styles.profileHeaderInfo}>
   343	              <View style={styles.profileNameRow}>
   344	                <Text style={styles.profileName}>
   345	                  {profile.school_name ?? "마지미 유저"}
   346	                </Text>
   347	                <RegionBadge region={region} />
   348	              </View>
   349	              <Text style={styles.profileSubtitle}>
 succeeded in 444ms:
  1200	    program.application_start_at,
  1201	    program.application_end_at,
  1202	    program.program_status
  1203	  );
  1204	  const programRegionLabel = regionLabel(program.region_scope, program.regions);
  1205	  const bottomBarHeight = 80 + (insets.bottom > 0 ? insets.bottom : spacing[4]);
  1206	
  1207	  async function handleBookmark() {
  1208	    if (bookmarkLoading) return;
  1209	    setBookmarkLoading(true);
  1210	    try {
  1211	      const result = await api.toggleBookmark(program!.id, USER_ID);
  1212	      setBookmarked(result.bookmarked);
  1213	    } catch {
  1214	      setBookmarked((v) => !v);
  1215	    } finally {
  1216	      setBookmarkLoading(false);
  1217	    }
  1218	  }
  1219	
exec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs' | sed -n '1,140p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/crates/api/src/routes/push.rs' | sed -n '1,120p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts' | sed -n '80,320p'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "ls -1 '/Users/woominseong/Desktop/창업/apps/web'" in /Users/woominseong/Desktop/창업/apps/mobileexec
/bin/zsh -lc "nl -ba '/Users/woominseong/Desktop/창업/infra/docker/Dockerfile.web' | sed -n '1,120p'" in /Users/woominseong/Desktop/창업/apps/mobile succeeded in 488ms:
     1	use axum::{
     2	    extract::{Query, State},
     3	    http::StatusCode,
     4	    Json,
     5	};
     6	use serde::Deserialize;
     7	use serde_json::{json, Value};
     8	use sqlx::PgPool;
     9	use uuid::Uuid;
    10	use majimi_core::models::{Program, UserProgramState};
    11	
    12	#[derive(Debug, Deserialize)]
    13	pub struct UserQuery {
    14	    pub user_id: Uuid,
    15	}
    16	
    17	/// GET /api/v1/my/saved?user_id=UUID
    18	/// Returns bookmarked programs with full program data.
    19	pub async fn get_saved(
    20	    State(pool): State<PgPool>,
 succeeded in 476ms:
     1	use axum::{extract::State, http::StatusCode, Json};
     2	use serde::Deserialize;
     3	use serde_json::{json, Value};
     4	
     5	use crate::{auth::AuthUser, AppState};
     6	
     7	// ── Request types ──
     8	
     9	#[derive(Debug, Deserialize)]
    10	pub struct RegisterPushTokenRequest {
    11	    pub token: String,
    12	    pub platform: String,
    13	}
    14	
    15	// ── Handlers ──
    16	
    17	/// POST /api/v1/push/register
    18	///
    19	/// Upserts an Expo push token for the authenticated user/device pair.
    20	/// The user's ID is taken from the JWT — no client-supplied user_id accepted.
 succeeded in 476ms:
    80	export interface TodoItem {
    81	  id: string;
    82	  label: string;
    83	  done: boolean;
    84	}
    85	
    86	export interface DashboardData {
    87	  estimatedMonthlyBenefit: number;
    88	  estimatedSemesterBenefit: number;
    89	  deadlineSoon: RecommendationResult[];
    90	  applying: ApplicationItem[];
    91	  saved: SavedProgram[];
    92	  todos: TodoItem[];
    93	}
    94	
    95	export const USER_ID = "00000000-0000-0000-0000-000000000001";
    96	
    97	export const api = {
    98	  getPrograms: (params?: { type?: string; region?: string }) => {
    99	    const query = new URLSearchParams();
 succeeded in 475ms:
     1	FROM node:20-alpine AS base
     2	RUN corepack enable && corepack prepare pnpm@latest --activate
     3	
     4	FROM base AS deps
     5	WORKDIR /app
     6	COPY apps/web/package.json apps/web/pnpm-lock.yaml* ./
     7	RUN pnpm install --frozen-lockfile
     8	
     9	FROM base AS builder
    10	WORKDIR /app
    11	COPY --from=deps /app/node_modules ./node_modules
    12	COPY apps/web/ ./
    13	RUN pnpm run build
    14	
    15	FROM base AS runner
    16	WORKDIR /app
    17	ENV NODE_ENV=production
    18	RUN addgroup --system --gid 1001 nodejs && \
    19	    adduser --system --uid 1001 nextjs
    20	COPY --from=builder /app/public ./public
 succeeded in 477ms:
next-env.d.ts
next.config.ts
node_modules
package-lock.json
package.json
postcss.config.mjs
public
src
tsconfig.json
tsconfig.tsbuildinfo
context compacted
codex
**핵심 발견사항**

1. 관리자 웹과 백엔드 API 계약이 여러 곳에서 깨져 있어서, 대시보드/내 정보/신청 상태 화면은 실서버에 붙이면 정상 동작하지 않을 가능성이 높습니다. 웹은 응답을 `{ programs }`, `{ saved }`, `{ applications }` 같은 형태로 기대하지만, 백엔드는 대부분 `{ items, total, ... }`를 반환합니다. `PATCH`로 보내는 신청 상태 수정도 백엔드는 `PUT`만 받습니다. 인증 헤더도 웹 API 클라이언트에서 전혀 붙이지 않아 admin 라우트는 기본적으로 401/403입니다. 관련 파일: [apps/web/src/lib/api.ts](/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts), [crates/api/src/lib.rs](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs), [crates/api/src/routes/dashboard.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/dashboard.rs), [crates/api/src/routes/my.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs), [crates/api/src/routes/state.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/state.rs)

2. Worker는 문서상 “7개 소스”가 아니라 현재 코드상 6개 소스만 실제 호출합니다. 스케줄 루프와 `sources/mod.rs` 기준으로 `YouthCenter`, `GovBenefits`, `Worknet`, `Scholarship`, `LocalScraper`, `FssFinancial`만 실행됩니다. 7번째 소스가 빠졌거나 문서가 과장된 상태입니다. 관련 파일: [crates/worker/src/main.rs](/Users/woominseong/Desktop/창업/crates/worker/src/main.rs), [crates/worker/src/sources/mod.rs](/Users/woominseong/Desktop/창업/crates/worker/src/sources/mod.rs)

3. RLS는 SQL 정책은 들어가 있지만, 애플리케이션이 요청별 사용자 ID를 DB 세션에 주입하지 않아 실효성이 약합니다. 현재 정책은 service role에는 광범위 허용이고, 코드에서는 `app.current_user_id`를 세팅하는 흐름을 찾지 못했습니다. 즉 “RLS 추가” 자체는 되었지만, 런타임에서 per-request 강제가 연결되지 않았습니다. 관련 파일: [infra/migrations/20260322000001_rls_policies.sql](/Users/woominseong/Desktop/창업/infra/migrations/20260322000001_rls_policies.sql)

4. 배포/CI 경로가 실제 저장소 상태와 어긋납니다. 웹 앱은 `package-lock.json`만 있는데 Dockerfile과 GitHub Actions는 `pnpm-lock.yaml`을 전제로 작성돼 있습니다. 로컬 `npm run build`는 성공했지만, 컨테이너 빌드와 CI 캐시/설정은 깨질 수 있습니다. 관련 파일: [apps/web/package-lock.json](/Users/woominseong/Desktop/창업/apps/web/package-lock.json), [infra/docker/Dockerfile.web](/Users/woominseong/Desktop/창업/infra/docker/Dockerfile.web), [.github/workflows/ci.yml](/Users/woominseong/Desktop/창업/.github/workflows/ci.yml)

5. DB 마이그레이션 순서는 대체로 정상인데, 초기 확장에서 `uuid-ossp`만 켜고 실제 코드에서는 `gen_random_uuid()`를 사용합니다. `pgcrypto`가 따로 보장되지 않으면 관리자에서 프로그램 생성 시 런타임 실패 가능성이 있습니다. 관련 파일: [infra/migrations/20260320000001_init.sql](/Users/woominseong/Desktop/창업/infra/migrations/20260320000001_init.sql), [crates/api/src/routes/admin.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/admin.rs)

6. 모바일 내비게이션에는 실제로 연결이 빠진 화면이 있습니다. `preview`는 스택에는 등록돼 있지만 들어가는 링크를 찾지 못했습니다. `apply-assistant`의 “지금 발급하기”, 프로필의 “프로필 편집”은 UI만 있고 `onPress` 연결이 없습니다. 관련 파일: [apps/mobile/app/_layout.tsx](/Users/woominseong/Desktop/창업/apps/mobile/app/_layout.tsx), [apps/mobile/app/apply-assistant.tsx](/Users/woominseong/Desktop/창업/apps/mobile/app/apply-assistant.tsx), [apps/mobile/app/(tabs)/profile.tsx](/Users/woominseong/Desktop/창업/apps/mobile/app/(tabs)/profile.tsx)

7. “21개 화면” 기준과 실제 라우트 파일 수가 맞지 않습니다. `_layout` 제외 기준으로 확인된 화면은 19개였습니다. 요구사항 문서와 구현 수가 어긋난 상태라면, 검토 기준부터 다시 맞춰야 합니다. 관련 경로: [apps/mobile/app](/Users/woominseong/Desktop/창업/apps/mobile/app)

8. 백엔드에는 등록되지 않은 핸들러가 있습니다. `routes/my.rs`의 `get_applications`는 구현돼 있지만 라우터에서는 사용되지 않고, 실제 `/my/applications`는 `routes::state::list_applications`에 연결돼 있습니다. `payment.rs`는 모듈만 있고 실핸들러/라우팅이 없습니다. 관련 파일: [crates/api/src/routes/my.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/my.rs), [crates/api/src/lib.rs](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs), [crates/api/src/routes/payment.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/payment.rs)

9. 모바일/웹 클라이언트는 보안 수정 이후 백엔드 계약을 따라가지 못하고 있습니다. 많은 요청이 여전히 `user_id`를 보내는데, 서버는 JWT 기반 사용자만 신뢰합니다. 특히 푸시 토큰 등록은 모바일이 `{ user_id, token }`를 보내지만 서버는 `{ token, platform }`를 기대합니다. IDOR 자체는 서버 쪽에서 상당 부분 막혔지만, 클라이언트는 낡은 계약 위에 있습니다. 관련 파일: [apps/mobile/lib/api.ts](/Users/woominseong/Desktop/창업/apps/mobile/lib/api.ts), [apps/web/src/lib/api.ts](/Users/woominseong/Desktop/창업/apps/web/src/lib/api.ts), [crates/api/src/routes/push.rs](/Users/woominseong/Desktop/창업/crates/api/src/routes/push.rs)

10. CORS는 최소 허용만 들어가 있어 웹 운영엔 괜찮을 수 있지만, 모바일 개발 환경/Expo 계열 origin까지 고려한 설정으로 보이진 않습니다. 프로덕션 도메인과 로컬호스트 외 사용 시 확인이 필요합니다. 관련 파일: [crates/api/src/lib.rs](/Users/woominseong/Desktop/창업/crates/api/src/lib.rs)

**검증 결과**

- `cargo check --workspace`: 성공
- `npm run build` (`apps/web`): 성공
- `cargo test --workspace`: 실패. 테스트 픽스처가 `Program` 구조체 변경을 따라가지 못했습니다. 관련 파일: [crates/core/src/rule_engine.rs](/Users/woominseong/Desktop/창업/crates/core/src/rule_engine.rs)

**요청하신 7개 항목별 결론**

1. 모바일 21개 화면 네비게이션: 빠진 연결 있음. 특히 `preview`, 발급 CTA, 프로필 편집 CTA.
2. 백엔드 라우터 미등록 핸들러: 있음. `my::get_applications`, 사실상 비어 있는 `payment`.
3. DB 마이그레이션 순서 충돌: 큰 순서 충돌은 안 보였지만 `gen_random_uuid()`/extension 불일치 위험 존재.
4. Worker 7개 소스 호출: 아니고 현재 6개만 확인됨.
5. 관리자 대시보드와 백엔드 API 매칭: 다수 불일치.
6. 배포 스크립트/설정: 웹 패키지 매니저 설정 불일치로 정상 보장 어려움.
7. 보안 수정(IDOR, CORS, RLS): IDOR은 서버 쪽 상당 부분 반영, CORS는 범위 제한적, RLS는 정책만 있고 런타임 연결이 부족.

원하시면 다음 단계로 바로 이어서 할 수 있습니다:  
1. 이 이슈들을 `치명적/높음/중간` 우선순위로 재정렬한 수정 체크리스트 작성  
2. 실제 수정 패치 적용  
3. 수정 후 재검증까지 진행
tokens used
412,446

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
