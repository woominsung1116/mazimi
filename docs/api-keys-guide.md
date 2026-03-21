# 마지미 외부 API 키 발급 가이드

각 서비스의 API 키 신청 절차를 단계별로 정리한다.

---

## 1. data.go.kr — 공공데이터 포털 API 키

행정안전부 공공서비스 혜택(청년 정책) API 키를 발급받는다.

**신청 URL**: https://www.data.go.kr

### 신청 절차

1. https://www.data.go.kr 접속 후 회원가입 또는 로그인
2. 상단 검색창에 `청년` 또는 `청년정책` 검색
3. 원하는 데이터셋 클릭 (예: "청년 지원 사업 현황")
4. 데이터셋 상세 페이지에서 **[활용신청]** 버튼 클릭
5. 활용 목적 입력 (예: "청년 정책 추천 서비스 개발")
6. 신청 완료 후 **마이페이지 > 데이터 활용 > 오픈API > 인증키 발급 현황**에서 확인
7. `serviceKey` (URL 인코딩된 값) 복사

### 주요 API 목록

| API 명 | 엔드포인트 | 설명 |
|--------|-----------|------|
| 청년몽땅정보통 | `/1360000/YouthPolicyService` | 청년 정책 목록 |
| 국가장학금 | `/moe_scholarship` | 한국장학재단 장학금 |

### 유의사항

- 일반 계정: 하루 1,000건 기본 제공, 트래픽 초과 시 증량 신청 가능
- 키 발급 후 승인까지 **즉시~1영업일** 소요

---

## 2. 온통청년 Open API 키

**신청 URL**: https://www.youthcenter.go.kr

### 신청 절차

1. https://www.youthcenter.go.kr 접속
2. 상단 메뉴 **"Open API"** 또는 **"개발자 센터"** 클릭
3. 회원가입 (개인/법인 선택)
4. **API 키 신청** 메뉴에서 신청서 작성
   - 서비스명, 서비스 URL, 일 예상 호출 수, 활용 목적 입력
5. 담당자 검토 후 이메일로 API 키 발송 (1~3 영업일)
6. 발급된 `apiKey` 값을 `.env`에 저장

### API 구조

```
GET https://www.youthcenter.go.kr/go/ythstrgyouthpolicyDB/getYoungPolicy.do
  ?openApiVlak={apiKey}
  &pageIndex=1
  &pageSize=10
```

---

## 3. 카카오 Developers — 카카오 로그인 + 알림톡

**URL**: https://developers.kakao.com

### 3-1. 앱 등록

1. https://developers.kakao.com 접속 후 카카오 계정으로 로그인
2. **[내 애플리케이션] > [애플리케이션 추가하기]** 클릭
3. 앱 이름: `마지미`, 사업자명 입력 후 저장
4. 생성된 앱의 **앱 키** 확인
   - REST API 키 → `KAKAO_CLIENT_ID`
   - (필요 시) Admin 키 → 서버 측 API 호출용

### 3-2. 카카오 로그인 설정

1. 앱 선택 후 왼쪽 메뉴 **[카카오 로그인]** 클릭
2. 활성화 설정 **ON**
3. **Redirect URI** 등록:
   ```
   https://majimi.kr/api/auth/callback/kakao
   http://localhost:3000/api/auth/callback/kakao   (개발용)
   ```
4. **[동의항목]** 탭에서 필요한 항목 설정:
   - 닉네임: 필수 동의
   - 프로필 사진: 선택 동의
   - 카카오계정(이메일): 선택 동의 (비즈 앱 전환 필요)
5. **[보안]** 탭에서 Client Secret 생성 → `KAKAO_CLIENT_SECRET`

### 3-3. 알림톡 (비즈니스 채널)

> 알림톡은 **카카오톡 채널(구 플러스친구)** 개설이 선행되어야 한다.

1. https://business.kakao.com 접속 후 **카카오톡 채널 개설**
2. 채널 개설 후 https://bizmessage.kakao.com 접속
3. **발신 프로필 등록** → 채널 연결
4. **[카카오비즈니스] > API 키 발급**
   - `KAKAO_BIZAPI_KEY`: 비즈니스 API 키
   - `KAKAO_ALIMTALK_SENDER_KEY`: 발신 프로필 키
