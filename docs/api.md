# 마지미(Mazimi) API 연동 현황

> 최종 업데이트: 2026-04-02

## API 키 관리

- data.go.kr 통합 키: `.env.dev` → `GOV_API_KEY`
- 각 API별 환경변수는 `GOV_API_KEY`를 fallback으로 사용
- 프로덕션 키는 `.env.production`에서 별도 관리

---

## 1. 작동 중인 API

### 1-1. 행안부 공공서비스(혜택) 정보

| 항목 | 내용 |
|------|------|
| 제공처 | 행정안전부 (보조금24/정부24) |
| 신청 페이지 | https://www.data.go.kr/data/15113968/openapi.do |
| Swagger | https://infuser.odcloud.kr/api/stages/44436/api-docs |
| 엔드포인트 | `https://api.odcloud.kr/api/gov24/v3/serviceList` |
| 상세 조회 | `https://api.odcloud.kr/api/gov24/v3/serviceDetail` |
| 지원 조건 | `https://api.odcloud.kr/api/gov24/v3/supportConditions` |
| 인증 | `serviceKey` 쿼리 파라미터 |
| 응답 형식 | JSON |
| 페이지네이션 | `page` (1부터), `perPage` (기본 10) |
| 환경변수 | `GOV_BENEFITS_API_KEY` |
| 코드 파일 | `crates/worker/src/sources/gov_benefits.rs` |
| 데이터 건수 | 약 10,921건 |
| 상태 | ✅ 작동 |

### 1-2. 한국장학재단 학자금지원정보(대학생)

| 항목 | 내용 |
|------|------|
| 제공처 | 한국장학재단 (KOSAF) |
| 신청 페이지 | https://www.data.go.kr/data/15028252/fileData.do |
| Swagger | https://infuser.odcloud.kr/oas/docs?namespace=15028252/v1 |
| 엔드포인트 | `https://api.odcloud.kr/api/15028252/v1/uddi:d0fb69e9-e143-412d-9fe0-b0d87a16f3ff` |
| 인증 | `serviceKey` 쿼리 파라미터 |
| 응답 형식 | JSON |
| 페이지네이션 | `page`, `perPage` |
| 환경변수 | `KOSAF_API_KEY` |
| 코드 파일 | `crates/worker/src/sources/scholarship.rs` |
| 데이터 건수 | 약 1,646건 |
| 상태 | ✅ 작동 |

### 1-3. 카카오 로그인

| 항목 | 내용 |
|------|------|
| 제공처 | 카카오 |
| 개발자 콘솔 | https://developers.kakao.com |
| 인증 엔드포인트 | `https://kauth.kakao.com/oauth/authorize` |
| 토큰 교환 | `https://kauth.kakao.com/oauth/token` |
| 사용자 정보 | `https://kapi.kakao.com/v2/user/me` |
| 환경변수 | `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` |
| 코드 파일 | `crates/api/src/routes/auth.rs` |
| 상태 | ✅ 작동 |

### 1-4. 금감원 금융상품 비교공시

| 항목 | 내용 |
|------|------|
| 제공처 | 금융감독원 |
| 신청 페이지 | https://finlife.fss.or.kr/finlife/api/apiIntro.do |
| 환경변수 | `FSS_API_KEY` |
| 코드 파일 | `crates/worker/src/sources/financial.rs` |
| 상태 | ⚠️ 미확인 (키 발급 완료) |

### 1-5. 드림스폰 장학금

| 항목 | 내용 |
|------|------|
| 제공처 | 드림스폰 |
| 엔드포인트 | `https://www.dreamspon.com/process/scholarAjax.html` |
| 인증 | 불필요 |
| 환경변수 | `DREAMSPON_ENABLED` (기본 true) |
| 코드 파일 | `crates/worker/src/sources/dreamspon.rs` |
| 상태 | ⚠️ 미확인 |

---

## 2. 서버 장애 중인 API (코드 구현 완료, 복구 대기)

### 2-1. 온통청년 청년정책

