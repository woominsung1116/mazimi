-- Migration: document_checklists
-- Inserts program_documents for key programs across all seed files.
-- Coverage: 장학금, 월세지원, 취업지원, 금융상품, 기업혜택, 복지지원 등 20개 프로그램

-- ============================================================
-- 장학금 (scholarship)
-- 공통 서류: 재학증명서, 성적증명서, 소득금액증명원, 주민등록등본
-- ============================================================

-- 국가장학금 1유형
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',       '대학교 학사포털에서 발급. 보통 즉시 출력 가능 (일부 대학 1~2일 소요)', true,  1 FROM programs WHERE title = '국가장학금 1유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',       '대학교 학사포털에서 발급. 최근 학기 성적 포함본 출력', true,  2 FROM programs WHERE title = '국가장학금 1유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '국가장학금 1유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  4 FROM programs WHERE title = '국가장학금 1유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '가족관계증명서',   '대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서 온라인 발급, 즉시 출력 가능', false, 5 FROM programs WHERE title = '국가장학금 1유형' LIMIT 1;

-- 부산 인재육성 장학금
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',       '대학교 학사포털에서 발급. 보통 즉시 출력 가능 (일부 대학 1~2일 소요)', true,  1 FROM programs WHERE title = '부산 인재육성 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',       '대학교 학사포털에서 발급. 최근 학기 성적 포함본 출력', true,  2 FROM programs WHERE title = '부산 인재육성 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '부산 인재육성 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능. 부산 주소지 확인용', true,  4 FROM programs WHERE title = '부산 인재육성 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',        '본인 명의 통장의 첫 페이지 사본 (계좌번호·은행명 확인 가능한 면)', true,  5 FROM programs WHERE title = '부산 인재육성 장학금' LIMIT 1;

-- 한국장학재단 2유형
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',       '대학교 학사포털에서 발급. 보통 즉시 출력 가능 (일부 대학 1~2일 소요)', true,  1 FROM programs WHERE title = '한국장학재단 2유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',       '대학교 학사포털에서 발급. 최근 학기 성적 포함본 출력', true,  2 FROM programs WHERE title = '한국장학재단 2유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '한국장학재단 2유형' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  4 FROM programs WHERE title = '한국장학재단 2유형' LIMIT 1;

-- 이공계장학금
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',       '대학교 학사포털에서 발급. 이공계 학과 재학 사실 확인용', true,  1 FROM programs WHERE title = '이공계장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',       '대학교 학사포털에서 발급. 최근 2개 학기 성적 포함본', true,  2 FROM programs WHERE title = '이공계장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '이공계장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  4 FROM programs WHERE title = '이공계장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',        '본인 명의 통장의 첫 페이지 사본 (계좌번호·은행명 확인 가능한 면)', true,  5 FROM programs WHERE title = '이공계장학금' LIMIT 1;

-- 민간장학재단A
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',       '대학교 학사포털에서 발급', true,  1 FROM programs WHERE title = '민간장학재단A' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',       '대학교 학사포털에서 발급. 직전 학기 성적 포함', true,  2 FROM programs WHERE title = '민간장학재단A' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '민간장학재단A' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  4 FROM programs WHERE title = '민간장학재단A' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자기소개서',       '재단 양식에 맞춰 직접 작성 (A4 1~2매 분량)', true,  5 FROM programs WHERE title = '민간장학재단A' LIMIT 1;

-- 보훈자녀 학비지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',       '대학교 학사포털에서 발급', true,  1 FROM programs WHERE title = '보훈자녀 학비지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  2 FROM programs WHERE title = '보훈자녀 학비지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '가족관계증명서',   '대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '보훈자녀 학비지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '국가유공자증명서', '국가보훈처에서 발급. 보훈청 방문 또는 보훈처 민원포털에서 신청', true,  4 FROM programs WHERE title = '보훈자녀 학비지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',        '본인 명의 통장의 첫 페이지 사본 (계좌번호·은행명 확인 가능한 면)', true,  5 FROM programs WHERE title = '보훈자녀 학비지원' LIMIT 1;

-- ============================================================
-- 월세·주거 지원
-- 공통 서류: 주민등록등본, 임대차계약서, 소득금액증명원
-- ============================================================

