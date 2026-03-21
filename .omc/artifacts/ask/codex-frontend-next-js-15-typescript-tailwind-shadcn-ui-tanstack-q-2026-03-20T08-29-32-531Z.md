# codex advisor artifact

- Provider: codex
- Exit code: 0
- Created at: 2026-03-20T08:29:32.533Z

## Original task

다음은 청년 정책/장학금 추천 플랫폼의 구현 명세서다. 아키텍처와 기술적 관점에서 검증해줘.

## 핵심 스택
- Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand
- Backend: Rust + Axum
- DB: PostgreSQL 16 + SQLx
- Cache: Redis 7
- Worker: Rust + tokio-cron-scheduler
- Deploy: Docker Compose + Caddy
- AI: Provider adapter pattern (trait AiProvider)

## 검증 요청 사항

1. **Rust + Axum 백엔드 선택**: 이 규모의 MVP(12주)에서 Rust가 적합한가? 개발 속도 vs 성능 트레이드오프 분석
2. **룰 엔진 설계**: eligibility_rules를 JSON DSL로 저장하고 Rust에서 평가하는 구조가 확장성/유지보수 면에서 적합한가?
3. **추천 엔진**: 하드필터→룰매칭→스코어링→설명생성 4단계 파이프라인의 기술적 완성도
4. **데이터 파이프라인**: 공공API→원문저장→hash비교→정규화→룰추출→검수→게시 흐름의 견고성
5. **DB 스키마**: users, user_profiles, programs, eligibility_rules, user_program_states, alerts, ingestion_runs 구조의 문제점
6. **monorepo 구조**: apps/web + crates/api,worker,domain,infra + packages/ui,config 구조의 장단점
7. **보안**: JWT + argon2, HTTPS 강제, 민감필드 암호화 전략의 충분성
8. **12주 타임라인**: 이 스택과 기능 범위로 12주 내 MVP 가능한가? 병목 예측

각 항목에 대해 '적합/조건부/부적합' 판정과 구체적 개선안을 제시해줘. 특히 초기 스타트업의 현실적 제약을 고려해서 답해줘.

## Final prompt

다음은 청년 정책/장학금 추천 플랫폼의 구현 명세서다. 아키텍처와 기술적 관점에서 검증해줘.

## 핵심 스택
- Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand
- Backend: Rust + Axum
- DB: PostgreSQL 16 + SQLx
- Cache: Redis 7
- Worker: Rust + tokio-cron-scheduler
- Deploy: Docker Compose + Caddy
- AI: Provider adapter pattern (trait AiProvider)

## 검증 요청 사항

1. **Rust + Axum 백엔드 선택**: 이 규모의 MVP(12주)에서 Rust가 적합한가? 개발 속도 vs 성능 트레이드오프 분석
2. **룰 엔진 설계**: eligibility_rules를 JSON DSL로 저장하고 Rust에서 평가하는 구조가 확장성/유지보수 면에서 적합한가?
3. **추천 엔진**: 하드필터→룰매칭→스코어링→설명생성 4단계 파이프라인의 기술적 완성도
4. **데이터 파이프라인**: 공공API→원문저장→hash비교→정규화→룰추출→검수→게시 흐름의 견고성
5. **DB 스키마**: users, user_profiles, programs, eligibility_rules, user_program_states, alerts, ingestion_runs 구조의 문제점
6. **monorepo 구조**: apps/web + crates/api,worker,domain,infra + packages/ui,config 구조의 장단점
7. **보안**: JWT + argon2, HTTPS 강제, 민감필드 암호화 전략의 충분성
8. **12주 타임라인**: 이 스택과 기능 범위로 12주 내 MVP 가능한가? 병목 예측

각 항목에 대해 '적합/조건부/부적합' 판정과 구체적 개선안을 제시해줘. 특히 초기 스타트업의 현실적 제약을 고려해서 답해줘.

## Raw output

