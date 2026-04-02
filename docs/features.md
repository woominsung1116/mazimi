# 마지미(Mazimi) 기능 모듈 현황

> 최종 업데이트: 2026-04-03

---

## 1. 인증/온보딩

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 카카오 로그인 | `app/login.tsx` | Safari/WebView OAuth, JWT 발급 | - |
| 세션 관리 | `store/auth.ts` | SecureStore 토큰 저장, 자동 복원, refresh | - |
| 온보딩 1차 | `app/onboarding/index.tsx`, `step1.tsx` | 닉네임, 지역, 나이 입력 | O |
| 온보딩 2차 | `app/onboarding/step2.tsx`, `step3.tsx` | 학력, 소득, 취업상태 입력 | O |
| 맞춤 미리보기 | `app/preview.tsx` | 온보딩 후 추천 결과 표시 | X |

## 2. 홈 (메인 대시보드)

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 홈 화면 | `app/(tabs)/index.tsx` | 인사 카드, 맞춤 추천, 마감 임박, 오늘 할 일 | X (비로그인시 CTA 표시) |
| 대시보드 API | `GET /api/v1/dashboard` | 북마크 수, 신청 수, 예상 금액 | O |

## 3. 탐색

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 프로그램 목록 | `app/(tabs)/explore.tsx` | 전체 정책/장학금 리스트 + 필터 | X |
| 프로그램 API | `GET /api/v1/programs` | 공개 API, 타입/지역 필터 | X |

## 4. 혜택 상세/신청

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 프로그램 상세 | `app/programs/[id].tsx` | 상세 정보, 자격 체크, 서류 목록 | X |
| 북마크 | `POST /api/v1/programs/{id}/bookmark` | 저장/해제 토글 | O (Alert 안내) |
| 신청 도우미 | `app/apply-assistant.tsx` | 5단계 위자드 (자격→서류→정보→신청→완료) | O |
| 신청 정보 준비 | `app/auto-fill.tsx` | 프로필 복사, WebView JS 자동입력 | O |
| 신청서 생성 | `app/generated-form.tsx` | PDF 신청서 생성 | O |
| 신청 링크 이동 | `programs/[id].tsx` | 공식 사이트 WebView/브라우저 | X |

## 5. 서류 보관함

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 서류 보관함 | `app/document-vault.tsx` | 업로드(카메라/갤러리/PDF), AES 암호화 저장 | O |
| 만료 알림 | `document-vault.tsx` | 90일 경과 시 갱신 필요 배지 | O |
| 보관함 공유 모듈 | `lib/vault.ts` | StoredDocument 타입, useVaultDocuments 훅 | - |
| 암호화 | `lib/crypto.ts` | AES-256-CBC 파일 암호화/복호화 | - |
| 서류↔신청 연동 | `apply-assistant.tsx` Step2 | 보관함 서류 자동 매칭 (DocumentType 기반) | O |
| 서류 공유 | `auto-fill.tsx` VaultSection | expo-sharing으로 서류 공유 (복호화 후) | O |

## 6. 신청 상태 관리

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 상태 트래커 | `app/(tabs)/manage.tsx` | 7단계 관리 (관심→계획→신청중→완료→대기→수혜→포기) | O |
| 상태 변경 API | `PUT /api/v1/my/applications/{id}` | 단계 변경 + 메모 | O |
| 신청 목록 API | `GET /api/v1/my/applications` | 전체 신청 목록 | O |

## 7. 프로필/마이페이지

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 프로필 화면 | `app/(tabs)/profile.tsx` | 정보 표시/수정 | O |
| 프로필 API | `GET/POST /api/v1/profile` | 프로필 조회/저장 | O |
| 알림 설정 | `notification_preferences` API | 항목별 ON/OFF | O |

## 8. 알림 시스템

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 마감 알림 | `worker/alerts.rs` | D-7, D-3, D-1 크론 기반 | O |
| 푸시 등록 | `lib/notifications.ts` + `POST /api/v1/push/register` | Expo 푸시 토큰 등록 | O |
| 알림 목록 API | `GET /api/v1/alerts` | 알림 히스토리 | O |