-- 부산 청년 월세 지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능. 부산 주소지 확인용', true,  1 FROM programs WHERE title = '부산 청년 월세 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '임대차계약서 사본','현재 거주 중인 주택의 전·월세 계약서 전체 페이지 복사본', true,  2 FROM programs WHERE title = '부산 청년 월세 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '부산 청년 월세 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',        '본인 명의 통장의 첫 페이지 사본 (지원금 입금 계좌)', true,  4 FROM programs WHERE title = '부산 청년 월세 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '건강보험자격득실확인서', '건강보험공단 홈페이지(nhis.or.kr)에서 온라인 발급, 즉시 출력 가능', false, 5 FROM programs WHERE title = '부산 청년 월세 지원' LIMIT 1;

-- 청년 월세 한시 특별지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능. 독립 거주 주소 확인용', true,  1 FROM programs WHERE title = '청년 월세 한시 특별지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '임대차계약서 사본','현재 거주 중인 주택의 전·월세 계약서 전체 페이지 복사본', true,  2 FROM programs WHERE title = '청년 월세 한시 특별지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '청년 월세 한시 특별지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록초본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능. 부모와 별도 주소지 확인용', true,  4 FROM programs WHERE title = '청년 월세 한시 특별지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',        '본인 명의 통장의 첫 페이지 사본 (월세 지원금 입금 계좌)', true,  5 FROM programs WHERE title = '청년 월세 한시 특별지원' LIMIT 1;

-- 대구 청년 주거 지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능. 대구 주소지 확인용', true,  1 FROM programs WHERE title = '대구 청년 주거 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '임대차계약서 사본','현재 거주 중인 주택의 전·월세 계약서 전체 페이지 복사본', true,  2 FROM programs WHERE title = '대구 청년 주거 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '대구 청년 주거 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',        '본인 명의 통장의 첫 페이지 사본', true,  4 FROM programs WHERE title = '대구 청년 주거 지원' LIMIT 1;

-- 부산 신혼부부 주거
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급. 세대 구성 확인용 (부부 동거 확인)', true,  1 FROM programs WHERE title = '부산 신혼부부 주거' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '가족관계증명서',   '대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  2 FROM programs WHERE title = '부산 신혼부부 주거' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '혼인관계증명서',   '대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서 온라인 발급. 혼인신고일 확인용', true,  3 FROM programs WHERE title = '부산 신혼부부 주거' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급 (부부 각각 제출)', true,  4 FROM programs WHERE title = '부산 신혼부부 주거' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '임대차계약서 사본','전세 계약서 전체 페이지 복사본 (임대인·임차인 서명란 포함)', true,  5 FROM programs WHERE title = '부산 신혼부부 주거' LIMIT 1;

-- 청년전용 버팀목전세대출
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',     '정부24(gov.kr)에서 온라인 발급. 무주택 세대주 확인용', true,  1 FROM programs WHERE title LIKE '%버팀목전세대출%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '임대차계약서 사본','계약 체결한 전세 계약서 전체 페이지 복사본', true,  2 FROM programs WHERE title LIKE '%버팀목전세대출%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',   '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title LIKE '%버팀목전세대출%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록초본',     '정부24(gov.kr)에서 온라인 발급. 주소 변동 이력 확인용', true,  4 FROM programs WHERE title LIKE '%버팀목전세대출%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '건강보험자격득실확인서', '건강보험공단 홈페이지(nhis.or.kr)에서 온라인 발급', false, 5 FROM programs WHERE title LIKE '%버팀목전세대출%' LIMIT 1;

-- ============================================================
-- 취업 지원
-- 공통 서류: 이력서, 졸업(예정)증명서, 주민등록등본
-- ============================================================

-- 부산 청년 취업 장려금
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 부산 주소지 확인용', true,  1 FROM programs WHERE title = '부산 청년 취업 장려금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '근로계약서 사본',      '취업한 사업장과 체결한 근로계약서 전체 페이지 복사본', true,  2 FROM programs WHERE title = '부산 청년 취업 장려금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '4대보험 가입내역확인서','국민건강보험공단(nhis.or.kr) 또는 4대사회보험 포털(4insure.or.kr)에서 발급. 취업 사실 확인용', true,  3 FROM programs WHERE title = '부산 청년 취업 장려금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '졸업증명서 또는 졸업예정증명서', '대학교 학사포털에서 발급. 최종 학력 확인용', true,  4 FROM programs WHERE title = '부산 청년 취업 장려금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (장려금 입금 계좌)', true,  5 FROM programs WHERE title = '부산 청년 취업 장려금' LIMIT 1;

