# 프로젝트: 청년 정책·장학금 추천 플랫폼 (마지미)

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