5. 알림톡 템플릿 등록 (심사 후 사용 가능, 1~3 영업일 소요)

---

## 4. Firebase — FCM 푸시 알림

**URL**: https://console.firebase.google.com

### 4-1. Firebase 프로젝트 생성

1. https://console.firebase.google.com 접속 후 Google 계정 로그인
2. **[프로젝트 추가]** 클릭
3. 프로젝트 이름: `majimi-prod`
4. Google Analytics 연동: 선택 사항 (권장)
5. 프로젝트 생성 완료 후 프로젝트 콘솔 진입

### 4-2. FCM 설정

1. 왼쪽 메뉴 **[빌드] > [Cloud Messaging]** 클릭
2. **[서비스 계정]** 탭으로 이동
3. **[새 비공개 키 생성]** 클릭 → JSON 파일 다운로드
4. 다운로드한 JSON을 한 줄로 직렬화하여 `.env`에 저장:
   ```bash
   cat firebase-adminsdk-xxxx.json | tr -d '\n' | sed 's/"/\\"/g'
   ```
   결과를 `FCM_SERVICE_ACCOUNT_JSON` 값으로 사용
5. `FCM_PROJECT_ID`: Firebase 콘솔 프로젝트 설정 > 프로젝트 ID

### 4-3. Android/iOS 앱 등록 (모바일 앱 배포 시)

- Android: 앱 패키지명 등록 → `google-services.json` 다운로드
- iOS: 앱 번들 ID 등록 → `GoogleService-Info.plist` 다운로드 + APNs 키 업로드

---

## 5. Apple Developer 계정 — 앱스토어 배포

**URL**: https://developer.apple.com/programs

### 5-1. 계정 등록

1. https://developer.apple.com/programs/enroll 접속
2. Apple ID로 로그인 (없으면 먼저 생성)
3. 등록 유형 선택:
   - **개인**: 연 $99 USD, 빠른 등록
   - **조직**: 연 $99 USD, D-U-N-S Number 필요 (1~2주 소요)
4. 결제 완료 후 **Apple Developer Program** 활성화 확인

### 5-2. 앱 등록 (App Store Connect)

1. https://appstoreconnect.apple.com 접속
2. **[나의 앱] > [+] > [신규 앱]** 클릭
3. 정보 입력:
   - 플랫폼: iOS
   - 앱 이름: 마지미
   - 기본 언어: 한국어
   - 번들 ID: `kr.majimi.app` (Xcode/Expo 설정과 동일해야 함)
   - SKU: `majimi-ios-001`
4. 앱 생성 후 심사 제출 전까지 빌드 업로드 필요

### 5-3. Expo (React Native) 배포 설정

```bash
# EAS CLI 설치
npm install -g eas-cli

# 로그인
eas login

# 빌드 설정
eas build:configure

# 프로덕션 빌드
eas build --platform ios --profile production

# 앱스토어 제출
eas submit --platform ios
```

### 5-4. 심사 기간

- 최초 심사: 1~3 영업일 (평균 24~48시간)
- 업데이트 심사: 1~2 영업일

---

## 환경변수 매핑 요약

| 변수명 | 발급처 | 위치 |
|--------|--------|------|
| `KAKAO_CLIENT_ID` | 카카오 Developers > REST API 키 | 앱 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 Developers > 카카오 로그인 > 보안 | Client Secret |
| `KAKAO_BIZAPI_KEY` | 카카오 비즈니스 > API 키 | 비즈니스 API |
| `KAKAO_ALIMTALK_SENDER_KEY` | 카카오 비즈메시지 > 발신 프로필 | 프로필 키 |
| `FCM_PROJECT_ID` | Firebase 콘솔 > 프로젝트 설정 | 프로젝트 ID |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase 콘솔 > 서비스 계정 > 키 생성 | JSON 직렬화 |
| `SUPABASE_URL` | Supabase 대시보드 > Settings > API | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 대시보드 > Settings > API | service_role 키 |