-- 청년내일채움공제 (policy 버전, seed_extended)
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '근로계약서 사본',      '중소기업과 체결한 정규직 근로계약서 전체 페이지 복사본', true,  1 FROM programs WHERE title = '청년내일채움공제' AND program_type = 'policy' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '4대보험 가입내역확인서','4대사회보험 포털(4insure.or.kr)에서 발급. 정규직 취업일 확인용', true,  2 FROM programs WHERE title = '청년내일채움공제' AND program_type = 'policy' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '청년내일채움공제' AND program_type = 'policy' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (공제금 납입 계좌)', true,  4 FROM programs WHERE title = '청년내일채움공제' AND program_type = 'policy' LIMIT 1;

-- 청년구직활동지원금
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  1 FROM programs WHERE title = '청년구직활동지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '졸업증명서 또는 졸업예정증명서', '대학교 학사포털에서 발급. 졸업·중퇴 후 2년 이내 확인용', true,  2 FROM programs WHERE title = '청년구직활동지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 미취업 소득 현황 확인용', true,  3 FROM programs WHERE title = '청년구직활동지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '구직활동계획서',       '워크넷(work.go.kr)에서 제공하는 양식에 맞춰 작성', true,  4 FROM programs WHERE title = '청년구직활동지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (지원금 입금 계좌)', true,  5 FROM programs WHERE title = '청년구직활동지원금' LIMIT 1;

-- 부산 청년 면접 정장
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 부산 주소지 확인용', true,  1 FROM programs WHERE title = '부산 청년 면접 정장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '취업준비 증빙서류',    '워크넷·사람인 등 구직 사이트 이력서 출력본 또는 학교 취업지원센터 확인서', true,  2 FROM programs WHERE title = '부산 청년 면접 정장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 미취업 상태 확인용', false, 3 FROM programs WHERE title = '부산 청년 면접 정장' LIMIT 1;

-- 국민취업지원제도
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  1 FROM programs WHERE title = '국민취업지원제도' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 소득 기준 충족 확인용', true,  2 FROM programs WHERE title = '국민취업지원제도' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '건강보험자격득실확인서','건강보험공단 홈페이지(nhis.or.kr)에서 온라인 발급. 고용보험 미가입 확인용', true,  3 FROM programs WHERE title = '국민취업지원제도' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (구직촉진수당 입금 계좌)', true,  4 FROM programs WHERE title = '국민취업지원제도' LIMIT 1;

-- ============================================================
-- 창업 지원
-- ============================================================

-- 부산 청년 창업 지원금
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 부산 주소지 확인용', true,  1 FROM programs WHERE title = '부산 청년 창업 지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '사업계획서',           '부산경제진흥원 양식에 맞춰 작성. 창업 아이디어·수익 모델·자금 계획 포함', true,  2 FROM programs WHERE title = '부산 청년 창업 지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '부산 청년 창업 지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (지원금 입금 계좌)', true,  4 FROM programs WHERE title = '부산 청년 창업 지원금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '사업자등록증 사본',    '사업자등록이 완료된 경우 제출. 홈택스에서 발급 또는 사본 제출', false, 5 FROM programs WHERE title = '부산 청년 창업 지원금' LIMIT 1;

-- 대구 청년 창업 지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 대구 주소지 확인용', true,  1 FROM programs WHERE title = '대구 청년 창업 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '사업계획서',           '대구경제통상진흥원 양식에 맞춰 작성. 창업 아이디어·시장분석·자금 계획 포함', true,  2 FROM programs WHERE title = '대구 청년 창업 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '대구 청년 창업 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '사업자등록증 사본',    '기창업자는 필수 제출. 홈택스에서 발급 또는 사본 제출', false, 4 FROM programs WHERE title = '대구 청년 창업 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (지원금 입금 계좌)', true,  5 FROM programs WHERE title = '대구 청년 창업 지원' LIMIT 1;

-- ============================================================
-- 금융 상품
-- 공통 서류: 주민등록등본, 소득금액증명원, 통장사본
-- ============================================================

-- 청년도약계좌
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 연령 및 거주지 확인용', true,  1 FROM programs WHERE title = '청년도약계좌' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 개인소득 7,500만원 이하 확인용', true,  2 FROM programs WHERE title = '청년도약계좌' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '건강보험료 납부확인서','건강보험공단(nhis.or.kr)에서 발급. 가구 소득 분위 확인용', true,  3 FROM programs WHERE title = '청년도약계좌' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '신분증',               '주민등록증 또는 운전면허증 원본 (은행 방문 시 지참)', true,  4 FROM programs WHERE title = '청년도약계좌' LIMIT 1;

