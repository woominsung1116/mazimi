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
              │  PostgreSQL   │◀──────┘
              │  (Supabase)   │
              └───────────────┘
                      │
              ┌───────▼───────┐
              │    Redis      │
              └───────────────┘
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15, TypeScript, Tailwind CSS v4, TanStack Query, Zustand |
| 백엔드 API | Rust, Axum 0.8, SQLx |
| 워커 | Rust, tokio-cron-scheduler, reqwest |
| DB | PostgreSQL 16 (Supabase) |
| 캐시 | Redis 7 |
| 인증 | NextAuth.js (카카오 로그인) |
| 배포 | Docker Compose, Caddy, GitHub Actions → ghcr.io |

## 프로젝트 구조

```
.
├── apps/web/              # Next.js 프론트엔드
│   └── src/
├── crates/
│   ├── api/               # Axum HTTP API 서버
│   ├── core/              # 공유 도메인 모델, 설정
│   └── worker/            # 크론 작업, 공공 API 수집
├── infra/
│   ├── docker/            # Dockerfile (api, web, worker)
│   ├── caddy/             # Caddyfile (prod, dev)
│   └── migrations/        # SQLx 마이그레이션
├── .github/workflows/     # CI/CD (ci.yml, deploy.yml)
├── compose.yml            # 프로덕션 Docker Compose
├── compose.dev.yml        # 개발 Docker Compose
└── Makefile               # 개발 명령어 단축
```

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Rust toolchain (로컬 개발 시)
- Node.js 20+ & pnpm (프론트엔드 로컬 개발 시)

### 개발 환경 실행

```bash
# 환경변수 설정
cp .env.example .env.dev

# Docker Compose로 전체 스택 실행
make dev

# 개별 접속
# - 프론트엔드: http://localhost:3000
# - API: http://localhost:8080
# - DB: localhost:5432
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

### 프론트엔드 로컬 개발

```bash
cd apps/web
pnpm install
pnpm dev
```

## CI/CD

- **PR → main**: `cargo check` + `cargo test` + `pnpm build` 자동 실행
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

## 라이선스

Private — All rights reserved.