```text
아키텍처 관점에서 보면 전체 설계는 꽤 정돈되어 있습니다. 다만 “초기 스타트업 + 12주 MVP”라는 제약을 기준으로 보면, 몇몇 선택은 기술적으로 좋더라도 일정 리스크가 큽니다. 결론부터 말하면, 전체 판정은 “기술적으로 성립 가능하지만, Rust 중심 설계와 DSL 룰 엔진이 가장 큰 일정 병목”입니다.

**1. Rust + Axum 백엔드 선택: `조건부`**  
기술적으로는 적합합니다. Axum, SQLx, tokio 기반 조합은 안정적이고, 정책 추천처럼 읽기 중심 트래픽에도 잘 맞습니다. 타입 안정성, 동시성 안전성, 배포 후 장애율 측면에서는 장점이 분명합니다.  
문제는 MVP 12주에서의 개발 속도입니다. 특히 인증, 관리자 기능, 데이터 파이프라인, 룰 평가기, 추천 로직, 크론 워커까지 전부 Rust로 밀어붙이면 “성능은 충분한데 기능 출시가 늦는” 상황이 나올 가능성이 큽니다.

개선안:
- 팀에 Rust 숙련자가 1명 이상 있고 백엔드 복잡도가 높다면 유지 가능
- Rust 숙련도가 낮다면, 최소한 초기 범위 축소가 필요
- 반드시 Rust를 쓸 거면 “성능”이 아니라 “도메인 안정성” 중심으로 선택해야 함
- MVP 단계에서는 Axum + SQLx + Redis까지만 고정하고, AI 설명 생성/복잡한 ETL은 단순화하는 편이 현실적
- Admin CMS, 검수 툴, 운영 백오피스는 Rust로 직접 만들기보다 Next.js 내부 admin route로 처리하는 게 빠름

현실 판단:
- Rust 숙련팀: 가능
- 비숙련팀: 일정 리스크 큼. 이 경우는 Go/NestJS가 더 현실적일 수 있음

**2. 룰 엔진 설계: eligibility_rules JSON DSL + Rust 평가기: `조건부`**  
방향 자체는 맞습니다. 정책/장학금 도메인은 조건이 자주 바뀌고, 운영자가 조건을 수정해야 하므로 DB 저장형 룰은 필요합니다. 코드 하드코딩보다 훨씬 낫습니다.  
하지만 JSON DSL을 처음부터 범용 언어처럼 만들면 거의 확실히 과설계됩니다. 연산자, 중첩, 날짜 기준, 예외 조건, 지역/소득/학년 조합이 늘어나면서 디버깅과 검수 난도가 급격히 올라갑니다.

개선안:
- “범용 DSL”이 아니라 “제한된 조건 스키마”로 시작
- 예: `age`, `region`, `income_bracket`, `school_status`, `major`, `employment_status` 정도만 1차 지원
- Boolean AST 정도로만 설계: `all/any/not + field/op/value`
- 룰 버전 관리 필수: `rule_version`, `compiled_at`, `created_by`, `reviewed_by`
- 평가 결과에 explain trace 저장: 어떤 rule node가 통과/실패했는지 남겨야 운영 가능
- 룰 테스트 fixture를 두고 회귀 테스트 자동화 필요
- JSONB 저장은 괜찮지만, “자주 조회하는 공통 eligibility facet”는 별도 컬럼으로 중복 저장하는 것이 좋음

권장 방향:
- 1단계: 구조화된 제한 DSL
- 2단계: 필요 시 rule compiler / admin rule builder 추가
- 처음부터 자유형 DSL은 피하는 게 맞음

**3. 추천 엔진 4단계 파이프라인: `적합`**  
`하드필터 → 룰매칭 → 스코어링 → 설명생성`은 매우 합리적입니다. 이 순서는 성능, 설명 가능성, 운영 안정성 측면에서 좋습니다. 특히 공공정책 추천은 “왜 추천됐는지”가 중요해서 설명 생성 단계가 분리된 점이 좋습니다.  
다만 MVP에서 주의할 점은 스코어링과 설명 생성이 너무 복잡해지면 운영 불가능해진다는 것입니다.

개선안:
- 하드필터는 SQL 레벨에서 최대한 처리
- 룰매칭은 Rust evaluator에서 처리하되 결과 trace 반환
- 스코어링은 ML 없이 규칙 기반 weighted scoring으로 시작
- 설명 생성은 LLM 자유생성보다 템플릿 기반 우선
- AI는 “설명 문장 다듬기” 정도로 제한하는 것이 안전
- 추천 결과 캐시 키는 `user_profile_version + program_version + rule_version` 기반으로 설계

추가로 필요한 것:
- 추천 사유와 탈락 사유 모두 저장
- 추천 결과 snapshot 저장
- 재현 가능성 보장: 같은 입력이면 같은 결과가 나오게 해야 함

**4. 데이터 파이프라인: 공공API→원문저장→hash비교→정규화→룰추출→검수→게시: `적합`**  
이 흐름은 꽤 견고합니다. 특히 원문 저장, hash 비교, 검수 단계를 넣은 건 맞는 방향입니다. 정책 데이터는 품질이 들쭉날쭉해서 “자동 게시”는 위험합니다.  
다만 실제 병목은 기술보다 운영입니다. 공공 API 스키마 변경, 누락 필드, 중복 데이터, 공고 종료일 해석 오류가 더 큰 문제입니다.

개선안:
- 원문(raw payload) 불변 저장 필수
- source_id + fetched_at + content_hash + parser_version 저장
- hash 비교는 payload 전체 hash 외에 “핵심 필드 canonical hash”도 별도 저장 추천
- 정규화 실패/부분실패 상태를 분리
- 룰추출은 자동화하더라도 human-in-the-loop 유지
- 게시 전 검수 체크리스트를 구조화해야 함: 마감일, 지역, 연령, 소득, 중복 여부

추가 권장 테이블/필드:
- `source_documents`
- `normalization_errors`
- `program_versions`
- `review_tasks`

핵심 리스크:
- “룰추출 자동화” 정확도 과신
- 정책 텍스트 해석 ambiguity
- 마감일/상시모집/예산소진 시 종료 같은 예외 처리

**5. DB 스키마: `조건부`**  
나열된 엔티티 자체는 맞습니다. 다만 지금 구조만으로는 운영/이력/재현성 요구를 다 받기 어렵습니다.

우려점:
- `user_profiles`가 단일 현재 상태만 가지면 추천 재현이 어려움
- `programs`와 `eligibility_rules`가 변경 이력 없이 덮어쓰기되면 문제
- `user_program_states`가 너무 많은 책임을 가질 수 있음
- `alerts`는 발송 로그와 구독 설정이 분리되어야 함
- `ingestion_runs`만으로는 개별 source item 추적이 부족함

개선안:
- `user_profile_versions` 또는 profile snapshot 개념 추가
- `programs`는 current row + `program_versions` 분리 권장
- `eligibility_rules`도 versioned entity로 관리
- `user_program_states`는 의미를 좁혀야 함
  - 예: bookmarked, dismissed, applied, clicked, recommended_at
- `alerts`를 분리
  - `alert_subscriptions`
  - `alert_deliveries`
- ingestion 계층 분리
  - `ingestion_runs`
  - `ingestion_items`
  - `source_documents`

또 하나 중요:
- 공통 facet 컬럼을 `programs`에 일부 반정규화해야 검색/필터 성능이 좋아짐
- 예: `min_age`, `max_age`, `regions`, `deadline_at`, `program_type`, `is_active`

**6. monorepo 구조: apps/web + crates/api,worker,domain,infra + packages/ui,config: `적합`**  
구조는 괜찮습니다. 웹과 Rust 백엔드, 공유 UI/config를 분리하는 의도도 명확합니다.  
다만 `domain`, `infra` 분리는 초기에 과도하게 엄격하면 오히려 속도를 늦춥니다. 작은 팀에서는 “깔끔한 레이어링”보다 “변경 비용이 낮은 구조”가 더 중요합니다.

장점:
- 배포/버전 관리 단순
- 프론트/백 간 계약 관리 쉬움
- 공용 타입/설정 재사용 가능
- Rust crate 단위로 책임 분리 가능

단점:
- 초기에 crate가 너무 잘게 쪼개지면 생산성 저하
- TS/ Rust 빌드 체인 동시 관리 부담
- CI 설정이 복잡해질 수 있음

개선안:
- Rust는 초기에 `api`, `worker`, `core` 정도만 두는 게 현실적
- `domain`, `infra`를 별도 crate로 강제하지 말고 필요할 때 분리
- OpenAPI 또는 JSON Schema를 기준으로 프론트-백 계약 관리
- `packages/config`는 좋지만 너무 많은 공유 추상화는 피할 것

**7. 보안: JWT + argon2, HTTPS 강제, 민감필드 암호화 전략: `조건부`**  
기본선은 맞습니다. 그런데 이것만으로 충분하다고 보기 어렵습니다. 특히 장학금/정책 추천은 소득, 연령, 지역, 학적 등 민감도가 높은 데이터를 다룰 수 있습니다.

보완 필요:
- JWT는 access token 짧게, refresh token은 회전(rotating) 전략
- 가능하면 refresh token은 DB 저장 및 폐기 가능해야 함
- 민감필드 암호화는 “무엇을 암호화할지”를 명확히 해야 함
- 검색/필터에 필요한 필드는 전부 암호화하면 운영이 불편함

권장:
- 비밀번호: `argon2id`
- 전송 구간: HTTPS only + HSTS
- 저장 구간:
  - 주민번호 같은 고위험 정보는 수집 자체를 피함
  - 소득구간, 학적상태처럼 추천용 최소 정보만 저장
  - 전화번호, 이메일은 field-level encryption 고려
- 키 관리는 env 파일 수준을 넘어서야 함. 최소한 키 분리 필요
- 관리자 액션 audit log 필수
- rate limiting, login throttling, email verification 필요
- Caddy 앞단에서도 보안 헤더 설정 필요

핵심 판단:
- 현재 제안은 “출발선”으로는 괜찮지만 “충분성”으로는 부족함

**8. 12주 타임라인: `조건부`**  
범위를 잘 자르면 가능합니다. 지금 명세를 그대로 다 구현하면 빡빡합니다. 가장 위험한 영역은 다음 4개입니다.

병목 예측:
- Rust 기반 도메인/인증/운영툴 전부 구현
- JSON DSL 룰 엔진 설계 및 디버깅
- 공공데이터 정규화와 검수 플로우
- 추천 설명 생성 품질 확보

현실적인 12주 MVP 조건:
- 데이터 소스 수 제한
- 지원 정책 유형 제한
- 룰 DSL 범위 축소
- 설명 생성은 템플릿 우선
- 관리자 검수 도구는 최소 기능만
- 알림 채널 1개만 먼저

추천 범위:
- 1차 MVP: 회원가입, 프로필 입력, 정책 목록, 기본 필터, 추천 Top N, 북마크, 마감 알림 1종
- 제외 또는 축소: 복잡한 AI 추천, 범용 DSL 빌더, 다채널 알림, 고급 운영 대시보드

현실 일정 예시:
1. 1-2주: 스키마, 인증, 기본 API, 웹 골격
2. 3-4주: 정책 수집/정규화 1차, 목록/검색
3. 5-6주: 프로필 기반 하드필터 + 룰매칭
4. 7-8주: 추천 결과/설명, 북마크/상태 관리
5. 9-10주: 검수 플로우, 알림, 캐시
6. 11-12주: 운영 안정화, 테스트, 배포

**최종 판정**
- 1. Rust + Axum: `조건부`
- 2. JSON DSL 룰 엔진: `조건부`
- 3. 추천 4단계 파이프라인: `적합`
- 4. 데이터 파이프라인: `적합`
- 5. DB 스키마: `조건부`
- 6. monorepo 구조: `적합`
- 7. 보안: `조건부`
- 8. 12주 MVP: `조건부`

**가장 중요한 개선 5개**
- Rust는 유지하되 기능 범위를 줄여서 일정 리스크를 관리할 것
- 룰 엔진은 범용 DSL이 아니라 제한된 AST 기반으로 시작할 것
- 프로그램/룰/프로필 모두 버저닝 또는 snapshot을 넣어 재현성을 확보할 것
- 추천 설명은 AI 자유생성보다 템플릿 기반으로 먼저 출시할 것
- ingestion/검수/게시 이력 추적 테이블을 더 세분화할 것

원하면 다음 단계로 이어서 해줄 수 있습니다.  
1. 이 명세를 바탕으로 “MVP 기준 아키텍처 수정안” 작성  
2. Rust/Axum 기준 DB 스키마 초안 리뷰  
3. 12주 개발 로드맵을 주차별 산출물 기준으로 재구성


OpenAI Codex v0.115.0 (research preview)
--------
workdir: /Users/woominseong/Desktop/창업
model: gpt-5.4
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: none
reasoning summaries: none
session id: 019d0a5c-17d7-7f20-b6c8-92526061fdaf
--------
user
다음은 청년 정책/장학금 추천 플랫폼의 구현 명세서다. 아키텍처와 기술적 관점에서 검증해줘.

## 핵심 스택
- Frontend: Next.js 15 + TypeScript + Tailwind + shadcn/ui + TanStack Query + Zustand
- Backend: Rust + Axum
- DB: PostgreSQL 16 + SQLx
- Cache: Redis 7
- Worker: Rust + tokio-cron-scheduler
- Deploy: Docker Compose + Caddy
- AI: Provider adapter pattern (trait AiProvider)

## 검증 요청 사항

1. **Rust + Axum 백엔드 선택**: 이 규모의 MVP(12주)에서 Rust가 적합한가? 개발 속도 vs 성능 트레이드오프 분석
2. **룰 엔진 설계**: eligibility_rules를 JSON DSL로 저장하고 Rust에서 평가하는 구조가 확장성/유지보수 면에서 적합한가?
3. **추천 엔진**: 하드필터→룰매칭→스코어링→설명생성 4단계 파이프라인의 기술적 완성도
4. **데이터 파이프라인**: 공공API→원문저장→hash비교→정규화→룰추출→검수→게시 흐름의 견고성
5. **DB 스키마**: users, user_profiles, programs, eligibility_rules, user_program_states, alerts, ingestion_runs 구조의 문제점
6. **monorepo 구조**: apps/web + crates/api,worker,domain,infra + packages/ui,config 구조의 장단점
7. **보안**: JWT + argon2, HTTPS 강제, 민감필드 암호화 전략의 충분성
8. **12주 타임라인**: 이 스택과 기능 범위로 12주 내 MVP 가능한가? 병목 예측

각 항목에 대해 '적합/조건부/부적합' 판정과 구체적 개선안을 제시해줘. 특히 초기 스타트업의 현실적 제약을 고려해서 답해줘.
mcp startup: no servers
codex
아키텍처 관점에서 보면 전체 설계는 꽤 정돈되어 있습니다. 다만 “초기 스타트업 + 12주 MVP”라는 제약을 기준으로 보면, 몇몇 선택은 기술적으로 좋더라도 일정 리스크가 큽니다. 결론부터 말하면, 전체 판정은 “기술적으로 성립 가능하지만, Rust 중심 설계와 DSL 룰 엔진이 가장 큰 일정 병목”입니다.

**1. Rust + Axum 백엔드 선택: `조건부`**  
기술적으로는 적합합니다. Axum, SQLx, tokio 기반 조합은 안정적이고, 정책 추천처럼 읽기 중심 트래픽에도 잘 맞습니다. 타입 안정성, 동시성 안전성, 배포 후 장애율 측면에서는 장점이 분명합니다.  
문제는 MVP 12주에서의 개발 속도입니다. 특히 인증, 관리자 기능, 데이터 파이프라인, 룰 평가기, 추천 로직, 크론 워커까지 전부 Rust로 밀어붙이면 “성능은 충분한데 기능 출시가 늦는” 상황이 나올 가능성이 큽니다.

개선안:
- 팀에 Rust 숙련자가 1명 이상 있고 백엔드 복잡도가 높다면 유지 가능
- Rust 숙련도가 낮다면, 최소한 초기 범위 축소가 필요
- 반드시 Rust를 쓸 거면 “성능”이 아니라 “도메인 안정성” 중심으로 선택해야 함
- MVP 단계에서는 Axum + SQLx + Redis까지만 고정하고, AI 설명 생성/복잡한 ETL은 단순화하는 편이 현실적
- Admin CMS, 검수 툴, 운영 백오피스는 Rust로 직접 만들기보다 Next.js 내부 admin route로 처리하는 게 빠름

현실 판단:
- Rust 숙련팀: 가능
- 비숙련팀: 일정 리스크 큼. 이 경우는 Go/NestJS가 더 현실적일 수 있음

**2. 룰 엔진 설계: eligibility_rules JSON DSL + Rust 평가기: `조건부`**  
방향 자체는 맞습니다. 정책/장학금 도메인은 조건이 자주 바뀌고, 운영자가 조건을 수정해야 하므로 DB 저장형 룰은 필요합니다. 코드 하드코딩보다 훨씬 낫습니다.  
하지만 JSON DSL을 처음부터 범용 언어처럼 만들면 거의 확실히 과설계됩니다. 연산자, 중첩, 날짜 기준, 예외 조건, 지역/소득/학년 조합이 늘어나면서 디버깅과 검수 난도가 급격히 올라갑니다.

개선안:
- “범용 DSL”이 아니라 “제한된 조건 스키마”로 시작
- 예: `age`, `region`, `income_bracket`, `school_status`, `major`, `employment_status` 정도만 1차 지원
- Boolean AST 정도로만 설계: `all/any/not + field/op/value`
- 룰 버전 관리 필수: `rule_version`, `compiled_at`, `created_by`, `reviewed_by`
- 평가 결과에 explain trace 저장: 어떤 rule node가 통과/실패했는지 남겨야 운영 가능
- 룰 테스트 fixture를 두고 회귀 테스트 자동화 필요
- JSONB 저장은 괜찮지만, “자주 조회하는 공통 eligibility facet”는 별도 컬럼으로 중복 저장하는 것이 좋음

권장 방향:
- 1단계: 구조화된 제한 DSL
- 2단계: 필요 시 rule compiler / admin rule builder 추가
- 처음부터 자유형 DSL은 피하는 게 맞음

**3. 추천 엔진 4단계 파이프라인: `적합`**  
`하드필터 → 룰매칭 → 스코어링 → 설명생성`은 매우 합리적입니다. 이 순서는 성능, 설명 가능성, 운영 안정성 측면에서 좋습니다. 특히 공공정책 추천은 “왜 추천됐는지”가 중요해서 설명 생성 단계가 분리된 점이 좋습니다.  
다만 MVP에서 주의할 점은 스코어링과 설명 생성이 너무 복잡해지면 운영 불가능해진다는 것입니다.

개선안:
- 하드필터는 SQL 레벨에서 최대한 처리
- 룰매칭은 Rust evaluator에서 처리하되 결과 trace 반환
- 스코어링은 ML 없이 규칙 기반 weighted scoring으로 시작
- 설명 생성은 LLM 자유생성보다 템플릿 기반 우선
- AI는 “설명 문장 다듬기” 정도로 제한하는 것이 안전
- 추천 결과 캐시 키는 `user_profile_version + program_version + rule_version` 기반으로 설계

추가로 필요한 것:
- 추천 사유와 탈락 사유 모두 저장
- 추천 결과 snapshot 저장
- 재현 가능성 보장: 같은 입력이면 같은 결과가 나오게 해야 함

**4. 데이터 파이프라인: 공공API→원문저장→hash비교→정규화→룰추출→검수→게시: `적합`**  
이 흐름은 꽤 견고합니다. 특히 원문 저장, hash 비교, 검수 단계를 넣은 건 맞는 방향입니다. 정책 데이터는 품질이 들쭉날쭉해서 “자동 게시”는 위험합니다.  
다만 실제 병목은 기술보다 운영입니다. 공공 API 스키마 변경, 누락 필드, 중복 데이터, 공고 종료일 해석 오류가 더 큰 문제입니다.

개선안:
- 원문(raw payload) 불변 저장 필수
- source_id + fetched_at + content_hash + parser_version 저장
- hash 비교는 payload 전체 hash 외에 “핵심 필드 canonical hash”도 별도 저장 추천
- 정규화 실패/부분실패 상태를 분리
- 룰추출은 자동화하더라도 human-in-the-loop 유지
- 게시 전 검수 체크리스트를 구조화해야 함: 마감일, 지역, 연령, 소득, 중복 여부

추가 권장 테이블/필드:
- `source_documents`
- `normalization_errors`
- `program_versions`
- `review_tasks`

핵심 리스크:
- “룰추출 자동화” 정확도 과신
- 정책 텍스트 해석 ambiguity
- 마감일/상시모집/예산소진 시 종료 같은 예외 처리

**5. DB 스키마: `조건부`**  
나열된 엔티티 자체는 맞습니다. 다만 지금 구조만으로는 운영/이력/재현성 요구를 다 받기 어렵습니다.

우려점:
- `user_profiles`가 단일 현재 상태만 가지면 추천 재현이 어려움
- `programs`와 `eligibility_rules`가 변경 이력 없이 덮어쓰기되면 문제
- `user_program_states`가 너무 많은 책임을 가질 수 있음
- `alerts`는 발송 로그와 구독 설정이 분리되어야 함
- `ingestion_runs`만으로는 개별 source item 추적이 부족함

개선안:
- `user_profile_versions` 또는 profile snapshot 개념 추가
- `programs`는 current row + `program_versions` 분리 권장
- `eligibility_rules`도 versioned entity로 관리
- `user_program_states`는 의미를 좁혀야 함
  - 예: bookmarked, dismissed, applied, clicked, recommended_at
- `alerts`를 분리
  - `alert_subscriptions`
  - `alert_deliveries`
- ingestion 계층 분리
  - `ingestion_runs`
  - `ingestion_items`
  - `source_documents`

또 하나 중요:
- 공통 facet 컬럼을 `programs`에 일부 반정규화해야 검색/필터 성능이 좋아짐
- 예: `min_age`, `max_age`, `regions`, `deadline_at`, `program_type`, `is_active`

**6. monorepo 구조: apps/web + crates/api,worker,domain,infra + packages/ui,config: `적합`**  
구조는 괜찮습니다. 웹과 Rust 백엔드, 공유 UI/config를 분리하는 의도도 명확합니다.  
다만 `domain`, `infra` 분리는 초기에 과도하게 엄격하면 오히려 속도를 늦춥니다. 작은 팀에서는 “깔끔한 레이어링”보다 “변경 비용이 낮은 구조”가 더 중요합니다.

장점:
- 배포/버전 관리 단순
- 프론트/백 간 계약 관리 쉬움
- 공용 타입/설정 재사용 가능
- Rust crate 단위로 책임 분리 가능

단점:
- 초기에 crate가 너무 잘게 쪼개지면 생산성 저하
- TS/ Rust 빌드 체인 동시 관리 부담
- CI 설정이 복잡해질 수 있음

개선안:
- Rust는 초기에 `api`, `worker`, `core` 정도만 두는 게 현실적
- `domain`, `infra`를 별도 crate로 강제하지 말고 필요할 때 분리
- OpenAPI 또는 JSON Schema를 기준으로 프론트-백 계약 관리
- `packages/config`는 좋지만 너무 많은 공유 추상화는 피할 것

**7. 보안: JWT + argon2, HTTPS 강제, 민감필드 암호화 전략: `조건부`**  
기본선은 맞습니다. 그런데 이것만으로 충분하다고 보기 어렵습니다. 특히 장학금/정책 추천은 소득, 연령, 지역, 학적 등 민감도가 높은 데이터를 다룰 수 있습니다.

보완 필요:
- JWT는 access token 짧게, refresh token은 회전(rotating) 전략
- 가능하면 refresh token은 DB 저장 및 폐기 가능해야 함
- 민감필드 암호화는 “무엇을 암호화할지”를 명확히 해야 함
- 검색/필터에 필요한 필드는 전부 암호화하면 운영이 불편함

권장:
- 비밀번호: `argon2id`
- 전송 구간: HTTPS only + HSTS
- 저장 구간:
  - 주민번호 같은 고위험 정보는 수집 자체를 피함
  - 소득구간, 학적상태처럼 추천용 최소 정보만 저장
  - 전화번호, 이메일은 field-level encryption 고려
- 키 관리는 env 파일 수준을 넘어서야 함. 최소한 키 분리 필요
- 관리자 액션 audit log 필수
- rate limiting, login throttling, email verification 필요
- Caddy 앞단에서도 보안 헤더 설정 필요

핵심 판단:
- 현재 제안은 “출발선”으로는 괜찮지만 “충분성”으로는 부족함

**8. 12주 타임라인: `조건부`**  
범위를 잘 자르면 가능합니다. 지금 명세를 그대로 다 구현하면 빡빡합니다. 가장 위험한 영역은 다음 4개입니다.

병목 예측:
- Rust 기반 도메인/인증/운영툴 전부 구현
- JSON DSL 룰 엔진 설계 및 디버깅
- 공공데이터 정규화와 검수 플로우
- 추천 설명 생성 품질 확보

현실적인 12주 MVP 조건:
- 데이터 소스 수 제한
- 지원 정책 유형 제한
- 룰 DSL 범위 축소
- 설명 생성은 템플릿 우선
- 관리자 검수 도구는 최소 기능만
- 알림 채널 1개만 먼저

추천 범위:
- 1차 MVP: 회원가입, 프로필 입력, 정책 목록, 기본 필터, 추천 Top N, 북마크, 마감 알림 1종
- 제외 또는 축소: 복잡한 AI 추천, 범용 DSL 빌더, 다채널 알림, 고급 운영 대시보드

현실 일정 예시:
1. 1-2주: 스키마, 인증, 기본 API, 웹 골격
2. 3-4주: 정책 수집/정규화 1차, 목록/검색
3. 5-6주: 프로필 기반 하드필터 + 룰매칭
4. 7-8주: 추천 결과/설명, 북마크/상태 관리
5. 9-10주: 검수 플로우, 알림, 캐시
6. 11-12주: 운영 안정화, 테스트, 배포

**최종 판정**
- 1. Rust + Axum: `조건부`
- 2. JSON DSL 룰 엔진: `조건부`
- 3. 추천 4단계 파이프라인: `적합`
- 4. 데이터 파이프라인: `적합`
- 5. DB 스키마: `조건부`
- 6. monorepo 구조: `적합`
- 7. 보안: `조건부`
- 8. 12주 MVP: `조건부`

**가장 중요한 개선 5개**
- Rust는 유지하되 기능 범위를 줄여서 일정 리스크를 관리할 것
- 룰 엔진은 범용 DSL이 아니라 제한된 AST 기반으로 시작할 것
- 프로그램/룰/프로필 모두 버저닝 또는 snapshot을 넣어 재현성을 확보할 것
- 추천 설명은 AI 자유생성보다 템플릿 기반으로 먼저 출시할 것
- ingestion/검수/게시 이력 추적 테이블을 더 세분화할 것

원하면 다음 단계로 이어서 해줄 수 있습니다.  
1. 이 명세를 바탕으로 “MVP 기준 아키텍처 수정안” 작성  
2. Rust/Axum 기준 DB 스키마 초안 리뷰  
3. 12주 개발 로드맵을 주차별 산출물 기준으로 재구성
tokens used
4,644

```

## Concise summary

Provider completed successfully. Review the raw output for details.

## Action items

- Review the response and extract decisions you want to apply.
- Capture follow-up implementation tasks if needed.