| 항목 | 내용 |
|------|------|
| 제공처 | 고용정보원 (온통청년) |
| 신청 페이지 | https://www.youthcenter.go.kr/myPage/openapi |
| API 가이드 | https://www.youthcenter.go.kr/cmnFooter/openapiIntro/oaiGuide |
| 엔드포인트 | `https://www.youthcenter.go.kr/opi/youthPlcyList.do` |
| 인증 | `openApiVlak` 쿼리 파라미터 |
| 응답 형식 | XML |
| 환경변수 | `YOUTH_CENTER_API_KEY` |
| 코드 파일 | `crates/worker/src/sources/youth_center.rs` |
| 장애 현상 | 302 → http://port:8080 리다이렉트 → 타임아웃 |
| 상태 | ❌ 서버 장애 |

### 2-2. 중앙부처 복지서비스 (복지로)

| 항목 | 내용 |
|------|------|
| 제공처 | 한국사회보장정보원 |
| 신청 페이지 | https://www.data.go.kr/data/15090532/openapi.do |
| 활용가이드 | `Downloads/활용가이드_중앙부처복지서비스(v2.2).doc` |
| 목록 조회 | `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001` |
| 상세 조회 | `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfaredetailedV001` |
| 인증 | `serviceKey` 쿼리 파라미터 |
| 응답 형식 | XML |
| 필수 파라미터 | `callTp=L` (목록), `pageNo`, `numOfRows` |
| 선택 파라미터 | `srchKeyCode`, `searchWrd`, `lifeArray`, `trgterIndvdlArray`, `intrsThemaArray`, `age`, `onapPsbltYn`, `orderBy` |
| 환경변수 | `NATIONAL_WELFARE_API_KEY` |
| 코드 파일 | 미구현 (서버 복구 후 구현 예정) |
| 장애 현상 | `apis.data.go.kr` 서버 타임아웃 |
| 상태 | ❌ 서버 장애 |

### 2-3. 지자체 복지서비스 (복지로)

| 항목 | 내용 |
|------|------|
| 제공처 | 한국사회보장정보원 |
| 신청 페이지 | https://www.data.go.kr/data/15108347/openapi.do |
| 목록 조회 | `https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist` |
| 상세 조회 | `https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfaredetailed` |
| 인증 | `serviceKey` 쿼리 파라미터 |
| 응답 형식 | XML |
| 필수 파라미터 | `pageNo`, `numOfRows` |
| 선택 파라미터 | `ctpvNm` (시도명), `sggNm` (시군구명), `searchWrd`, `lifeArray`, `trgterIndvdlArray`, `intrsThemaArray` |
| 환경변수 | `LOCAL_WELFARE_API_KEY` |
| 코드 파일 | 미구현 (서버 복구 후 구현 예정) |
| 장애 현상 | `apis.data.go.kr` 서버 타임아웃 |
| 상태 | ❌ 서버 장애 |

---

## 3. 삭제된 API

| API | 이유 |
|-----|------|
| 고용24 워크넷 채용정보 (`B552583`) | 채용 정보는 서비스 범위 밖 |

---

## 4. 데이터 수집 스케줄

- **자동 동기화**: 매일 02:00 UTC (worker 크론)
- **수동 동기화**: `POST /api/v1/admin/sync` (admin JWT 필요)
- **수집 로그**: `ingestion_runs` 테이블에 기록

---

## 5. 환경변수 요약 (.env.dev)

```env
# data.go.kr 통합 키
GOV_API_KEY=4f10d368...
GOV_BENEFITS_API_KEY=4f10d368...
KOSAF_API_KEY=4f10d368...
NATIONAL_WELFARE_API_KEY=4f10d368...
LOCAL_WELFARE_API_KEY=4f10d368...

# 온통청년
YOUTH_CENTER_API_KEY=d6a90807-...

# 금감원
FSS_API_KEY=a98b6865...

# 카카오
KAKAO_CLIENT_ID=9525984e...
KAKAO_CLIENT_SECRET=G0lW1v...
```

---

## 6. 장애 대응

| 상황 | 대응 |
|------|------|
| `apis.data.go.kr` 500/타임아웃 | data.go.kr 서버 장애. 복구 대기, 크론이 자동 재시도 |
| `api.odcloud.kr` "등록되지 않은 서비스" | API 활용 신청 미완료. data.go.kr 마이페이지 확인 |
| 온통청년 302 리다이렉트 | 서버 설정 문제. 관리자 이메일: ycmaster@keis.or.kr |
| "Unauthorized" | API 키 만료 또는 미승인. 키 재발급 필요 |