-- 청년 우대형 주택청약종합저축
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 무주택 세대주 확인용', true,  1 FROM programs WHERE title LIKE '%주택청약종합저축%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 연소득 3,600만원 이하 확인용', true,  2 FROM programs WHERE title LIKE '%주택청약종합저축%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '무주택확인서',         '청약홈(applyhome.co.kr)에서 발급 또는 공인중개사 확인 서류', true,  3 FROM programs WHERE title LIKE '%주택청약종합저축%' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '신분증',               '주민등록증 또는 운전면허증 원본 (은행 방문 시 지참)', true,  4 FROM programs WHERE title LIKE '%주택청약종합저축%' LIMIT 1;

-- 기쁨두배통장
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 부산 주소지 및 연령 확인용', true,  1 FROM programs WHERE title = '기쁨두배통장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 소득 기준 확인용', true,  2 FROM programs WHERE title = '기쁨두배통장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '건강보험료 납부확인서','건강보험공단(nhis.or.kr)에서 발급. 소득 분위 확인 보조 서류', false, 3 FROM programs WHERE title = '기쁨두배통장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (적금 자동이체 출금 계좌)', true,  4 FROM programs WHERE title = '기쁨두배통장' LIMIT 1;

-- ============================================================
-- 기업 혜택 (corporate_benefit)
-- 공통: 이력서, 졸업(예정)증명서, 주민등록등본
-- ============================================================

-- 삼성전기 청년 인턴십 프로그램
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '이력서',               '삼성전기 공채 시스템(careers.samsung.com) 또는 지원 양식에 맞춰 작성', true,  1 FROM programs WHERE title = '삼성전기 청년 인턴십 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자기소개서',           '삼성전기 지원 양식에 맞춰 작성. 지원 동기·직무 역량 중심', true,  2 FROM programs WHERE title = '삼성전기 청년 인턴십 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',           '대학교 학사포털에서 발급. 재학 중 또는 최종 학기 재학 확인용', true,  3 FROM programs WHERE title = '삼성전기 청년 인턴십 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',           '대학교 학사포털에서 발급. 최근 학기 포함 전체 성적본', true,  4 FROM programs WHERE title = '삼성전기 청년 인턴십 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '어학성적표 사본',      '토익·오픽 등 최근 2년 이내 취득한 어학 성적 사본', false, 5 FROM programs WHERE title = '삼성전기 청년 인턴십 프로그램' LIMIT 1;

-- 부산항만공사 청년 채용 연계 프로그램
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '이력서',               '부산항만공사 채용 포털(busanpa.com) 입력 또는 공사 양식 작성', true,  1 FROM programs WHERE title = '부산항만공사 청년 채용 연계 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자기소개서',           '부산항만공사 양식에 맞춰 작성. 지원 동기·역량·경험 중심', true,  2 FROM programs WHERE title = '부산항만공사 청년 채용 연계 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '졸업증명서 또는 졸업예정증명서', '대학교 학사포털에서 발급. 최종 학력 확인용', true,  3 FROM programs WHERE title = '부산항만공사 청년 채용 연계 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 연령 및 주소 확인용', true,  4 FROM programs WHERE title = '부산항만공사 청년 채용 연계 프로그램' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자격증 사본',          '물류·항만 관련 자격증 보유 시 제출 (가점 대상)', false, 5 FROM programs WHERE title = '부산항만공사 청년 채용 연계 프로그램' LIMIT 1;

-- 코오롱인더스트리 청년 장학금
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',           '대학교 학사포털에서 발급. 섬유·소재 관련 학과 재학 확인용', true,  1 FROM programs WHERE title = '코오롱인더스트리 청년 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '성적증명서',           '대학교 학사포털에서 발급. 전체 이수 성적 포함본', true,  2 FROM programs WHERE title = '코오롱인더스트리 청년 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 대구 주소지 확인용', true,  3 FROM programs WHERE title = '코오롱인더스트리 청년 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 발급. 가구 소득 기준 확인용', true,  4 FROM programs WHERE title = '코오롱인더스트리 청년 장학금' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자기소개서',           '코오롱 지원 양식에 맞춰 작성. 섬유·소재 분야 진로 계획 포함', true,  5 FROM programs WHERE title = '코오롱인더스트리 청년 장학금' LIMIT 1;

