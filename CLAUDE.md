# 프로젝트: 청년 정책·장학금 추천 플랫폼 (마지미)

## 기본 설정

- **항상 ultrathink 모드 사용** — 이 프로젝트에서는 모든 응답에서 deep thinking을 기본 적용할 것
- **보안 체크 1순위** — 코드 작성/수정 시 보안 체크리스트 항상 확인
- **병렬 작업 우선** — 독립적인 작업은 항상 멀티에이전트로 병렬 실행

## Harness Bootstrap

- 작업 시작 전 `.harness/objective.yaml`과 `.harness/program.md`를 먼저 확인한다.
- 모든 작업에서 `.harness/policies/brainstem/_rules.md`를 기본 규칙으로 적용한다.
- 변경 영역에 따라 아래 추가 규칙을 함께 읽는다:
  - backend or auth: `.harness/policies/cortex/backend/_rules.md`
  - frontend: `.harness/policies/cortex/frontend/_rules.md`
  - ingestion or recommendation: `.harness/policies/cortex/data/_rules.md`
- 반복되거나 치명적인 실패는 `.harness/incidents/`에 남기고, 재발 방지 교훈은 `.harness/memory-bank/facts.tsv`에 증류한다.
- 같은 실패가 반복되면 replay case를 추가하고, 검증 가능한 규칙만 정책으로 승격한다.

## 빌더 철학 (gstack Ethos 영감)

### Boil the Lake
AI 코딩으로 완성의 한계비용이 거의 0이 되었으면, 항상 완전한 버전을 만들 것.
- "90%만 커버하면 코드가 적으니까 B로 하자" → 70줄 차이면 A(100%)로 해라
- "테스트는 후속 PR에서 하자" → 테스트는 가장 쉽게 끓일 수 있는 호수
- Lake(모듈 100% 테스트 커버리지, 전체 기능 구현) ↔ Ocean(전체 시스템 재작성) 구분

### Search Before Building
만들기 전에 이미 존재하는지 먼저 확인:
- **Layer 1 (검증된 사실)**: 확인 비용 0. 런타임 빌트인 놓치지 말 것
- **Layer 2 (유행 정보)**: 블로그/트렌드 비판적 수용. 군중이 틀릴 수 있음
- **Layer 3 (1차 원칙)**: 독자적 관찰이 가장 가치 있음. 유레카 모먼트를 찾아라

### Completion Status Protocol
모든 에이전트 작업 완료 시 상태 보고 필수:
- **DONE**: 완료. 각 주장에 근거 제시
- **DONE_WITH_CONCERNS**: 완료. 알아야 할 이슈 리스트
- **BLOCKED**: 진행 불가. 원인 + 시도 + 추천
- **NEEDS_CONTEXT**: 추가 정보 필요. 정확히 뭐가 필요한지

### Voice (gstack 영감)
직접적이고 구체적이며 날카롭게. 기업적이거나 학문적이지 않게.
빌더처럼 말한다. 파일명과 함수명을 지목한다. 필러 워드, 서론, 불필요한 전환어 금지.
AI 슬롭 단어 금지: delve, crucial, robust, comprehensive, nuanced, leverage, utilize.

### Safety Guardrails (gstack /careful + /freeze + /guard 영감)
- **Careful Mode**: rm -rf, DROP TABLE, force-push, git reset --hard 같은 파괴적 명령 실행 전 반드시 확인
- **Freeze Concept**: 디버깅 중에는 관련 없는 코드를 "실수로" 수정하지 않도록 스코프 의식
- **Escalation**: 3번 실패하면 STOP하고 에스컬레이션. 나쁜 작업은 작업하지 않는 것보다 나쁘다

## 자동 트리거 규칙 (gstack Proactive Mode)

사용자가 아래 키워드/맥락으로 말하면 해당 에이전트의 특수 모드를 **자동으로** 활성화한다. 별도 스킬 호출 불필요.

### 전략/리뷰
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "사업계획서 평가", "PSST 리뷰", "피칭 피드백" | → | `product-manager` (PSST 평가 프레임워크 + 6 Forcing Questions) |
| "전략 리뷰", "스코프 맞나?", "더 크게 생각해야 하나?" | → | `product-manager` (CEO Review 4모드) |
| "아이디어 검증", "이거 만들 가치 있나?", "브레인스토밍" | → | `product-manager` (Office Hours 6질문) |
| "플랜 리뷰", "전체 리뷰 돌려", "자동 리뷰" | → | `planner` (Autoplan Pipeline: CEO→Design→Eng 순차) |
| "이번 주 뭐 했지?", "회고", "retro" | → | `planner` (Retro Mode: git log 분석) |

