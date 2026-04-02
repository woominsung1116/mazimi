# 마지미 프로덕션 배포 가이드

## 1. 서버 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|-----------|-----------|
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| 디스크 | 20 GB SSD | 40 GB SSD |
| 포트 | 80, 443 개방 | 80, 443 개방 |

### 필수 소프트웨어

```bash
# Docker 설치 (공식 스크립트)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose v2 확인 (Docker 26+ 에 포함)
docker compose version

# git 설치
sudo apt-get install -y git
```

---

## 2. 도메인 + Caddy HTTPS 자동 인증

### 2-1. 도메인 DNS 설정

서버 IP를 도메인에 연결한다. DNS 레코드 예시:

```
A    mazimi.kr        →  <서버 공인 IP>
A    api.mazimi.kr    →  <서버 공인 IP>
```

### 2-2. Caddyfile 설정

`infra/caddy/Caddyfile` 파일을 도메인에 맞게 수정한다:

```caddyfile
mazimi.kr {
    reverse_proxy web:3000
    encode gzip
}

api.mazimi.kr {
    reverse_proxy api:8080
    encode gzip
    header {
        Access-Control-Allow-Origin "https://mazimi.kr"
    }
}
```

Caddy는 Let's Encrypt ACME를 통해 HTTPS 인증서를 **자동 발급·갱신**한다.
포트 80, 443이 서버에서 열려 있어야 한다.

---

## 3. 프로덕션 배포 절차

### 3-1. 코드 배포

```bash
# 서버에 접속
ssh ubuntu@<서버 IP>

# 프로젝트 클론
git clone https://github.com/<org>/mazimi.git /opt/mazimi
cd /opt/mazimi
```

### 3-2. 환경변수 설정

```bash
# .env 파일 생성 (아래 4번 체크리스트 참조)
cp .env.example .env
nano .env
```

### 3-3. 최초 실행

```bash
cd /opt/mazimi

# 이미지 빌드 + 전체 서비스 시작
docker compose up -d --build

# 상태 확인
docker compose ps
docker compose logs -f api
```

### 3-4. 업데이트 배포

```bash
cd /opt/mazimi
git pull origin main
docker compose up -d --build --no-deps api worker web
```

### 3-5. DB 마이그레이션

```bash
# api 컨테이너가 시작될 때 sqlx migrate run 자동 실행됨
# 수동 실행이 필요한 경우:
docker compose exec api sqlx migrate run
```

---

## 4. 환경변수 체크리스트

`.env` 파일에 아래 항목이 모두 채워져 있어야 한다.

### 필수 항목

```env
# 데이터베이스
DATABASE_URL=postgres://wello:<비밀번호>@db:5432/wello
DB_PASSWORD=<강력한_비밀번호>

# JWT
JWT_SECRET=<최소_64자_랜덤_문자열>

# NextAuth
NEXTAUTH_URL=https://mazimi.kr
NEXTAUTH_SECRET=<최소_32자_랜덤_문자열>

# 카카오 OAuth
KAKAO_CLIENT_ID=<카카오_REST_API_키>
KAKAO_CLIENT_SECRET=<카카오_클라이언트_시크릿>
```

### 선택 항목 (기능 활성화 시 필수)

```env
# 카카오 알림톡
KAKAO_BIZAPI_KEY=<카카오_비즈니스_API_키>
KAKAO_ALIMTALK_SENDER_KEY=<알림톡_발신_프로필_키>

# Firebase FCM (푸시 알림)
FCM_PROJECT_ID=<Firebase_프로젝트_ID>
FCM_SERVICE_ACCOUNT_JSON=<서비스_계정_JSON_한줄_직렬화>

# Supabase (스토리지/인증 외부 위임 시)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<서비스_롤_키>
```

### 시크릿 생성 명령어

```bash
# JWT_SECRET (64자)
openssl rand -base64 48

# NEXTAUTH_SECRET (32자)
openssl rand -base64 24
```

---

## 5. DB 백업 스크립트 (pg_dump cron)

`scripts/backup.sh`를 사용한다 (해당 파일 참조).

### cron 등록 (매일 새벽 3시 실행)

```bash
crontab -e
```

crontab에 추가:

```
0 3 * * * /opt/mazimi/scripts/backup.sh >> /var/log/mazimi-backup.log 2>&1
```

백업 파일은 `/opt/mazimi/backups/` 로컬 디렉토리 또는 S3에 저장된다.

---

## 6. 모니터링

### 6-1. 헬스체크 엔드포인트

API 서버는 `/health` 엔드포인트를 제공한다.

```bash
# 수동 확인
curl -f https://api.mazimi.kr/health
```

### 6-2. Docker 헬스체크 상태 확인

```bash
docker compose ps          # STATUS 열에서 healthy 확인
docker inspect mazimi-api-1 | grep -A 10 Health
```

### 6-3. Uptime 모니터링 (무료 외부 서비스)

| 서비스 | URL | 무료 플랜 |
|--------|-----|-----------|
| UptimeRobot | https://uptimerobot.com | 50개 모니터, 5분 간격 |
| Better Uptime | https://betterstack.com/better-uptime | 10개 모니터, 3분 간격 |

설정 방법:
1. 서비스 가입 후 "Add Monitor" 클릭
2. Monitor Type: `HTTP(s)`
3. URL: `https://api.mazimi.kr/health`
4. 알림: 이메일 또는 Slack 웹훅 입력

### 6-4. 로그 확인

```bash
# 실시간 로그
docker compose logs -f api
docker compose logs -f worker

# 최근 100줄
docker compose logs --tail=100 api
```

### 6-5. 디스크 사용량 모니터링

```bash
# 디스크 현황
df -h

# Docker 볼륨 사용량
docker system df
```
