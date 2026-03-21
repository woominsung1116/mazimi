-- Migration: financial_product seed data
--
-- Adds government-supported financial products and regional benefit cards.
-- program_type TEXT values used:
--   'financial_product' — savings accounts, loans, mutual savings schemes
--   'policy'            — regional benefit cards, monthly subsidies
--
-- All entries are source_type = 'manual'.
-- 전국 programs use regions = '{}' (empty array).
-- Regional programs carry the city code in the regions array.

-- ── 1. 청년도약계좌 ────────────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년도약계좌',
    '만 19~34세 청년이 월 최대 70만원을 납입하면 정부가 최대 6%의 기여금을 추가 지원하는 5년 만기 적금 상품입니다. 개인소득 7,500만원 이하이면 신청 가능하며 상시 모집합니다.',
    '서민금융진흥원', 'https://ylaccount.kinfa.or.kr',
    'active',
    700000, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["청년도약계좌","적금","정부기여금","서민금융진흥원","금융지원","전국","상시"]'::jsonb,
    to_tsvector('simple',
        '청년도약계좌 서민금융진흥원 적금 정부기여금 금융상품 월납입 전국 상시')
);

-- ── 2. 청년희망적금 (참고용 — 모집 종료) ───────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년희망적금',
    '만 19~34세 청년이 월 최대 50만원을 납입하면 만기 시 저축장려금을 추가 지급하는 2년 만기 적금 상품입니다. 현재 신규 모집은 종료되었으며 기존 가입자는 유지됩니다.',
    '서민금융진흥원', 'https://www.kinfa.or.kr/youth-hope-savings',
    'inactive',
    500000, 19, 34, ARRAY[]::TEXT[],
    '2023-12-31 23:59:59+09', false,
    '["청년희망적금","적금","저축장려금","서민금융진흥원","금융지원","전국","모집종료"]'::jsonb,
    to_tsvector('simple',
        '청년희망적금 서민금융진흥원 적금 저축장려금 금융상품 전국 종료')
);

-- ── 3. 청년내일채움공제 ───────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년내일채움공제',
    '중소기업 정규직으로 취업한 청년이 2년간 본인 400만원을 납입하면 기업 400만원·정부 800만원이 적립되어 만기 시 총 1,600만원을 수령하는 공제 상품입니다.',
    '고용노동부', 'https://www.work.go.kr/youngtomorrow',
    'active',
    16000000, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["청년내일채움공제","중소기업","취업","고용노동부","공제","전국","정규직"]'::jsonb,
    to_tsvector('simple',
        '청년내일채움공제 고용노동부 중소기업 정규직 취업 공제 전국 상시')
);

-- ── 4. 청년전용 버팀목 전세대출 ──────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_once, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년전용 버팀목전세대출',
    '만 19~34세 무주택 청년이 전세 보증금을 마련할 수 있도록 최대 2억원을 연 1.5~2.1% 저금리로 대출해주는 주택도시기금 상품입니다. 상시 신청 가능합니다.',
    '주택도시기금', 'https://nhuf.molit.go.kr',
    'active',
    200000000, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["버팀목전세대출","전세","저금리대출","주택도시기금","무주택","전국","상시"]'::jsonb,
    to_tsvector('simple',
        '청년전용버팀목전세대출 주택도시기금 전세 대출 저금리 무주택 전국 상시')
);

-- ── 5. 청년 우대형 주택청약종합저축 ──────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'financial_product', 'manual',
    '청년 우대형 주택청약종합저축',
    '만 19~34세 무주택 세대주 청년에게 일반 주택청약종합저축 대비 최대 연 4.5% 우대금리와 이자소득 비과세 혜택을 제공하는 적금 상품입니다.',
    '국토교통부', 'https://www.molit.go.kr',
    'active',
    NULL, 19, 34, ARRAY[]::TEXT[],
    NULL, true,
    '["청약저축","우대금리","주택청약","국토교통부","무주택","비과세","전국","상시"]'::jsonb,
    to_tsvector('simple',
        '청년우대형주택청약종합저축 국토교통부 주택청약 우대금리 비과세 무주택 전국 상시')
);

-- ── 6. 부산 청년 디딤돌 카드 ─────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '부산 청년 디딤돌 카드',
    '부산 거주 만 19~34세 청년에게 교통·문화·체육 분야 할인 혜택을 제공하는 지역 혜택 카드입니다. 교통비 할인, 공공체육시설 이용료 감면, 문화 시설 우대 혜택이 포함됩니다.',
    '부산광역시', 'https://www.busan.go.kr/youth/didimdol',
    'active',
    NULL, 19, 34, ARRAY['busan'],
    NULL, true,
    '["디딤돌카드","교통할인","문화혜택","체육","부산","지역혜택카드","상시"]'::jsonb,
    to_tsvector('simple',
        '부산청년디딤돌카드 부산광역시 교통할인 문화 체육 지역혜택 상시')
);

-- ── 7. 대구 청년 교통카드 ─────────────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '대구 청년 교통카드',
    '대구 거주 만 19~34세 청년의 대중교통 이용 요금을 30% 환급해주는 교통비 지원 사업입니다. 버스·지하철 탑승 이력 기반으로 월별 자동 환급됩니다.',
    '대구광역시', 'https://www.daegu.go.kr/youth/traffic',
    'active',
    NULL, 19, 34, ARRAY['daegu'],
    NULL, true,
    '["교통카드","교통비환급","대중교통","대구","지역혜택","상시"]'::jsonb,
    to_tsvector('simple',
        '대구청년교통카드 대구광역시 교통비환급 대중교통 버스 지하철 상시')
);

-- ── 8. 청년 월세 한시 특별지원 ───────────────────────────────────────────────
INSERT INTO programs (
    program_type, source_type, title, summary,
    provider_name, official_url, program_status,
    benefit_amount_monthly, min_age, max_age, regions,
    deadline_at, is_active,
    tags, search_tsv
) VALUES (
    'policy', 'manual',
    '청년 월세 한시 특별지원',
    '부모와 독립하여 거주하는 만 19~34세 청년에게 월 최대 20만원씩 최대 12개월간 월세를 지원합니다. 소득 기준을 충족하는 무주택 독립 거주 청년이 대상입니다.',
    '국토교통부', 'https://www.molit.go.kr/youth-monthly-rent',
    'active',
    200000, 19, 34, ARRAY[]::TEXT[],
    '2026-12-31 23:59:59+09', true,
    '["월세지원","주거비","독립거주","국토교통부","한시지원","전국"]'::jsonb,
    to_tsvector('simple',
        '청년월세한시특별지원 국토교통부 월세 주거비 독립거주 전국 한시지원')
);
