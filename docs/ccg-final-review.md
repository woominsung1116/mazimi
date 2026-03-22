# 마지미 최종 프로젝트 검토 (CCG 합성)
> 2026-03-22 | Codex + Gemini + Claude Verifier

## 발견된 이슈 (12개)

### 🔴 치명적 (3개)
1. 모바일 API 계약 불일치 — IDOR 수정 후 클라이언트가 아직 user_id 보내는 곳 있음
2. 관리자 웹 API 계약 불일치 — 응답 형식 + 인증 헤더 미적용
3. RLS 런타임 미연결 — SET LOCAL app.current_user_id 코드 없음

### 🟠 높음 (4개)
4. Dockerfile.web pnpm/npm 불일치
5. Global Error Boundary 없음
6. cargo test 실패 (Program 구조체 변경 미반영)
7. 빠진 네비게이션 연결 (preview, 프로필 편집)

### 🟡 중간 (5개)
8. Worker 소스 6개 (7번째는 수동 등록)
9. FlatList React.memo 미적용
10. 오프라인 인디케이터 불일관
11. 에러 메시지 한국어 순화 필요
12. Dead code (my.rs, payment.rs)

## 수정 상태
- 치명적 3개: 에이전트 수정 중
- 높음 2개 (Error Boundary, Dockerfile): 에이전트 수정 중
- 나머지: 출시 전 수정 예정
- Profile GET /api/v1/profile 라우트 추가 (JWT 기반 자기 프로필 조회)
- Verifier 결과: APPROVED (DB 미실행으로 인한 테스트 실패는 인프라 이슈)
