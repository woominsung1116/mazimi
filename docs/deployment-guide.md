# Majimi 배포 가이드

전체 흐름: VPS 구매 → DNS 설정 → Docker 설치 → 코드 배포 → SSL 자동 발급

---

## 1. VPS 구매

**추천: Vultr Seoul (KR)**

| 플랜 | 사양 | 월 비용 |
|------|------|---------|
| Cloud Compute — Regular | 2 vCPU / 4 GB RAM / 80 GB SSD | ~$24 |
| Cloud Compute — Regular | 4 vCPU / 8 GB RAM / 160 GB SSD | ~$48 |

최소 사양은 2 vCPU / 4 GB RAM. PostgreSQL + Redis + Next.js + Axum API 모두 동시 구동 기준.

1. [Vultr 가입](https://www.vultr.com/) 후 **Deploy New Server** 클릭
2. Location: **Seoul (ICN)**
3. Image: **Ubuntu 24.04 LTS**
4. Plan: $24/mo (2 vCPU, 4 GB)
5. SSH Keys 탭에서 공개 키 등록
6. Deploy 후 IP 주소 복사

---

## 2. 도메인 연결 (DNS A 레코드)

DNS 공급자(가비아, Cloudflare 등)에서 아래 레코드를 추가한다.

| 유형 | 이름 | 값 | TTL |
|------|------|----|-----|
| A | `@` (또는 `majimi.kr`) | VPS IP | 300 |
| A | `www` | VPS IP | 300 |

Cloudflare 사용 시 **Proxy(오렌지 구름)를 OFF** 하고 DNS-only(회색 구름)로 설정해야 Caddy가 Let's Encrypt TLS 챌린지를 처리할 수 있다.

전파 확인:
```bash
dig majimi.kr +short
# VPS IP가 반환되면 준비 완료
```

---

## 3. SSH 접속 + 서버 초기 설정

```bash
ssh root@<VPS_IP>

# 시스템 업데이트
apt update && apt upgrade -y

# 방화벽 설정
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (Caddy)
ufw allow 443/tcp  # HTTPS (Caddy)
ufw allow 443/udp  # HTTP/3 (QUIC)
ufw --force enable
ufw status
```

---

## 4. Docker 설치

```bash
# 공식 스크립트로 설치 (Ubuntu 24.04)
curl -fsSL https://get.docker.com | sh

# 현재 사용자를 docker 그룹에 추가 (root 외 사용자인 경우)
usermod -aG docker $USER
newgrp docker

# 버전 확인
docker version
docker compose version
```

---

## 5. Git clone + 환경변수 설정

```bash
# 프로젝트 클론
git clone https://github.com/your-org/majimi.git /opt/majimi
cd /opt/majimi

# 환경변수 파일 생성
cp .env.production.example .env.production
nano .env.production   # 또는 vim
```

`.env.production`에서 반드시 변경해야 하는 항목:

| 변수 | 설명 | 예시 |
|------|------|------|
| `DOMAIN` | 실제 도메인 | `majimi.kr` |
| `DATABASE_URL` | PostgreSQL DSN | `postgres://wello:pw@db:5432/wello` |
| `DB_PASSWORD` | PG 비밀번호 | openssl rand -base64 32 |
| `REDIS_PASSWORD` | Redis 비밀번호 | openssl rand -base64 32 |
| `NEXTAUTH_SECRET` | NextAuth 서명 키 | openssl rand -base64 32 |
| `JWT_SECRET` | Axum JWT 키 | openssl rand -base64 48 |
| `KAKAO_CLIENT_ID` | 카카오 REST API 키 | Kakao Developers 콘솔 |
| `KAKAO_CLIENT_SECRET` | 카카오 Client Secret | Kakao Developers 콘솔 |

deploy.sh가 `CHANGE_ME` 플레이스홀더를 감지하면 자동으로 secrets를 생성한다.

---

## 6. deploy.sh 실행

```bash
cd /opt/majimi
chmod +x scripts/deploy.sh scripts/backup.sh

./scripts/deploy.sh
```

스크립트가 자동으로 수행하는 작업:
1. Docker / openssl 설치 여부 확인
2. `.env.production` 없으면 example에서 복사
3. `CHANGE_ME` 플레이스홀더 → openssl로 자동 생성
4. `docker compose build --parallel`
5. DB 헬스체크 후 SQLx 마이그레이션 실행
6. 전체 서비스 기동 (`docker compose up -d`)
7. API 헬스체크 (`/health`)
8. 배포 완료 URL 출력

---

## 7. SSL 자동 발급 (Caddy)

Caddy는 HTTPS 첫 요청 시 Let's Encrypt에서 TLS 인증서를 자동 발급한다. 별도 설정 불필요.

- 인증서 저장 위치: `caddy_data` Docker volume
- 자동 갱신: Caddy가 만료 30일 전 자동 갱신
- www → apex 리다이렉트: Caddyfile에 설정됨

**확인 방법:**
```bash
# Caddy 로그에서 인증서 발급 확인
docker compose -f /opt/majimi/compose.yml logs caddy | grep -i "certificate"

# HTTPS 응답 확인
curl -I https://majimi.kr
```

---

## 8. 모니터링 확인

### 서비스 상태
```bash
make status
# 또는
docker compose -f /opt/majimi/compose.yml ps
```

### 로그 실시간 확인
```bash
make logs
# 특정 서비스만
docker compose -f /opt/majimi/compose.yml logs -f api
docker compose -f /opt/majimi/compose.yml logs -f web
```

### 헬스 엔드포인트
```bash
curl https://majimi.kr/api/health
# {"status":"ok"}
```

### 리소스 사용량
```bash
docker stats
```

---

## 9. 자동 백업 설정 (crontab)

```bash
# 매일 새벽 3시 자동 백업 + 7일 보관
crontab -e

# 아래 줄 추가:
0 3 * * * /opt/majimi/scripts/backup.sh >> /var/log/majimi-backup.log 2>&1
```

수동 백업:
```bash
make backup
# 또는
./scripts/backup.sh
```

백업 파일 위치: `/opt/majimi/backups/wello_YYYYMMDD_HHMMSS.sql.gz`

---

## 10. Supabase 마이그레이션 (선택)

로컬 PostgreSQL 대신 Supabase managed DB를 사용하려면:

1. [Supabase](https://supabase.com) 프로젝트 생성 (Seoul 리전 선택)

2. **Settings → Database → Connection Pooling** 에서 connection string 복사

3. `.env.production` 수정:
   ```
   DATABASE_URL=postgres://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
   SUPABASE_URL=https://[ref].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[service_role_key]
   ```

4. `compose.yml`에서 `db` 서비스 제거 또는 주석 처리 (로컬 PG 불필요)

5. Supabase SQL Editor에서 마이그레이션 수동 실행:
   ```bash
   cat infra/migrations/*.sql | supabase db push
   # 또는 Supabase CLI 사용
   ```

---

## 업데이트 배포 (코드 변경 후 재배포)

```bash
cd /opt/majimi
git pull origin main
make deploy
```

`make deploy`는 `./scripts/deploy.sh`를 호출하여 이미지 재빌드 + 롤링 재시작을 수행한다.

---

## 롤백

```bash
# 이전 Git 커밋으로 되돌리기
git log --oneline -5
git checkout <commit-hash>
make deploy
```

---

## 문제 해결

| 증상 | 확인 명령 |
|------|----------|
| 서비스 시작 안 됨 | `make logs` |
| DB 연결 실패 | `docker compose exec db pg_isready -U wello` |
| SSL 발급 실패 | `docker compose logs caddy` — DNS 전파 확인 |
| API 500 에러 | `docker compose logs api` |
| 메모리 부족 | `docker stats` → 플랜 업그레이드 고려 |
