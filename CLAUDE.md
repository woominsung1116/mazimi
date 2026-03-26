# 프로젝트: 청년 정책·장학금 추천 플랫폼 (마지미)

## 기본 설정

- **항상 ultrathink 모드 사용** — 이 프로젝트에서는 모든 응답에서 deep thinking을 기본 적용할 것
- **보안 체크 1순위** — 코드 작성/수정 시 보안 체크리스트 항상 확인
- **병렬 작업 우선** — 독립적인 작업은 항상 멀티에이전트로 병렬 실행

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
