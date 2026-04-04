# 마지미 (Mazimi)

청년을 위한 **정책·장학금 맞춤 추천 플랫폼**

프로필(지역, 나이, 학력, 소득분위, 취업상태 등)을 입력하면 공공 API에서 수집한 12,000+ 정책·장학금 데이터를 기반으로 맞춤 추천을 제공합니다. 서류 관리부터 신청 보조까지 원스톱으로 지원합니다.

## 주요 기능

- **카카오 1-Tap 로그인** — OAuth 기반 간편 인증 (모바일/웹)
- **맞춤 추천** — 프로필 기반 정책·장학금 자동 매칭
- **신청 도우미** — 5단계 위자드 (자격확인 → 서류매칭 → 정보입력 → 신청 → 완료)
- **서류 보관함** — AES-256 암호화 저장, 만료 알림, 신청 시 자동 매칭
- **놓친 돈 계산기** — 미신청 혜택 예상 금액 시각화
- **혜택 중복 계산기** — 동시 수혜 가능 조합 분석
- **조건 시뮬레이터** — 지역/소득 변경 시 혜택 변화 비교
- **신청 상태 관리** — 7단계 트래킹 (관심 → 계획 → 신청중 → 완료 → 대기 → 수혜 → 포기)
- **마감 알림** — D-7, D-3, D-1 푸시 알림
- **비로그인 접근** — 홈/탐색/상세/계산기는 로그인 없이 사용 가능
- **관리자 대시보드** — 프로그램 CRUD, 통계, 수동 동기화

## 아키텍처

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Caddy   │────▶│ Next.js  │     │  Worker  │
│ (Reverse │     │  Web App │     │ (Cron /  │
│  Proxy)  │──┐  └──────────┘     │  Ingest) │
└──────────┘  │                   └────┬─────┘
              │  ┌──────────┐         │
              └─▶│ Rust API │         │
                 │ (Axum)   │◀────────┤
┌──────────┐     └────┬─────┘         │
│  Expo    │          │               │
│  Mobile  │──────────┘               │
│  App     │  ┌───────▼───────┐       │
└──────────┘  │  PostgreSQL   │◀──────┘
              │  (Supabase)   │
              └───────┬───────┘
              ┌───────▼───────┐
              │    Redis      │
              └───────────────┘
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 모바일 앱 | React Native (Expo 54), TypeScript, Zustand, Expo Router |
| 웹 프론트엔드 | Next.js 15, TypeScript, Tailwind CSS v4, TanStack Query, Zustand |
| 백엔드 API | Rust, Axum 0.8, SQLx |
| 워커 | Rust, tokio-cron-scheduler, reqwest |
| DB | PostgreSQL 16 (Supabase), 22개 마이그레이션 |
| 캐시 | Redis 7 |
| 인증 | 카카오 OAuth (모바일: expo-auth-session, 웹: NextAuth.js) |
| 보안 | JWT + RLS + Rate Limiting + AES-256 서류 암호화 |
| 디자인 시스템 | "Moss Stone" 팔레트 (Material Design 3 기반 커스텀 토큰) |
| 배포 | Docker Compose, Caddy, GitHub Actions → ghcr.io |

## 프로젝트 구조

```
.
├── apps/
│   ├── mobile/             # React Native (Expo) 모바일 앱
│   │   ├── app/            # Expo Router 화면
│   │   │   ├── (tabs)/     # 홈, 탐색, 관리, 프로필
│   │   │   ├── onboarding/ # 4단계 온보딩 (닉네임→지역→나이/학적→취업상태)
│   │   │   └── programs/   # 프로그램 상세
│   │   ├── components/     # 공통 컴포넌트
│   │   ├── constants/      # 테마, 디자인 토큰
│   │   ├── lib/            # API, 암호화, 알림 유틸
│   │   └── store/          # Zustand 상태 관리
│   └── web/                # Next.js 웹 프론트엔드
│       └── src/
│           └── app/        # 페이지 (홈, 로그인, 관리자 등)
├── crates/
│   ├── api/                # Axum HTTP API 서버
│   ├── wello-core/         # 공유 도메인 모델, 설정
│   └── worker/             # 크론 작업, 공공 API 수집
├── packages/
│   ├── config/             # 공유 설정
│   └── ui/                 # 공유 UI 패키지
├── infra/
│   ├── docker/             # Dockerfile (api, web, worker)
│   ├── caddy/              # Caddyfile (prod, dev)
│   └── migrations/         # SQLx 마이그레이션 (22개)
├── scripts/
│   ├── scraper/            # Python 크롤러 (Scrapling)
│   ├── deploy.sh           # 프로덕션 배포 스크립트
│   └── backup.sh           # DB 백업 스크립트
├── docs/                   # 문서 (API, 배포, 기능, 개인정보처리방침 등)
├── compose.yml             # 프로덕션 Docker Compose
├── compose.dev.yml         # 개발 Docker Compose
└── Makefile                # 개발 명령어 단축
```

## 데이터 소스

| 소스 | API | 건수 |
|------|-----|------|
| 행안부 공공서비스 | api.odcloud.kr | ~10,900건 |
| 한국장학재단 | api.odcloud.kr | ~1,600건 |
| 온통청년 | youthcenter.go.kr | - |
| 금감원 금융상품 | finlife.fss.or.kr | - |
| 드림스폰 장학금 | dreamspon.com | - |
| 지역 청년센터 | HTML 스크래핑 | - |

수집 파이프라인이 매일 02:00 UTC에 실행되어 데이터를 정규화·upsert합니다.

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Rust toolchain (로컬 개발 시)
- Node.js 20+ & pnpm (웹 프론트엔드)
- Expo CLI (모바일 앱)

### 개발 환경 실행

```bash
# 환경변수 설정
cp .env.example .env.dev

# Docker Compose로 백엔드 스택 실행
make dev

# 개별 접속
# - 웹: http://localhost:3000
# - API: http://localhost:8080
# - DB: localhost:5432
```

### 모바일 앱 실행

```bash
cd apps/mobile
npm install
npx expo start
```

### 주요 명령어

```bash
make dev          # 개발 환경 시작 (docker compose up --build)
make dev-down     # 개발 환경 종료
make dev-logs     # 로그 확인
make db-shell     # PostgreSQL 접속
make redis-shell  # Redis CLI 접속
make prod         # 프로덕션 환경 시작
make clean        # 볼륨 포함 전체 정리
```

### 로컬 Rust 개발 (Docker 없이)

```bash
# API 서버
cargo run --bin api

# 워커
cargo run --bin worker

# 테스트
cargo test --workspace
```

## CI/CD

- **PR → main**: `cargo check` + `cargo clippy` + `cargo test` + `pnpm build` + ESLint 자동 실행
- **Push → main**: Docker 이미지 빌드 후 `ghcr.io`에 푸시

## 환경변수

`.env.example` 참조. 주요 변수:

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `REDIS_URL` | Redis 연결 문자열 |
| `JWT_SECRET` | JWT 서명 키 |
| `KAKAO_CLIENT_ID/SECRET` | 카카오 OAuth 인증 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `KAKAO_BIZAPI_KEY` | 카카오 비즈 API (알림톡) |
| `FCM_PROJECT_ID` | Firebase Cloud Messaging |
| `EXPO_PUBLIC_API_URL` | 모바일 앱 API 엔드포인트 |

## 라이선스

Private — All rights reserved.