### 디자인
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "디자인 감사", "비주얼 QA", "UI 이상한데", "디자인 폴리싱" | → | `designer` / `ui-designer` (Design Review Audit Loop) |
| "디자인 시스템 만들어", "브랜드 가이드라인", "DESIGN.md" | → | `designer` / `ui-designer` (Design Consultation) |
| "디자인 옵션 보여줘", "시각 브레인스토밍", "여러 안 비교" | → | `designer` / `ui-designer` (Design Shotgun) |

### QA/테스트
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "QA 해줘", "테스트 해줘", "이거 동작하나?" | → | `qa-tester` (Standard QA + Health Score) |
| "버그 리포트만", "수정은 하지 마" | → | `qa-tester` (QA-Only Report Mode) |
| "성능 측정", "느려진 거 같은데", "벤치마크" | → | `qa-tester` / `verifier` (Benchmark Mode) |
| "배포 후 확인", "프로덕션 괜찮나?", "카나리" | → | `verifier` (Canary Monitoring) |

### 코드 리뷰/보안
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "PR 리뷰", "코드 리뷰", "머지 전 확인" | → | `code-reviewer` (PR Review Mode: SQL+LLM+side effects 포함) |
| "보안 감사", "보안 점검", "OWASP" | → | `security-reviewer` (CSO Mode: STRIDE+시크릿+공급망) |

### 배포/운영
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "ship", "배포", "PR 만들어" | → | `git-master` (Ship Workflow: 테스트→리뷰→PR) |
| "머지해", "랜딩", "디플로이" | → | `git-master` (Land & Deploy) |
| "문서 업데이트", "docs 동기화" | → | `writer` (Post-Ship Doc Sync) |

### 디버깅
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "이거 왜 안 돼?", "버그", "에러 나는데" | → | `debugger` (Iron Law 4-Phase: 원인 없이 수정 금지) |

### 아키텍처
| 사용자 발화 패턴 | 자동 트리거 | 에이전트 + 모드 |
|-----------------|-----------|----------------|
| "아키텍처 리뷰", "구조 괜찮나?", "설계 봐줘" | → | `architect` (Boil the Lake + Search Before Building 적용) |

> **규칙 1**: 트리거가 겹치면 더 구체적인 것이 우선. 확실하지 않으면 사용자에게 "X 모드로 할까요?" 한 줄 확인.
> **규칙 2 (모드 격리)**: 각 모드는 반드시 해당 분야 에이전트만 사용한다. 모드가 섞이면 안 된다.
> - Design Review → `designer` / `ui-designer`만. debugger나 code-reviewer가 디자인 판단 금지.
> - QA/Benchmark → `qa-tester` / `verifier`만. executor가 테스트 중에 코드 수정 금지.
> - PR Review → `code-reviewer`만. designer가 코드 품질 판단 금지.
> - 보안 감사 → `security-reviewer` / `security-officer`만. 다른 에이전트가 보안 판정 금지.
> - Ship/Deploy → `git-master`만. planner가 git 작업 금지.
> - 디버깅 → `debugger`만. executor가 원인 분석 없이 수정 금지.
> - 전략/PSST → `product-manager` / `startup-advisor`만. 기술 에이전트가 사업 판단 금지.
> - 문서 동기화 → `writer`만. executor가 문서 수정 금지.
> **규칙 3 (위임은 가능)**: 에이전트가 자기 범위 밖의 작업이 필요하면 직접 하지 말고 해당 전문 에이전트를 스폰한다.

## 멀티에이전트 작업

멀티에이전트로 작업해달라는 요청이 오면 **tmux split-pane 모드**로 팀을 구성할 것.

- `teammateMode: "tmux"` 설정으로 각 워커가 tmux 분할 창에서 실행
- 메인 에이전트(team-lead)가 오케스트레이션: 태스크 분해, 할당, 모니터링, 합성
- 프로젝트 에이전트 (`.claude/agents/`) 를 `--agent` 플래그로 지정하여 스폰
- 각 에이전트는 자기 전문 영역 외 작업을 OMC subagent에게 위임 (에이전트 파일 내 규칙 참조)