-- ============================================================
-- 복지 지원
-- ============================================================

-- 기초생활보장
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 가구 구성원 확인용', true,  1 FROM programs WHERE title = '기초생활보장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 가구 소득 산정용', true,  2 FROM programs WHERE title = '기초생활보장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '금융정보 제공동의서',  '행정복지센터(주민센터)에서 비치 양식 작성. 금융재산 조회 동의용', true,  3 FROM programs WHERE title = '기초생활보장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '건강보험료 납부확인서','건강보험공단(nhis.or.kr)에서 발급. 소득 분위 확인 보조 서류', false, 4 FROM programs WHERE title = '기초생활보장' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (급여 입금 계좌)', true,  5 FROM programs WHERE title = '기초생활보장' LIMIT 1;

-- 한부모가족 지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 세대 구성 및 자녀 동거 확인용', true,  1 FROM programs WHERE title = '한부모가족 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '가족관계증명서',       '대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서 발급. 한부모 가정 확인용', true,  2 FROM programs WHERE title = '한부모가족 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '소득금액증명원',       '홈택스(hometax.go.kr)에서 온라인 발급. 소득 기준 확인용', true,  3 FROM programs WHERE title = '한부모가족 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (아동양육비 입금 계좌)', true,  4 FROM programs WHERE title = '한부모가족 지원' LIMIT 1;

-- 장애학생 지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '장애인증명서',         '복지로(bokjiro.go.kr) 또는 주민센터에서 발급. 장애 등록 확인용', true,  1 FROM programs WHERE title = '장애학생 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '재학증명서',           '대학교 학사포털에서 발급. 재학 중 학생 확인용', true,  2 FROM programs WHERE title = '장애학생 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급, 즉시 출력 가능', true,  3 FROM programs WHERE title = '장애학생 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (생활비 지원 입금 계좌)', true,  4 FROM programs WHERE title = '장애학생 지원' LIMIT 1;

-- ============================================================
-- 역량 개발 지원
-- ============================================================

-- 청년 디지털 배움터
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 부산 주소지 및 연령 확인용', true,  1 FROM programs WHERE title = '청년 디지털 배움터' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '교육 수료증',          '해당 디지털 역량 교육 과정 수료 후 발급. 교육기관에서 제공', true,  2 FROM programs WHERE title = '청년 디지털 배움터' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (교육비 지원금 입금 계좌)', true,  3 FROM programs WHERE title = '청년 디지털 배움터' LIMIT 1;

-- 부산 청년 자격증 취득 지원
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 부산 주소지 및 연령 확인용', true,  1 FROM programs WHERE title = '부산 청년 자격증 취득 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자격증 취득 영수증',   '응시료 결제 영수증 또는 교재 구매 영수증 원본', true,  2 FROM programs WHERE title = '부산 청년 자격증 취득 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '자격증 취득 증빙',     '국가기술자격증 또는 전문자격증 합격 통지서 또는 자격증 사본', true,  3 FROM programs WHERE title = '부산 청년 자격증 취득 지원' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '통장 사본',            '본인 명의 통장의 첫 페이지 사본 (지원금 입금 계좌)', true,  4 FROM programs WHERE title = '부산 청년 자격증 취득 지원' LIMIT 1;

-- 대구 청년 해외 인턴십
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '주민등록등본',         '정부24(gov.kr)에서 온라인 발급. 대구 주소지 및 연령 확인용', true,  1 FROM programs WHERE title = '대구 청년 해외 인턴십' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '여권 사본',            '유효기간 6개월 이상 여권의 개인정보 페이지 복사본', true,  2 FROM programs WHERE title = '대구 청년 해외 인턴십' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '인턴십 확인서',        '해외 파견 기업·기관에서 발급한 인턴십 수락(참가) 확인서', true,  3 FROM programs WHERE title = '대구 청년 해외 인턴십' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '졸업증명서 또는 졸업예정증명서', '대학교 학사포털에서 발급. 최종 학력 확인용', true,  4 FROM programs WHERE title = '대구 청년 해외 인턴십' LIMIT 1;
INSERT INTO program_documents (program_id, document_name, description, is_required, sort_order)
SELECT id, '항공권 사본',          '왕복 항공권 예약 확인서 또는 발권 사본 (비용 정산용)', false, 5 FROM programs WHERE title = '대구 청년 해외 인턴십' LIMIT 1;
