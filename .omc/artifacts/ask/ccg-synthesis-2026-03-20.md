# CCG 트라이-모델 합성 리포트: 구현 명세 검증 & 고도화

> **작성일**: 2026-03-20
> **분석 소스**: Claude (Opus 4.6) + Codex (GPT 5.4) + Gemini — CCG 트라이-모델 합성
> **대상 문서**: 구현.md, 웰로2.md, 웰로.md
> **한줄 요약**: 전체 설계는 기술적으로 성립 가능. Supabase 도입 + 카톡 알림톡 MVP 필수화 + 온보딩/인증 UX 개선 + DB 버저닝으로 12주 MVP 실현 가능.

---

## 3모델 판정 종합

### 기술/아키텍처 (Codex + Claude)

| # | 항목 | 판정 | 핵심 개선 |
|---|------|------|----------|
| 1 | Rust + Axum | 조건부 | 추천/룰엔진/워커만 Rust. 인증/스토리지는 Supabase 위임 |
| 2 | JSON DSL 룰 엔진 | 조건부 | 제한된 6필드 스키마 + explain trace |
| 3 | 추천 4단계 파이프라인 | 적합 | 템플릿 기반 설명 우선 |
| 4 | 데이터 파이프라인 | 적합 | human-in-the-loop 유지 |
| 5 | DB 스키마 | 조건부 | 6테이블 추가 (버저닝+분리+반정규화) |
| 6 | monorepo 구조 | 적합 | crate 3개로 단순화 (api/worker/core) |
| 7 | 보안 | 조건부 | rotating refresh + audit log + rate limiting |
| 8 | 12주 타임라인 | 조건부 | Supabase로 인증/스토리지 부담 해소 |

### UX/제품 (Gemini + Claude)

| # | 항목 | 판정 | 핵심 개선 |
|---|------|------|----------|
| 9 | 온보딩 5문항 | 개선필요 | 2문항→즉시보상→3문항 단계 분리 |
| 10 | 홈 화면 | 적합 | 체크리스트 위젯 + 게임화 |
| 11 | 추천 카드 | 개선필요 | 정보 2계층화 (금액+D-Day / 이유+조건) |
| 12 | 인증 (매직링크) | 재고필요 | 매직링크 삭제 → 카카오 1-Tap |
| 13 | 알림 D-7/3/1 | 적합 | 금액 기반 메시지 개인화 |
| 14 | 경쟁 차별화 | 적합 | 서류관리+자격판별이 엣지 |
| 15 | 부산·대구 타겟 | 적합 | 로컬 아이덴티티 UX 반영 |
| 16 | MVP 우선순위 | 개선필요 | AI 대화형 2차 이동 |

---

## 충돌 해소

| 포인트 | Codex | Gemini | Claude 판정 |
|--------|-------|--------|------------|
| Rust 유지 여부 | "비숙련이면 Go/NestJS" | 미언급 | **Rust 유지** — Supabase가 인증/스토리지 담당하므로 Rust 부담 대폭 감소 |
| 매직링크 | 미언급 | "재고필요" | **동의** — 카카오 1-Tap으로 변경 |
| AI 대화형 MVP 포함 | 미언급 | "MVP 제외" | **동의** — 데이터 신뢰도 확보 후 2차 |
| 룰 엔진 범위 | "제한된 AST" | 미언급 | **동의** — 6필드 제한 스키마로 시작 |
| 알림 채널 | "1채널만 먼저" | "개인화 핵심" | **사용자 판단 존중** — 카톡+앱푸시 MVP 필수 |
| DB/인증 인프라 | "Rust 직접 구현" | 미언급 | **Supabase 도입** — 12주 안에 끝내려면 인프라 위임 필수 |

---

## 사용자 피드백 반영

| 피드백 | 반영 내용 |
|--------|----------|
| "카톡이나 앱 푸시는 필수" | 알림 채널 우선순위 변경: 카카오 알림톡+앱푸시가 MVP 필수 |
| "Supabase로 해야할 거 같은데" | 스택 전면 재구성: 인증/DB/스토리지/실시간을 Supabase에 위임 |

---

## 구현.md 적용 완료 변경점

### 적용됨 (구현.md에 반영 완료)

- [x] 스택: Supabase 도입 (Auth+DB+Storage+Realtime)
- [x] 스택: 카카오 알림톡 + 앱 푸시 MVP 필수화
- [x] 온보딩: 2→3단계 분리 + 소득구간 건너뛰기
- [x] 인증: 매직링크 삭제 → 카카오 1-Tap
- [x] DB: 6개 테이블 추가 (profile_versions, program_versions, ingestion_items, alert_subscriptions, alert_deliveries, normalization_errors)
- [x] DB: programs 반정규화 (min_age, max_age, regions, deadline_at, is_active)
- [x] 추천카드: 정보 2계층화 (금액+D-Day / 이유+조건)
- [x] 추천설명: 템플릿 우선 + LLM은 다듬기만
- [x] 룰엔진: explain trace 추가
- [x] 보안: rotating refresh, audit log, rate limiting, HSTS, 보안 헤더
- [x] 레포: crates/domain+infra → crates/core 합침
- [x] 레포: apps/admin 삭제 → web 내부 /admin route
- [x] Docker: Supabase 반영, MinIO 제거
- [x] MVP 제외: AI 대화형, 다채널 알림(이메일은 보조)

### 미적용 (추후 논의 필요)

- [ ] 12주 로드맵 주차별 산출물 재조정 (Supabase 기준)
- [ ] 카카오 비즈메시지 API 연동 상세 설계
- [ ] FCM/Web Push 설정 상세
- [ ] Supabase + Axum 인증 토큰 검증 흐름 상세
- [ ] OpenAPI/JSON Schema 기반 프론트-백 계약 관리
- [ ] 환경변수 예시 Supabase 기준 업데이트

---

## 최종 아키텍처 (합성 결과)

```
사용자 (PWA)
  ↓
Next.js 15 (apps/web)
  ├── Supabase Auth → 카카오 1-Tap 로그인
  ├── Supabase Realtime → 인앱 알림
  └── Rust Axum API (crates/api)
        ├── 추천 엔진 (하드필터→룰매칭→스코어링→설명생성)
        ├── 룰 엔진 (제한된 DSL + explain trace)
        ├── Supabase PostgreSQL (SQLx)
        ├── Redis (캐시/세션)
        ├── 카카오 비즈메시지 API (알림톡)
        └── FCM (앱 푸시)

Rust Worker (crates/worker)
  ├── 공공 API 동기화
  ├── 정규화 파이프라인
  ├── 해시 기반 변경 감지
  ├── 알림 스케줄 생성
  └── tokio-cron-scheduler
```

---

## 출처

### Codex 아티팩트
- `.omc/artifacts/ask/codex-frontend-next-js-15-typescript-tailwind-shadcn-ui-tanstack-q-2026-03-20T08-29-32-531Z.md`

### Gemini 아티팩트
- `.omc/artifacts/ask/gemini-ux-19-29-1-ai-2-xx-3-4-5-1-5-2-7-2-28-3-ux-4-3-5-d-7-d-3-d-1-2026-03-20T08-30-04-800Z.md`
