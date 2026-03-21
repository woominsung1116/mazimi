-- Migration: corporate_benefit support
--
-- program_type is TEXT (not an enum), so 'corporate_benefit' is already a valid
-- value by convention. This migration adds the three new columns and seeds
-- sample corporate benefit programs for Busan / Daegu companies.

-- ── New columns ───────────────────────────────────────────────────────────────

ALTER TABLE programs
    ADD COLUMN IF NOT EXISTS company_name      TEXT,
    ADD COLUMN IF NOT EXISTS company_logo_url  TEXT,
    ADD COLUMN IF NOT EXISTS benefit_category  TEXT;
-- benefit_category values: 'recruitment' | 'internship' | 'scholarship'
--                          | 'welfare' | 'discount'

-- Index for filtering corporate benefits by category
CREATE INDEX IF NOT EXISTS idx_programs_benefit_category
    ON programs (benefit_category)
    WHERE benefit_category IS NOT NULL;

-- ── Seed: corporate benefit programs ─────────────────────────────────────────

-- 1. 부산 삼성전기 청년 인턴십 프로그램
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    '삼성전기 청년 인턴십 프로그램',
    '부산 소재 삼성전기 사업장에서 근무하는 6개월 유급 인턴십 프로그램입니다. 월 200만원 급여 및 우수 인턴 정규직 전환 기회를 제공합니다.',
    '삼성전기', 'https://www.samsungsem.com/kr/recruit/intern',
    'active',
    2000000, 20, 30, ARRAY['busan'],
    '2026-05-31 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-31 23:59:59+09',
    '삼성전기', 'internship',
    '["인턴십","전자부품","정규직전환","부산"]'::jsonb
);

-- 2. 대구 코오롱인더스트리 청년 장학금
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    '코오롱인더스트리 청년 장학금',
    '대구 거주 섬유·소재 계열 전공 대학생에게 학기당 최대 300만원 장학금을 지원합니다. 졸업 후 코오롱인더스트리 입사 연계 우대 혜택이 포함됩니다.',
    '코오롱인더스트리', 'https://www.kolonglobal.com/kor/recruit/scholarship',
    'active',
    3000000, 19, 28, ARRAY['daegu'],
    '2026-04-20 23:59:59+09', true,
    '2026-03-15 00:00:00+09', '2026-04-20 23:59:59+09',
    '코오롱인더스트리', 'scholarship',
    '["장학금","섬유","소재","대구","취업연계"]'::jsonb
);

-- 3. BNK금융그룹 부산 청년 우대 적금
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    'BNK 청년 우대 적금',
    '부산 거주 만 19~34세 청년을 위한 연 최고 5.5% 우대금리 적금 상품입니다. 월 최대 50만원 납입 가능하며, 만기 시 이자 추가 지원금 10만원을 지급합니다.',
    'BNK부산은행', 'https://www.busanbank.co.kr/savings/youth',
    'active',
    500000, 19, 34, ARRAY['busan'],
    '2026-12-31 23:59:59+09', true,
    '2026-01-01 00:00:00+09', '2026-12-31 23:59:59+09',
    'BNK금융그룹', 'welfare',
    '["적금","우대금리","금융혜택","부산"]'::jsonb
);

-- 4. 부산항만공사 청년 채용 연계 프로그램
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    '부산항만공사 청년 채용 연계 프로그램',
    '부산항만공사의 6개월 체험형 인턴 과정으로 월 210만원 급여를 지급합니다. 물류·항만 분야 직무 교육을 병행하며 수료 후 정규직 전환 심사 기회를 제공합니다.',
    '부산항만공사', 'https://www.busanpa.com/ko/recruit',
    'active',
    2100000, 19, 35, ARRAY['busan'],
    '2026-06-30 23:59:59+09', true,
    '2026-05-01 00:00:00+09', '2026-06-30 23:59:59+09',
    '부산항만공사', 'recruitment',
    '["공공기관","항만","물류","인턴","정규직"]'::jsonb
);

-- 5. 대구 삼성창조경제혁신센터 청년 창업 지원
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    '삼성창조경제혁신센터 청년 창업 지원',
    '대구 소재 삼성창조경제혁신센터에서 운영하는 청년 창업 액셀러레이팅 프로그램입니다. 선발 팀당 사업화 자금 최대 2,000만원, 멘토링, 입주 공간을 제공합니다.',
    '삼성창조경제혁신센터(대구)', 'https://ccei.creativekorea.or.kr/daegu',
    'active',
    20000000, 19, 39, ARRAY['daegu'],
    '2026-05-15 23:59:59+09', true,
    '2026-04-01 00:00:00+09', '2026-05-15 23:59:59+09',
    '삼성창조경제혁신센터', 'internship',
    '["창업","액셀러레이팅","사업화자금","대구","스타트업"]'::jsonb
);

-- 6. SK텔레콤 부산 청년 데이터 요금 할인
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    'SKT 청년 데이터 요금 할인',
    '부산 거주 만 19~34세 청년에게 SKT 5G 요금제 월 최대 1만 5천원 할인 혜택을 제공합니다. 부산시와 SKT 협약을 통해 운영됩니다.',
    'SK텔레콤', 'https://www.sktelecom.com/promotions/youth-busan',
    'active',
    15000, 19, 34, ARRAY['busan'],
    '2026-12-31 23:59:59+09', true,
    '2026-01-01 00:00:00+09', '2026-12-31 23:59:59+09',
    'SK텔레콤', 'discount',
    '["통신비","요금할인","5G","부산","생활비절감"]'::jsonb
);

-- 7. 롯데호텔 부산 청년 인턴십
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    '롯데호텔 부산 청년 인턴십',
    '롯데호텔 부산점의 3개월 체험형 인턴십으로 호텔·관광 분야 직무를 경험합니다. 월 180만원 급여와 사원 식사를 제공하며, 우수 수료자는 정규직 지원 시 서류 면제 혜택이 있습니다.',
    '롯데호텔 부산', 'https://www.lottehotel.com/busan-hotel/ko/recruit',
    'active',
    1800000, 19, 30, ARRAY['busan'],
    '2026-07-31 23:59:59+09', true,
    '2026-06-01 00:00:00+09', '2026-07-31 23:59:59+09',
    '롯데호텔', 'internship',
    '["호텔","관광","인턴십","부산","서비스업"]'::jsonb
);

-- 8. 한국가스공사 대구 청년 장학금
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_semester, min_age, max_age, regions,
    deadline_at, is_active, application_start_at, application_end_at,
    company_name, benefit_category,
    tags
) VALUES (
    'corporate_benefit', 'manual',
    '한국가스공사 청년 장학금',
    '한국가스공사 본사 소재지인 대구 거주 이공계 대학생에게 학기당 최대 250만원 장학금을 지원합니다. 방학 중 직무체험 기회 및 졸업 후 채용 우대를 포함합니다.',
    '한국가스공사', 'https://www.kogas.or.kr/portal/contents.do?key=2291',
    'active',
    2500000, 19, 28, ARRAY['daegu'],
    '2026-04-30 23:59:59+09', true,
    '2026-03-20 00:00:00+09', '2026-04-30 23:59:59+09',
    '한국가스공사', 'scholarship',
    '["장학금","이공계","공기업","대구","채용연계"]'::jsonb
);