### 프로젝트 에이전트
| 에이전트 | 역할 | 모델 |
|---------|------|------|
| rust-backend | Axum API, DB, 룰엔진 | sonnet |
| nextjs-frontend | Next.js 페이지, 컴포넌트 | sonnet |
| ui-designer | 디자인 시스템, UX, 접근성 | sonnet |
| data-engineer | 공공 API, 크롤링, 정규화 | sonnet |
| qa-tester | Rust/Next.js 테스트 | sonnet |
| researcher | 웹 검색, API 조사, 규제 | sonnet |
| product-manager | 스펙, 유저스토리, 우선순위 | opus |
| mobile-app-builder | React Native (Expo) 모바일 앱 | sonnet |
| startup-advisor | YC Office Hours 스타일 PSST 평가, CEO 전략 리뷰 | opus |
| security-officer | CSO 보안 감사, OWASP, STRIDE, 공급망 보안 | opus |

## 기술 스택

- **프론트엔드**: Next.js 15 + TypeScript + Tailwind CSS v4 + shadcn/ui + TanStack Query + Zustand
- **백엔드**: Rust + Axum 0.8 (path param은 `{id}` 형식)
- **DB**: PostgreSQL 16 + SQLx (Supabase managed PG 예정)
- **캐시**: Redis 7
- **인증**: NextAuth.js (카카오 1-Tap 우선)
- **배포**: Docker Compose + Caddy
- **패키지 관리**: pnpm (JS/TS), cargo workspace (Rust), uv (Python)

## 개발 환경

- `make dev` — Docker Compose 개발 환경 시작
- `make dev-down` — 종료
- `make db-shell` — PostgreSQL 접속
- 프로젝트 디렉토리 이름이 한글(창업)이라 compose 파일에 `name: wello` 명시 필수

## 코드 규칙

- Rust crate `core`는 표준 라이브러리와 충돌하므로 `wello-core`로 명명
- Axum 0.8에서 path parameter는 `{id}` 형식 (`:id` 아님)
- 추천 설명은 템플릿 기반 우선 (LLM 자유생성 지양)

## 🔒 보안 규칙 (최우선)

**모든 작업에서 보안을 1순위로 체크할 것. 코드를 작성/수정할 때마다 아래 체크리스트를 확인.**

### 필수 보안 체크리스트
1. **IDOR 방지**: 모든 보호 라우트에서 `user_id`는 JWT(AuthUser)에서 가져올 것. 클라이언트가 보내는 user_id 절대 신뢰 금지
2. **Admin 접근 제어**: admin 라우트는 반드시 `AdminUser` 역할 체크. 일반 유저 접근 시 403 반환
3. **에러 메시지 숨기기**: 프로덕션에서 DB 에러/스택트레이스 절대 노출 금지. 제네릭 메시지만 반환
4. **RLS 정책**: 새 테이블 생성 시 반드시 RLS 활성화 + 정책 추가
5. **환경변수**: .env 파일 git 커밋 절대 금지. .gitignore 확인
6. **CORS**: `CorsLayer::permissive()` 사용 금지. 허용 오리진 명시
7. **입력 검증**: 모든 사용자 입력 검증. SQL은 반드시 파라미터 바인딩 사용
8. **결제 검증**: 가격은 반드시 서버 DB에서 조회 후 검증. 클라이언트 가격 신뢰 금지
9. **콘솔 로깅**: 프로덕션에서 민감 정보(토큰, PII) 로깅 금지. logger.ts 사용
10. **보안 헤더**: X-Content-Type-Options, X-Frame-Options, HSTS 필수
11. **JWT**: 토큰 만료 시간 합리적 설정. 서비스 키/비밀키 하드코딩 금지
12. **서류 암호화**: 사용자 문서는 반드시 암호화 저장. XOR 아닌 AES-256 사용 (TODO)
13. **Prompt Injection**: AI/LLM 호출 시 사용자 입력 새니타이징 필수

### 보안 에이전트 자동 호출
- 코드 리뷰 시 `security-reviewer` 에이전트 함께 실행
- 배포 전 보안 감사 필수 실행
- 새 API 라우트 추가 시 IDOR/인증/인가 체크

## 수정 후 자동 점검 (필수)

**코드 수정이 완료될 때마다 아래 4개 에이전트를 병렬로 실행하여 전체 프로젝트를 점검할 것.**

```
보안 에이전트 (security-reviewer, opus)  — 인증, IDOR, 인젝션, 비밀키 노출
아키텍처 에이전트 (architect, opus)      — 구조, DB 설계, 확장성, 누락 컴포넌트
코드 리뷰 에이전트 (code-reviewer, opus) — 로직 결함, 타입 안전성, 성능, SOLID
검증 에이전트 (verifier, opus)           — 빌드, API 매칭, 라우팅, 기능 완성도
```

- 4개 모두 `run_in_background: true`로 병렬 실행
- 결과를 종합하여 Critical/High 이슈는 즉시 수정
- Medium/Low는 보고 후 사용자 판단에 따라 처리