## 9. 분석/계산 도구

| 모듈 | 파일 | 설명 | 로그인 필요 |
|------|------|------|:---------:|
| 놓친 돈 계산기 | `app/calculator.tsx` | 미신청 혜택 예상 금액 | X |
| 혜택 중복 계산기 | `app/stack-calculator.tsx` | 동시 수혜 합산 분석 | X |
| 조건 시뮬레이터 | `app/region-compare.tsx` | 지역/소득 변경 시 혜택 변화 | X |
| 추천 API | `POST /api/v1/recommend/preview` | 프로필 기반 추천 (공개) | X |

## 10. 데이터 수집 (Worker)

| 모듈 | 파일 | 데이터 소스 | 상태 |
|------|------|-----------|------|
| 행안부 공공서비스 | `sources/gov_benefits.rs` | api.odcloud.kr (10,921건) | 작동 |
| 한국장학재단 | `sources/scholarship.rs` | api.odcloud.kr (1,646건) | 작동 |
| 온통청년 | `sources/youth_center.rs` | youthcenter.go.kr | 서버 장애 |
| 금감원 금융상품 | `sources/financial.rs` | finlife.fss.or.kr | 미확인 |
| 드림스폰 장학금 | `sources/dreamspon.rs` | dreamspon.com | 미확인 |
| 지역 포털 스크래핑 | `sources/local_scraper.rs` | 각 지역 청년센터 HTML | 미확인 |
| 수집 파이프라인 | `pipeline.rs` | 정규화 + upsert + 해시 비교 | 작동 |
| 크론 스케줄러 | `main.rs` | 매일 02:00 UTC | 작동 |

## 11. 백엔드 API

| 모듈 | 파일 | 설명 |
|------|------|------|
| 라우터 | `crates/api/src/lib.rs` | 인증/공개/관리자 라우트 분리 |
| 인증 미들웨어 | `lib.rs` auth_middleware | JWT 검증 + AuthUser 주입 |
| 보안 헤더 | `lib.rs` security_headers | HSTS, X-Frame-Options, nosniff |
| 에러 새니타이징 | `lib.rs` error_sanitization | 프로덕션 5xx 메시지 제거 |
| Rate Limiting | `lib.rs` GovernorLayer | 인증 5/min, 관리자 30/min, 일반 100/min |
| RLS | `rls_policies.sql` | PostgreSQL Row Level Security |
| 관리자 API | `routes/admin.rs` | 프로그램 CRUD, 통계, 수동 sync |

## 12. 인프라

| 모듈 | 파일 | 설명 |
|------|------|------|
| Docker Compose | `compose.dev.yml`, `compose.yml` | dev/prod 환경 |
| DB 마이그레이션 | `infra/migrations/` (22개) | SQLx 마이그레이션 |
| 리버스 프록시 | `infra/caddy/` | Caddy 자동 HTTPS |
| CI/CD | `.github/workflows/` | GitHub Actions |
| 스크래퍼 | `scripts/scraper/` | Python Scrapling |

---

## 미구현 (P1)

| 기능 | 우선순위 |
|------|---------|
| 소득구간 가이드 UI | P1 |
| 상세 필터 패널 | P1 |
| 서류 재사용 (auto-fill 연동) | P1 |
| 서류 준비율 표시 UI | P1 |
| 신규 혜택 알림 (ingestion 후 매칭) | P1 |
| 카카오 알림톡 연동 | P1 |
| 로딩 애니메이션 | P1 |

## 미구현 (P2 향후)

| 기능 | 비고 |
|------|------|
| 서류 자동 입력 고도화 | auto-fill.tsx 기본 구현됨, 고도화 예정 |
| 원클릭 신청 | 코드 기반 준비됨, 향후 추가 |
| 복지서비스 API 연동 | apis.data.go.kr 복구 대기 |
